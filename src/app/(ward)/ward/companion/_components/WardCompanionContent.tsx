'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { MoodFace } from '@/components/MoodFace';
import { useVoiceInput } from '@/components/chatbot/useVoiceInput';
import { WARD_SILENCE_STOP_MS } from '@/lib/audio/recordingLimiter';
import { canSpeak } from '@/lib/audio/speech';
import { useFaceFrames } from '@/lib/camera/useFaceFrames';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  openWardCompanionSession,
  openWardCompanionTestSession,
  replyWardCompanionAudio,
  sendWardCompanionTestPrompt,
  updateWardCompanionTranscriptConsent,
} from '@/service/api/ward/companion';
import type {
  IWardCompanionReply,
  IWardCompanionSession,
  IWardCompanionToday,
} from '@/service/interface/ward/companion';
import {
  wardCompanionConsentQueryKey,
  wardCompanionConsentQueryOptions,
  wardCompanionTodayQueryKey,
  wardCompanionTodayQueryOptions,
} from '@/service/query/ward';
import { COMPANION_MESSAGES, getCompanionError, isCompanionFrameError } from '@/utils/companion/companionError';
import { openCompanionSlot } from '@/utils/companion/companionOpen';
import { companionVoiceNotice } from '@/utils/companion/companionVoiceNotice';
import { markConsentAsked, readConsentAsked } from '@/utils/companion/consentAsked';
import { splitSentences } from '@/utils/companion/splitSentences';
import { formatSlotTime } from '@/utils/format/slotTime';
import styles from './WardCompanionContent.module.css';
import { useCompanionVoice } from './useCompanionVoice';

const cx = classNames.bind(styles);

// 테스트 계정이 고를 수 있는 시간대 - 서버 시간대와 같다
const TEST_SLOTS = ['09:00', '12:00', '15:00', '18:00', '21:00'];

// 사진 합계를 audio와 더해 서버 상한(10MB) 아래로 둔다 - multipart 머리 몫을 남긴다
const UPLOAD_BUDGET_BYTES = 9.5 * 1024 * 1024;

export const PRIVACY_TEXT = '기분을 살피려고 대답과 얼굴 사진을 AI 서버로 보내요. 대답한 말과 목소리, 얼굴 사진은 저장하지 않아요.';
// 테스트 시작 칸 아래 안내(프로토타입) - 동의와 무관하게 사실인 문장
export const MEDIA_PRIVACY_TEXT = '목소리와 얼굴 사진은 AI 서버로 보내고 저장하지 않아요';
// 보관 일수는 서버 설정값(retentionDays)을 쓴다
export function privacySharedText(retentionDays: number) {
  return `대답한 말은 가족이 볼 수 있게 ${retentionDays}일 동안 보관해요. 목소리와 얼굴 사진은 AI 서버로 보내고 저장하지 않아요.`;
}

// 태블릿 이상은 글자·얼굴을 더 크게 (대화는 한 칸 - 2026-11-23 오른쪽 카메라·판정 칸을 없앴다)
const WIDE_QUERY = '(min-width: 1024px)';


// 말벗은 얼굴 사진을 묻지 않고 항상 함께 보낸다(2026-11-20 결정). 카메라를 못 쓰면 이 화면에서는 목소리만 보낸다
type CameraChoice = 'on' | 'off';

// "오후 3시" → ["오후", "3시"] (시간대 버튼 두 줄 표기)
function splitSlotLabel(label: string): [string, string] {
  const space = label.indexOf(' ');
  return space > 0 ? [label.slice(0, space), label.slice(space + 1)] : ['', label];
}

function fitUploadBudget(audio: Blob, frames: Blob[]) {
  const kept: Blob[] = [];
  let total = audio.size;
  for (const frame of frames) {
    if (total + frame.size > UPLOAD_BUDGET_BYTES) break;
    kept.push(frame);
    total += frame.size;
  }
  return kept;
}

// audio: 말벗 목소리(있으면 받아서 틀고, 없거나 못 받으면 기기 음성으로 읽는다)
// photo: 내 대답 옆에 남기는 그 대답의 마지막 얼굴 사진(blob URL) - 화면 메모리에만, 대화를 닫으면 해제한다(2026-11-23 I안)
type Line = {
  id: number;
  who: 'companion' | 'me';
  text: string;
  heard?: boolean;
  audio?: { sessionId: number; index: number } | null;
  photo?: string | null;
};

// 응답의 audio.index가 정수일 때만 목소리를 받는다 - 없거나 이상하면 기기 음성으로 읽는다
function voiceAudio(sessionId: number, audio: { index: number } | null | undefined): Line['audio'] {
  return audio && Number.isInteger(audio.index) ? { sessionId, index: audio.index } : null;
}

// 대답·말벗 응답은 이 화면 메모리에만 둔다 - localStorage·로그에 남기지 않는다.
// 서버는 동의한 경우에만 대답 글을 보관하고(30일 뒤 삭제, 철회하면 즉시 삭제) 음성·사진은 저장하지 않는다
type Talk = {
  sessionId: number;
  slot: string;
  maxTurns: number | null;
  resumed: boolean;
  turns: number;
  lines: Line[];
  ended: boolean;
  test: boolean;
};

type Pending = 'open' | 'reply' | 'finish' | 'prompt' | null;

export function WardCompanionContent() {
  const queryClient = useQueryClient();
  const [talk, setTalk] = useState<Talk | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lineId = useRef(0);
  const talkRef = useRef<Talk | null>(null);
  useEffect(() => {
    talkRef.current = talk;
  }, [talk]);

  const camera = useFaceFrames();
  // 화면에 그리는 값이 아니라 녹음 시작·전송 때만 읽는다
  const cameraChoiceRef = useRef<CameraChoice>('on');
  const sentFramesRef = useRef(0);
  const chooseCamera = useCallback((choice: CameraChoice) => {
    cameraChoiceRef.current = choice;
  }, []);

  const wide = useMediaQuery(WIDE_QUERY);
  const companionVoice = useCompanionVoice();

  // 대화 내용 공유 동의 - 첫 대화 시작 전에 한 번 묻는다. 상태를 아직 못 받았으면 받아 본 뒤 판단하고(L-2),
  // 끝내 못 받으면 묻지 않고 대화를 막지 않는다
  const consent = useQuery(wardCompanionConsentQueryOptions);
  const [consentAsk, setConsentAsk] = useState<(() => void) | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const withConsent = async (start: () => void) => {
    // 시작 버튼을 누른 그 순간(await 전)에 소리 낼 권한을 얻어 둔다 - 동의 확인·대화 열기를 기다린 뒤에는 늦다(점검 L-1)
    companionVoice.prime();
    let state = consent.data;
    if (!state) {
      try {
        state = await queryClient.fetchQuery(wardCompanionConsentQueryOptions);
      } catch {
        state = undefined;
      }
    }
    if (state && !state.consented && !state.consentedAt && !readConsentAsked()) {
      setConsentError(null);
      setConsentAsk(() => start);
      return;
    }
    start();
  };
  const handleConsentChoice = async (agree: boolean) => {
    const start = consentAsk;
    if (!start || consentSaving) return;
    // "보여 줄게요"는 동의 저장을 기다린 뒤 시작하므로 누른 이 순간에 권한을 얻는다(점검 L-1)
    companionVoice.prime();
    if (agree) {
      setConsentSaving(true);
      setConsentError(null);
      try {
        const saved = await updateWardCompanionTranscriptConsent(true);
        if (saved) queryClient.setQueryData(wardCompanionConsentQueryKey, saved);
        else void queryClient.invalidateQueries({ queryKey: wardCompanionConsentQueryKey });
      } catch {
        setConsentError('저장하지 못했어요. 다시 눌러 주세요.');
        return;
      } finally {
        setConsentSaving(false);
      }
    }
    markConsentAsked();
    setConsentAsk(null);
    start();
  };

  // [테스트 계정만] 시간대 선택·테스트 안내 푸시로 들어온 시간대(?testSlot=15:00)
  const router = useRouter();
  const searchParams = useSearchParams();
  const pushedTestSlot = searchParams?.get('testSlot') ?? null;
  const [pickedTestSlot, setTestSlot] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  // 대화하는 동안에는 현황을 다시 받을 일이 없다. 대화 밖에서는 시간대가 바뀌면 시작 버튼이 열리도록 1분마다 받는다
  const today = useQuery({ ...wardCompanionTodayQueryOptions, refetchInterval: talk ? false : 60_000 });
  const testMode = today.data?.testMode === true;
  // 고른 칸이 없으면 위 안내 띠와 같은 시간대(지금 열린 시간대)를 고른 것으로 본다 - 띠는 '오후 3시'인데
  // 칸·말풍선은 첫 칸 '오전 9시'로 보이던 것(2026-11-20). 열린 시간대가 없으면 첫 칸
  const openTestSlot = openCompanionSlot(today.data);
  // 보던 중 시간대 창이 닫혀도(1분 갱신) 마지막으로 열렸던 시간대를 그대로 고른 것으로 둔다 - 손대지 않았는데 칸이 첫 칸으로 바뀌던 것(#307 점검 L-1)
  const [lastOpenTestSlot, setLastOpenTestSlot] = useState<string | null>(null);
  if (openTestSlot && openTestSlot !== lastOpenTestSlot) setLastOpenTestSlot(openTestSlot);
  const autoTestSlot = openTestSlot ?? lastOpenTestSlot;
  const testSlot = pickedTestSlot ?? (autoTestSlot && TEST_SLOTS.includes(autoTestSlot) ? autoTestSlot : TEST_SLOTS[0]);
  const testEntrySlot = testMode && pushedTestSlot && TEST_SLOTS.includes(pushedTestSlot) ? pushedTestSlot : null;
  // 테스트 안내 푸시로 들어온 칸이 오늘 안내 띠와 같은 시간대면 띠는 숨긴다 - 같은 시간대 시작 버튼이 둘 보이던 것(#307 점검 M-1).
  // 띠에 남길 안내(대화가 끊긴 이유)가 있으면 그대로 보인다.
  // 아직 시작 전(AVAILABLE)일 때만 숨긴다 - 하던 대화(IN_PROGRESS)가 일반 대화면 푸시 칸 버튼(테스트 대화만 이어 감)으로는
  // 이어 갈 수 없어 '이어서 이야기하기'를 남긴다. 현황 다시 받기가 실패했으면 띠 자리의 오류 안내를 남긴다(#313 점검 M-1·L-2)
  const openTestSlotStatus = today.data?.slots.find(slot => slot.slot === openTestSlot)?.status;
  const hideTodayBanner =
    testEntrySlot != null && testEntrySlot === openTestSlot && openTestSlotStatus === 'AVAILABLE' && !notice && !today.isError;
  // 피보호자는 말벗 시간표를 알 필요가 없다 - 대화 시간 밖에 들어오면 안내 없이 홈으로(2026-11-11 사용자 결정).
  // 이미 마친 시간대도 시간 밖으로 본다(openCompanionSlot - 2026-11-11 기능 점검 F-1).
  // 대화 중(마친 화면 포함)·여는 중(F-3)·테스트 계정·불러오는 중·오류·남길 안내(대화가 끊긴 이유)가 있을 때는 머문다.
  const outsideTalkTime =
    !talk && !pending && !notice && today.data != null && !testMode && openCompanionSlot(today.data) === null;
  useEffect(() => {
    if (outsideTalkTime) router.replace('/ward');
  }, [outsideTalkTime, router]);

  // 새 말이 붙으면 대답 버튼까지 보이게 아래로 내린다 - 대화가 길어지면 버튼이 화면 밖으로 밀린다
  // 대화를 마치면 마침 카드 위쪽에 맞춘다 - 맨 아래에 맞추면 폰에서 카드 윗부분이 화면 밖으로 밀린다
  const bottomRef = useRef<HTMLDivElement>(null);
  const endCardRef = useRef<HTMLElement>(null);
  const lineCount = talk?.lines.length ?? 0;
  const ended = talk?.ended ?? false;

  const nextLine = (who: Line['who'], text: string, heard?: boolean): Line => ({ id: ++lineId.current, who, text, heard });

  // 내 대답 옆 얼굴 사진 - 보낸 사진 중 마지막 장을 blob URL로 들고 있다가 대답 줄에 붙인다. 서버·기기 저장소에 남기지 않고
  // 대화를 닫거나 화면을 떠나면 모두 해제한다(안내 문구 "얼굴 사진은 저장하지 않아요"와 같은 기준)
  const lastPhotoRef = useRef<string | null>(null);
  const photoUrlsRef = useRef<Set<string>>(new Set());
  const releasePhotos = useCallback(() => {
    photoUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    photoUrlsRef.current.clear();
    lastPhotoRef.current = null;
  }, []);
  useEffect(() => releasePhotos, [releasePhotos]);

  const refreshToday = useCallback(() => void queryClient.invalidateQueries({ queryKey: wardCompanionTodayQueryKey }), [queryClient]);

  // 이어갈 수 없는 대화는 닫고 오늘 현황을 다시 받는다
  const leaveTalk = useCallback((message: string) => {
    companionVoice.reset();
    camera.cancel();
    releasePhotos();
    setTalk(null);
    setNotice(message);
    refreshToday();
  }, [refreshToday, camera, companionVoice, releasePhotos]);

  const handleError = useCallback((error: unknown) => {
    const { message, action } = getCompanionError(error);
    if (action === 'exit') {
      leaveTalk(message);
      return;
    }
    setNotice(message);
  }, [leaveTalk]);

  const applyReply = useCallback((result: IWardCompanionReply | null, answer: string, heard: boolean) => {
    if (!result) return;
    const sessionId = talkRef.current?.sessionId;
    const mine = { ...nextLine('me', answer, heard), photo: lastPhotoRef.current };
    lastPhotoRef.current = null;
    const reply = result.reply && sessionId != null ? { ...nextLine('companion', result.reply), audio: voiceAudio(sessionId, result.audio) } : null;
    setTalk(current => {
      if (!current) return current;
      const lines = [...current.lines, mine];
      if (reply) lines.push(reply);
      return { ...current, turns: result.turnNo, lines, ended: result.ended };
    });
    if (reply) companionVoice.play(reply);
    // 서버가 대화를 닫았으면 마치기는 부르지 않는다
    if (result.ended) refreshToday();
  }, [refreshToday, companionVoice]);

  const voiceOptions = useMemo(() => ({
    // 말이 3초 멈추면 저절로 끝내고 보낸다 - 어르신 AI 의료 챗봇과 같은 값(2026-11-23, 전에는 공용 기본 1.5초)
    silenceMs: WARD_SILENCE_STOP_MS,
    send: async (audio: Blob, signal: AbortSignal) => {
      const current = talkRef.current;
      // 녹음이 끝나는 순간 카메라를 끄고 찍은 사진을 받는다
      const frames = fitUploadBudget(audio, await camera.take());
      sentFramesRef.current = frames.length;
      const lastFrame = frames.at(-1);
      lastPhotoRef.current = null;
      if (lastFrame) {
        const url = URL.createObjectURL(lastFrame);
        photoUrlsRef.current.add(url);
        lastPhotoRef.current = url;
      }
      if (!current) throw new Error('대화가 열려 있지 않다');
      return replyWardCompanionAudio(current.sessionId, audio, signal, frames);
    },
    onError: (error: unknown) => {
      // 사진 때문에 거절됐으면 이 화면에서는 사진을 끄고 목소리만 다시 보내게 한다
      if (sentFramesRef.current > 0 && isCompanionFrameError(error)) {
        chooseCamera('off');
        setNotice(COMPANION_MESSAGES.frame);
        return;
      }
      handleError(error);
    },
  }), [handleError, camera, chooseCamera]);

  const voice = useVoiceInput<IWardCompanionReply | null>(
    result => applyReply(result, result?.transcript?.trim() || '말로 대답했어요', Boolean(result?.transcript?.trim())),
    voiceOptions,
  );

  // 녹음이 시작되면 카메라를 켜고(카메라를 못 쓴다고 확인된 뒤에는 켜지 않는다), 녹음이 버려지면 바로 끈다
  // 보낼 때는 send가 먼저 take()로 끈다. 권한 창은 마이크 다음에 뜬다(둘을 따로 물어 카메라를 거부해도 마이크는 그대로)
  const prevVoiceState = useRef(voice.state);
  useEffect(() => {
    const prev = prevVoiceState.current;
    prevVoiceState.current = voice.state;
    // 말벗 목소리가 대답 녹음에 섞이지 않게 녹음이 시작되면 바로 멈춘다(받던 소리도 버린다)
    if (voice.state === 'recording' && prev !== 'recording') companionVoice.stop();
    if (voice.state === 'idle') {
      camera.cancel();
      return;
    }
    if (voice.state !== 'recording' || prev === 'recording' || cameraChoiceRef.current !== 'on') return;
    // 권한 거부·카메라 없음은 안내 없이 목소리만으로 이어 간다(어르신 화면에 기술 안내를 띄우지 않는다)
    void camera.open().then(result => {
      if (result === 'denied' || result === 'unsupported') chooseCamera('off');
    });
  }, [voice.state, camera, chooseCamera, companionVoice]);

  // 대답 칸이 커질 때(녹음 안내 "말씀하세요…"·생각 중 줄·오류 안내)도 다시 내린다 - 새 말이 붙을 때만 내리면
  // 녹음을 누르는 순간 안내 줄만큼 대답 버튼이 화면 아래로 밀려 잘려 보였다(2026-11-22)
  const answerNotice = voice.state === 'recording' ? 'recording' : (notice ?? voice.notice ?? '');
  useEffect(() => {
    if (ended) endCardRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    else if (lineCount > 1 || answerNotice) bottomRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [lineCount, ended, answerNotice, voice.state, pending]);

  const startTalk = (session: IWardCompanionSession, test: boolean) => {
    const question = { ...nextLine('companion', session.question), audio: voiceAudio(session.sessionId, session.audio) };
    setTalk({
      sessionId: session.sessionId,
      slot: session.slot,
      maxTurns: session.maxTurns,
      resumed: session.resumed,
      // 이어 하는 대화는 서버가 준 턴 수부터 센다("8번 중 N번째"·진행 점이 처음부터 다시 세지 않게)
      turns: session.turnCount ?? 0,
      lines: [question],
      ended: false,
      test,
    });
    companionVoice.play(question);
  };

  const handleOpen = async () => {
    if (pending) return;
    setPending('open');
    setNotice(null);
    try {
      const session = await openWardCompanionSession();
      if (!session) throw new Error('빈 응답');
      startTalk(session, false);
    } catch (error) {
      const { message, action } = getCompanionError(error);
      setNotice(message);
      if (action === 'exit') refreshToday();
    } finally {
      setPending(null);
    }
  };

  // [테스트 계정만] 고른 시간대의 고정 질문으로 시작한다. 테스트 푸시로 들어왔으면 주소의 시간대를 지운다
  const handleOpenTest = async (slot: string) => {
    if (pending) return;
    setPending('open');
    setTestNotice(null);
    setNotice(null);
    try {
      const session = await openWardCompanionTestSession(slot);
      if (!session) throw new Error('빈 응답');
      if (pushedTestSlot) router.replace('/ward/companion');
      startTalk(session, true);
    } catch (error) {
      setTestNotice(getCompanionError(error).message);
    } finally {
      setPending(null);
    }
  };

  const handleSendTestPrompt = async () => {
    if (pending) return;
    setPending('prompt');
    setTestNotice(null);
    try {
      await sendWardCompanionTestPrompt(testSlot);
      setTestNotice(`${formatSlotTime(testSlot)} 안부 알림을 보냈어요. 잠시 뒤 알림이 와요.`);
    } catch (error) {
      setTestNotice(getCompanionError(error).message);
    } finally {
      setPending(null);
    }
  };

  const handleVoice = () => {
    if (pending) return;
    companionVoice.stop();
    setNotice(null);
    voice.clearNotice();
    voice.toggle();
  };


  const closeTalk = () => {
    companionVoice.reset();
    camera.cancel();
    releasePhotos();
    setTalk(null);
    setNotice(null);
    refreshToday();
  };

  if (talk) {
    const thinking = pending === 'reply' || voice.state === 'uploading';
    const busy = Boolean(pending) || voice.state === 'uploading';
    const recording = voice.state === 'recording';
    // 녹음 중에는 안내 줄을 두지 않는다 - 버튼의 "듣고 있어요"로 충분하다(2026-11-23 사용자 요청으로 문구 삭제)
    // 마이크를 쓸 수 없으면 말벗 문구로 바꾸고 [홈으로]를 둔다 - 글 칸이 없어 막다른 화면이 되던 것(FE 디자인 점검 D-1)
    const voiceNotice = companionVoiceNotice(voice.notice);
    const voiceBlock = notice ? null : voiceNotice.block;
    const message = recording ? null : (notice ?? voiceNotice.message);

    // 2026-11-23 사용자 결정: 판정 결과 칸(테스트용)·글로 대답하기·대화 그만하기를 없앴다. 대화는 서버가 정한 턴을 마치면 끝난다.
    // 얼굴은 내 말풍선 옆(I안) - 말벗 얼굴(복숭아)이 왼쪽에 있듯 녹음 중에는 오른쪽 "말씀하시는 중" 줄에 실시간 얼굴,
    // 보낸 뒤에는 그 대답 옆에 마지막 사진을 남긴다
    return (
      <div className={cx('talkPage')}>
        <div className={cx('talkMain')}>
          <header className={cx('talkHead')}>
            <div className={cx('talkHeadText')}>
              <span className={cx('talkSlot')}>{formatSlotTime(talk.slot)} 안부</span>
              {talk.test && <span className={cx('testBadge', 'small')}>테스트</span>}
            </div>
            {/* 최대 턴 수를 모르면(null) 숫자처럼 점도 그리지 않는다. 숫자는 읽기용 문장(talkTurns)으로 읽힌다 */}
            {talk.maxTurns !== null && (
              <div className={cx('talkProgress')}>
                <ProgressDots total={talk.maxTurns} done={talk.ended ? talk.maxTurns : Math.min(talk.turns, talk.maxTurns)} />
                {!talk.ended && (
                  <>
                    <span className={cx('progressCount')} aria-hidden="true">{Math.min(talk.turns + 1, talk.maxTurns)} / {talk.maxTurns}</span>
                    <span className={cx('srOnly', 'talkTurns')}>{talk.maxTurns}번 중 {Math.min(talk.turns + 1, talk.maxTurns)}번째 대답</span>
                  </>
                )}
              </div>
            )}
          </header>

          {talk.resumed && <p className={cx('resumed')}>하던 이야기를 이어서 해요.</p>}

          <ol className={cx('lines')} aria-label="안부 대화" aria-live="polite">
            {talk.lines.map(line => (
              <li key={line.id} className={cx('line', line.who)}>
                {line.who === 'companion' ? (
                  <>
                    <span className={cx('lineFace')}><MoodFace mood="happy" size={wide ? 56 : 40} /></span>
                    <div className={cx('bubble')}>
                      <span className={cx('srOnly')}>말벗</span>
                      <Sentences text={line.text} />
                      {companionVoice.blockedLineId === line.id ? (
                        <button className={cx('listenButton', 'blocked')} type="button" onClick={() => companionVoice.replay(line)}>
                          <SpeakerIcon />
                          들려 주세요
                        </button>
                      ) : (
                        (canSpeak() || companionVoice.hasAudio(line.id)) && (
                          <button className={cx('listenButton')} type="button" onClick={() => companionVoice.replay(line)}>
                            <SpeakerIcon />
                            다시 듣기
                          </button>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={cx('bubble')}>
                      <span className={cx('who')}>{line.heard ? '이렇게 들었어요' : '나'}</span>
                      <p>{line.text}</p>
                    </div>
                    {line.photo && (
                      <span className={cx('lineFace', 'myFace')}>
                        {/* 화면 메모리의 blob URL이라 next/image 최적화(서버 경유)를 쓸 수 없고 써서도 안 된다 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={line.photo} alt="대답할 때 찍힌 내 얼굴" />
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
            {recording && (
              <li className={cx('line', 'me', 'speaking')} role="status">
                <div className={cx('bubble')}>
                  <p>말씀하시는 중<span className={cx('dots')} aria-hidden="true"><i /><i /><i /></span></p>
                </div>
                <MirrorFace stream={camera.stream} listening />
              </li>
            )}
            {thinking && (
              <li className={cx('line', 'companion', 'thinking')} role="status">
                <span className={cx('lineFace')}><MoodFace mood="calm" size={wide ? 56 : 40} /></span>
                <div className={cx('bubble')}>
                  <p>말벗이 생각하고 있어요<span className={cx('dots')} aria-hidden="true"><i /><i /><i /></span></p>
                </div>
              </li>
            )}
          </ol>

          {talk.ended ? (
            <section ref={endCardRef} className={cx('endCard')} aria-labelledby="companion-end-title">
              <MoodFace mood="happy" size={wide ? 96 : 72} />
              <h2 id="companion-end-title">오늘도 이야기 나눠 주셔서<br />고마워요</h2>
              <p>시간이 되면 또 알려 드릴게요.</p>
              <button className={cx('primaryButton')} type="button" onClick={closeTalk}>{testMode ? '처음 화면으로' : '홈으로'}</button>
            </section>
          ) : (
            <section className={cx('answer')} aria-label="대답하기">
              {message && <p className={cx('notice')} role="alert">{message}</p>}
              {voiceBlock && (
                <Link className={cx('primaryButton', 'secondary', 'voiceHome')} href="/ward">홈으로</Link>
              )}
              {/* 이 기기에서 목소리를 쓸 수 없으면(미지원) 다시 눌러도 소용없어 말하기 버튼을 숨긴다(2026-11-23 사용자 결정) */}
              {voiceBlock !== 'unsupported' && (
              <button
                  className={cx('micButton', { recording })}
                  type="button"
                  disabled={busy && !recording}
                  aria-pressed={recording}
                  // 녹음 중에는 AI 의료 챗봇과 같이 깜박이는 점 + "듣고 있어요"를 보인다(2026-11-23 사용자 요청 - 초 숫자는 뜻이 안 와닿았다)
                  // 화면 읽기 프로그램에는 누르는 뜻을 함께 알린다
                  aria-label={recording ? '듣고 있어요. 다 했어요 누르기' : undefined}
                  onClick={handleVoice}
                >
                  {recording ? <span className={cx('listeningDot')} aria-hidden="true" /> : !thinking && <MicIcon />}
                  {recording ? '듣고 있어요' : thinking ? '보내는 중…' : '말로 대답하기'}
              </button>
              )}
            </section>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  return (
    <div className={cx('page')}>
      {consentAsk ? (
        <ConsentCard
          notice={consent.data?.notice ?? []}
          retentionDays={consent.data?.retentionDays ?? 30}
          saving={consentSaving}
          error={consentError}
          onChoose={agree => void handleConsentChoice(agree)}
        />
      ) : (
        <>
          {testEntrySlot && (
            <section className={cx('testPanel', 'testEntry')} aria-labelledby="companion-test-entry-title">
              <h2 id="companion-test-entry-title">
                <span className={cx('testBadge')}>테스트</span>
                {formatSlotTime(testEntrySlot)} 안부 알림으로 오셨어요
              </h2>
              <button className={cx('startButton')} type="button" disabled={Boolean(pending)} onClick={() => void withConsent(() => void handleOpenTest(testEntrySlot))}>
                <Icon name="messageCircle" size={34} decorative />
                {pending === 'open' ? '여는 중…' : `${formatSlotTime(testEntrySlot)} 대화 시작`}
              </button>
            </section>
          )}
          {!hideTodayBanner && <TodayPanel today={today.data} isLoading={today.isLoading} isError={today.isError} notice={notice} opening={pending === 'open'} onOpen={() => void withConsent(() => void handleOpen())} onRetry={() => void today.refetch()} />}
          {testMode && (
            <section className={cx('testStart', { wide })} aria-label="안부 말벗 테스트">
              <div className={cx('testHero')}>
                <span className={cx('testBadge', 'heroBadge')}>테스트</span>
                <div className={cx('heroHead')}>
                  <MoodFace mood="happy" size={wide ? 160 : 88} />
                  <div>
                    <span className={cx('heroLabel')}>말벗</span>
                    <h2 id="companion-test-title" className={cx('heroTitle')}>안부 말벗</h2>
                  </div>
                </div>
                <div className={cx('greetingBubble')}>
                  <span className={cx('greetingLabel')}>{formatSlotTime(testSlot)} 안부 인사</span>
                  <Sentences text={`안녕하세요. ${formatSlotTime(testSlot)} 안부 인사를 나눠 볼까요?`} />
                </div>
              </div>
              <div className={cx('testPick')}>
                <h3 className={cx('pickTitle')}>시간대</h3>
                <div className={cx('testSlots')} role="group" aria-label="안부 시간대">
                  {TEST_SLOTS.map(slot => {
                    const [period, hour] = splitSlotLabel(formatSlotTime(slot));
                    return (
                      <button key={slot} type="button" className={cx('testSlot', { selected: slot === testSlot })} aria-label={formatSlotTime(slot)} aria-pressed={slot === testSlot} onClick={() => setTestSlot(slot)}>
                        {period && <span className={cx('slotPeriod')} aria-hidden="true">{period}</span>}
                        <span aria-hidden="true">{hour}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={cx('pickSpacer')} />
                <button className={cx('startButton')} type="button" disabled={Boolean(pending)} onClick={() => void withConsent(() => void handleOpenTest(testSlot))}>
                  <MicIcon />
                  {pending === 'open' ? '여는 중…' : '바로 이야기하기'}
                </button>
                <button className={cx('promptButton')} type="button" disabled={Boolean(pending)} onClick={() => void handleSendTestPrompt()}>
                  <Icon name="bell" size={28} decorative />
                  {pending === 'prompt' ? '보내는 중…' : '안부 알림 받아 보기'}
                </button>
                {testNotice && <p className={cx('notice')} role="status">{testNotice}</p>}
                <p className={cx('mediaPrivacy')}>
                  <Icon name="lock" size={18} decorative />
                  {MEDIA_PRIVACY_TEXT}
                </p>
              </div>
            </section>
          )}
        </>
      )}
      {/* 테스트 시작 칸은 자체 안내(MEDIA_PRIVACY_TEXT)를 둔다 */}
      {!(testMode && !consentAsk) && (
        <p className={cx('privacy')}>{consent.data?.consented ? privacySharedText(consent.data.retentionDays) : PRIVACY_TEXT}</p>
      )}
    </div>
  );
}

function TodayPanel({ today, isLoading, isError, notice, opening, onOpen, onRetry }: {
  today: IWardCompanionToday | null | undefined;
  isLoading: boolean;
  isError: boolean;
  notice: string | null;
  opening: boolean;
  onOpen: () => void;
  onRetry: () => void;
}) {
  if (isLoading) return <p className={cx('stateText')} role="status">오늘 안부 대화를 불러오는 중이에요.</p>;
  if (isError || !today) {
    return (
      <div className={cx('stateText')} role="alert">
        <p>오늘 안부 대화를 불러오지 못했어요.</p>
        <button className={cx('primaryButton')} type="button" onClick={onRetry}>다시 불러오기</button>
      </div>
    );
  }

  // 대화 시간 밖: 일반 피보호자는 홈으로 돌아간다(위 outsideTalkTime). 대화가 끊긴 안내만 남기고 시간표·다음 시간은 보이지 않는다.
  const openSlot = openCompanionSlot(today);
  if (!openSlot) {
    if (!notice) return null;
    return (
      <section className={cx('hero')} aria-label="안부 대화 안내">
        <p className={cx('notice')} role="alert">{notice}</p>
        <Link className={cx('primaryButton')} href="/ward">홈으로</Link>
      </section>
    );
  }

  const current = today.slots.find(slot => slot.slot === openSlot);
  const inProgress = current?.status === 'IN_PROGRESS';

  return (
    <section className={cx('hero', 'open')} aria-labelledby="companion-hero-title">
      {/* 제목·부제를 한 덩어리로 - 테스트 화면에서 띠를 한 줄로 줄일 때 버튼만 옆·아래로 옮긴다(#313 점검 L-1) */}
      <div className={cx('heroText')}>
        <h2 id="companion-hero-title">
          {inProgress ? '이야기하던 안부 대화가 있어요' : `${formatSlotTime(openSlot)} 안부 인사 시간이에요`}
        </h2>
        <p>{inProgress ? '이어서 이야기해 주세요.' : '말벗에게 오늘 이야기를 들려주세요.'}</p>
      </div>
      <button className={cx('startButton')} type="button" disabled={opening} onClick={onOpen}>
        <Icon name="messageCircle" size={34} decorative />
        {opening ? '여는 중…' : inProgress ? '이어서 이야기하기' : '이야기 시작하기'}
      </button>
      {notice && <p className={cx('notice')} role="alert">{notice}</p>}
    </section>
  );
}

// 질문·말벗 문장은 문장마다 줄을 나눈다. 문장 사이 공백을 남겨 읽기 프로그램·복사 때 이어 읽힌다
function Sentences({ text }: { text: string }) {
  const sentences = splitSentences(text);
  return (
    <p className={cx('sentences')}>
      {sentences.map((sentence, index) => (
        <span key={index} className={cx('sentence')}>
          {index > 0 && ' '}
          {sentence}
        </span>
      ))}
    </p>
  );
}

// 대답 진행 - 점은 그림이고 숫자는 옆 글(talkTurns)이 읽힌다
function ProgressDots({ total, done }: { total: number; done: number }) {
  return (
    <span className={cx('progressDots')} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={cx({ filled: index < done, current: index === done })} />
      ))}
    </span>
  );
}

// 녹음 중 내 말풍선 옆 실시간 얼굴(2026-11-23 I안) - 듣는 동안 테두리가 빨갛게 깜박여 지금 찍히고 듣고 있다는 것을
// 본인이 알 수 있다. 카메라가 켜지기 전(권한 묻는 중·거부)에는 카메라 그림만 둔다
function MirrorFace({ stream, listening }: { stream: MediaStream | null; listening: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play?.()?.catch?.(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <figure className={cx('mirror', { listening, live: Boolean(stream) })}>
      {stream ? (
        <video ref={videoRef} muted playsInline aria-label="내 얼굴 미리보기" />
      ) : (
        <span className={cx('mirrorIdle')} aria-hidden="true"><CameraIcon /></span>
      )}
      <figcaption className={cx('srOnly')}>{stream ? '카메라 켜짐' : '말하는 동안 여기에 얼굴이 보여요'}</figcaption>
    </figure>
  );
}
// 첫 대화 전 한 번 묻는 대화 내용 공유 동의 - 고지 항목은 서버 문구 그대로
function ConsentCard({ notice, retentionDays, saving, error, onChoose }: {
  notice: string[];
  retentionDays: number;
  saving: boolean;
  error: string | null;
  onChoose: (agree: boolean) => void;
}) {
  return (
    <section className={cx('consentCard')} aria-labelledby="companion-consent-title">
      <MoodFace mood="happy" size={88} />
      <h2 id="companion-consent-title">안부 대화 내용을 가족에게 보여 줄까요?</h2>
      <p>보여 주시면 연결된 가족이 나눈 이야기를 볼 수 있어요. {retentionDays}일 뒤에는 지워져요.</p>
      {notice.length > 0 && (
        <ul className={cx('consentNotice')} aria-label="개인정보 수집·이용 안내">
          {notice.map(item => <li key={item}>{item}</li>)}
        </ul>
      )}
      {error && <p className={cx('notice')} role="alert">{error}</p>}
      <div className={cx('consentActions')}>
        <button className={cx('primaryButton')} type="button" disabled={saving} onClick={() => onChoose(true)}>
          {saving ? '저장하는 중…' : '보여 줄게요'}
        </button>
        <button className={cx('primaryButton', 'secondary')} type="button" disabled={saving} onClick={() => onChoose(false)}>
          보여 주지 않을게요
        </button>
      </div>
      <p className={cx('consentHint')}>환경설정에서 언제든 바꿀 수 있어요.</p>
    </section>
  );
}

function SpeakerIcon() {
  return (
    <svg className={cx('speakerIcon')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className={cx('micIcon')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className={cx('cameraIcon')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
