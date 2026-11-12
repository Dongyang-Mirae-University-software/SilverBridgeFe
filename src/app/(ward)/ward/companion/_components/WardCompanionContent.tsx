'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { MoodFace } from '@/components/MoodFace';
import { useVoiceInput } from '@/components/chatbot/useVoiceInput';
import { canSpeak, speak, stopSpeaking } from '@/lib/audio/speech';
import { useFaceFrames } from '@/lib/camera/useFaceFrames';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  finishWardCompanionSession,
  openWardCompanionSession,
  openWardCompanionTestSession,
  replyWardCompanionAudio,
  replyWardCompanionText,
  sendWardCompanionTestPrompt,
  updateWardCompanionTranscriptConsent,
} from '@/service/api/ward/companion';
import type {
  IWardCompanionFinish,
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
import { formatResultAnalysis, formatTurnAnalysis } from '@/utils/companion/companionAnalysis';
import { COMPANION_MESSAGES, getCompanionError, isCompanionFrameError } from '@/utils/companion/companionError';
import { openCompanionSlot } from '@/utils/companion/companionOpen';
import { markConsentAsked, readConsentAsked } from '@/utils/companion/consentAsked';
import { splitSentences } from '@/utils/companion/splitSentences';
import { formatSlotTime } from '@/utils/format/slotTime';
import styles from './WardCompanionContent.module.css';

const cx = classNames.bind(styles);

const MAX_ANSWER_LENGTH = 500;

// 테스트 계정이 고를 수 있는 시간대 - 서버 시간대와 같다
const TEST_SLOTS = ['09:00', '12:00', '15:00', '18:00', '21:00'];

// 사진 합계를 audio와 더해 서버 상한(10MB) 아래로 둔다 - multipart 머리 몫을 남긴다
const UPLOAD_BUDGET_BYTES = 9.5 * 1024 * 1024;

export const CAMERA_CONSENT_TEXT = '대답하실 때 얼굴 사진도 함께 보낼게요. 표정은 기분을 살피는 데만 쓰고 저장하지 않아요.';
export const CAMERA_UNAVAILABLE_TEXT = '카메라를 쓸 수 없어 목소리만 보낼게요.';
export const PRIVACY_TEXT = '대답한 말과 목소리, 얼굴 사진은 저장하지 않아요.';
// 보관 일수는 서버 설정값(retentionDays)을 쓴다
export function privacySharedText(retentionDays: number) {
  return `대답한 말은 가족이 볼 수 있게 ${retentionDays}일 동안 보관해요. 목소리와 얼굴 사진은 저장하지 않아요.`;
}

// 태블릿 이상은 왼쪽 대화 · 오른쪽 카메라·판정 두 칸
const WIDE_QUERY = '(min-width: 1024px)';


// 처음 대답할 때 한 번 묻는다. 선택은 이 화면 메모리에만 둔다(다시 들어오면 다시 묻는다, 권한 창은 브라우저가 기억)
type CameraChoice = 'ask' | 'on' | 'off';

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

type Line = { id: number; who: 'companion' | 'me'; text: string; heard?: boolean };

// 대답·말벗 응답·테스트 판정 결과는 이 화면 메모리에만 둔다 - 서버도 저장하지 않으니 localStorage·로그에 남기지 않는다
type Talk = {
  sessionId: number;
  slot: string;
  maxTurns: number | null;
  resumed: boolean;
  turns: number;
  lines: Line[];
  ended: boolean;
  test: boolean;
  results: { id: number; text: string }[];
};

type Pending = 'open' | 'reply' | 'finish' | 'prompt' | null;

export function WardCompanionContent() {
  const queryClient = useQueryClient();
  const [talk, setTalk] = useState<Talk | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [draft, setDraft] = useState('');
  const lineId = useRef(0);
  const talkRef = useRef<Talk | null>(null);
  useEffect(() => {
    talkRef.current = talk;
  }, [talk]);

  const camera = useFaceFrames();
  // 화면에 그리는 값이 아니라 녹음 시작·전송 때만 읽는다
  const cameraChoiceRef = useRef<CameraChoice>('ask');
  const [askCamera, setAskCamera] = useState(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const sentFramesRef = useRef(0);
  const chooseCamera = useCallback((choice: CameraChoice) => {
    cameraChoiceRef.current = choice;
  }, []);

  const wide = useMediaQuery(WIDE_QUERY);

  // 대화 내용 공유 동의 - 첫 대화 시작 전에 한 번 묻는다. 상태를 아직 못 받았으면 받아 본 뒤 판단하고(L-2),
  // 끝내 못 받으면 묻지 않고 대화를 막지 않는다
  const consent = useQuery(wardCompanionConsentQueryOptions);
  const [consentAsk, setConsentAsk] = useState<(() => void) | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const withConsent = async (start: () => void) => {
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
  const [testSlot, setTestSlot] = useState(TEST_SLOTS[0]);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  // 대화하는 동안에는 현황을 다시 받을 일이 없다. 대화 밖에서는 시간대가 바뀌면 시작 버튼이 열리도록 1분마다 받는다
  const today = useQuery({ ...wardCompanionTodayQueryOptions, refetchInterval: talk ? false : 60_000 });
  const testMode = today.data?.testMode === true;
  const testEntrySlot = testMode && pushedTestSlot && TEST_SLOTS.includes(pushedTestSlot) ? pushedTestSlot : null;
  // 피보호자는 말벗 시간표를 알 필요가 없다 - 대화 시간 밖에 들어오면 안내 없이 홈으로(2026-11-11 사용자 결정).
  // 이미 마친 시간대도 시간 밖으로 본다(openCompanionSlot - 2026-11-11 기능 점검 F-1).
  // 대화 중(마친 화면 포함)·여는 중(F-3)·테스트 계정·불러오는 중·오류·남길 안내(대화가 끊긴 이유)가 있을 때는 머문다.
  const outsideTalkTime =
    !talk && !pending && !notice && today.data != null && !testMode && openCompanionSlot(today.data) === null;
  useEffect(() => {
    if (outsideTalkTime) router.replace('/ward');
  }, [outsideTalkTime, router]);

  useEffect(() => stopSpeaking, []);

  // 새 말이 붙으면 대답 버튼까지 보이게 아래로 내린다 - 대화가 길어지면 버튼이 화면 밖으로 밀린다
  const bottomRef = useRef<HTMLDivElement>(null);
  const lineCount = talk?.lines.length ?? 0;
  const ended = talk?.ended ?? false;
  useEffect(() => {
    if (lineCount > 1 || ended) bottomRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [lineCount, ended]);

  const nextLine = (who: Line['who'], text: string, heard?: boolean): Line => ({ id: ++lineId.current, who, text, heard });
  const nextResult = (text: string) => ({ id: ++lineId.current, text });

  const refreshToday = useCallback(() => void queryClient.invalidateQueries({ queryKey: wardCompanionTodayQueryKey }), [queryClient]);

  // 이어갈 수 없는 대화는 닫고 오늘 현황을 다시 받는다
  const leaveTalk = useCallback((message: string) => {
    stopSpeaking();
    camera.cancel();
    setTalk(null);
    setDraft('');
    setNotice(message);
    refreshToday();
  }, [refreshToday, camera]);

  const handleError = useCallback((error: unknown) => {
    const { message, action } = getCompanionError(error);
    if (action === 'exit') {
      leaveTalk(message);
      return;
    }
    if (action === 'text') setMode('text');
    setNotice(message);
  }, [leaveTalk]);

  // [테스트 계정만] 마친 대화의 판정을 결과 칸에 붙인다
  const addFinishResult = useCallback((result: IWardCompanionFinish | null | undefined) => {
    const analysis = result?.analysis;
    if (!analysis) return;
    setTalk(current => (current ? { ...current, results: [...current.results, nextResult(formatResultAnalysis(analysis))] } : current));
  }, []);

  const applyReply = useCallback((result: IWardCompanionReply | null, answer: string, heard: boolean) => {
    if (!result) return;
    setCameraNotice(null);
    setTalk(current => {
      if (!current) return current;
      const lines = [...current.lines, nextLine('me', answer, heard)];
      if (result.reply) lines.push(nextLine('companion', result.reply));
      const results = result.analysis ? [...current.results, nextResult(formatTurnAnalysis(result.turnNo, result.analysis))] : current.results;
      return { ...current, turns: result.turnNo, lines, ended: result.ended, results };
    });
    if (result.reply) speak(result.reply);
    if (result.ended) {
      refreshToday();
      // 서버가 대화를 닫았으면 마치기는 부르지 않아도 되지만, 테스트 계정은 저장된 결과를 다시 받아 대화 판정을 보여 준다
      const current = talkRef.current;
      if (result.analysis && current) {
        void finishWardCompanionSession(current.sessionId).then(addFinishResult).catch(() => undefined);
      }
    }
  }, [refreshToday, addFinishResult]);

  const voiceOptions = useMemo(() => ({
    send: async (audio: Blob, signal: AbortSignal) => {
      const current = talkRef.current;
      // 녹음이 끝나는 순간 카메라를 끄고 찍은 사진을 받는다
      const frames = fitUploadBudget(audio, await camera.take());
      sentFramesRef.current = frames.length;
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

  // 녹음이 시작되면 카메라를 켜고(사진을 쓰기로 했을 때만), 녹음이 버려지면 바로 끈다
  // 보낼 때는 send가 먼저 take()로 끈다. 권한 창은 마이크 다음에 뜬다(둘을 따로 물어 카메라를 거부해도 마이크는 그대로)
  const prevVoiceState = useRef(voice.state);
  useEffect(() => {
    const prev = prevVoiceState.current;
    prevVoiceState.current = voice.state;
    if (voice.state === 'idle') {
      camera.cancel();
      return;
    }
    if (voice.state !== 'recording' || prev === 'recording' || cameraChoiceRef.current !== 'on') return;
    void camera.open().then(result => {
      if (result !== 'denied' && result !== 'unsupported') return;
      chooseCamera('off');
      setCameraNotice(CAMERA_UNAVAILABLE_TEXT);
    });
  }, [voice.state, camera, chooseCamera]);

  const startTalk = (session: IWardCompanionSession, test: boolean) => {
    setMode('voice');
    setDraft('');
    setTalk({
      sessionId: session.sessionId,
      slot: session.slot,
      maxTurns: session.maxTurns,
      resumed: session.resumed,
      turns: 0,
      lines: [nextLine('companion', session.question)],
      ended: false,
      test,
      results: [],
    });
    speak(session.question);
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

  const handleSendText = async () => {
    const answer = draft.trim();
    if (!talk || pending || voice.state !== 'idle') return;
    if (!answer) {
      setNotice('대답을 적어 주세요.');
      return;
    }
    stopSpeaking();
    setPending('reply');
    setNotice(null);
    try {
      const result = await replyWardCompanionText(talk.sessionId, answer);
      setDraft('');
      applyReply(result, answer, false);
    } catch (error) {
      // 적은 대답은 지우지 않는다 - 그대로 다시 보낼 수 있게
      handleError(error);
    } finally {
      setPending(null);
    }
  };

  const handleVoice = () => {
    if (pending) return;
    // 처음 대답할 때 사진을 함께 보낼지 먼저 묻는다
    if (voice.state === 'idle' && cameraChoiceRef.current === 'ask') {
      stopSpeaking();
      setAskCamera(true);
      return;
    }
    stopSpeaking();
    setNotice(null);
    voice.clearNotice();
    voice.toggle();
  };

  // 안내 카드에서 고른 뒤 바로 녹음을 시작한다(누른 그 동작으로 마이크 권한을 묻는다)
  const handleCameraChoice = (useCamera: boolean) => {
    chooseCamera(useCamera ? 'on' : 'off');
    setAskCamera(false);
    handleVoice();
  };

  const handleFinish = async () => {
    if (!talk || pending) return;
    voice.cancel();
    camera.cancel();
    setAskCamera(false);
    stopSpeaking();
    setPending('finish');
    setNotice(null);
    try {
      const result = await finishWardCompanionSession(talk.sessionId);
      setTalk(current => (current ? { ...current, ended: true } : current));
      addFinishResult(result);
      refreshToday();
    } catch (error) {
      handleError(error);
    } finally {
      setPending(null);
    }
  };

  const closeTalk = () => {
    stopSpeaking();
    camera.cancel();
    setAskCamera(false);
    setTalk(null);
    setNotice(null);
    refreshToday();
  };

  if (talk) {
    const thinking = pending === 'reply' || voice.state === 'uploading';
    const busy = Boolean(pending) || voice.state === 'uploading';
    const recording = voice.state === 'recording';
    const message = recording ? '말씀하세요. 다 하셨으면 다시 눌러 주세요.' : (notice ?? voice.notice);
    const stopButton = !talk.ended && (
      <button className={cx('stopButton')} type="button" disabled={busy} onClick={() => void handleFinish()}>
        {pending === 'finish' ? '마치는 중…' : '대화 그만하기'}
      </button>
    );

    return (
      <div className={cx('talkPage', { wide })}>
        <div className={cx('talkMain')}>
          <header className={cx('talkHead')}>
            {!wide && camera.stream && <CameraPreview stream={camera.stream} size="small" />}
            <div className={cx('talkHeadText')}>
              <span className={cx('talkSlot')}>
                {formatSlotTime(talk.slot)} 안부 대화
                {talk.test && <span className={cx('testBadge')}>테스트</span>}
              </span>
              {talk.maxTurns !== null && !talk.ended && (
                <span className={cx('talkTurns')}>{talk.maxTurns}번 중 {Math.min(talk.turns + 1, talk.maxTurns)}번째 대답</span>
              )}
            </div>
            {/* 최대 턴 수를 모르면(null) 숫자처럼 점도 그리지 않는다 */}
            {talk.maxTurns !== null && (
              <ProgressDots total={talk.maxTurns} done={talk.ended ? talk.maxTurns : Math.min(talk.turns, talk.maxTurns)} />
            )}
          </header>

          {talk.resumed && <p className={cx('resumed')}>하던 이야기를 이어서 해요.</p>}

          <ol className={cx('lines')} aria-label="안부 대화" aria-live="polite">
            {talk.lines.map(line => (
              <li key={line.id} className={cx('line', line.who)}>
                {line.who === 'companion' ? (
                  <>
                    <span className={cx('lineFace')}><MoodFace mood="happy" size={wide ? 64 : 48} /></span>
                    <div className={cx('bubble')}>
                      <span className={cx('who')}>말벗</span>
                      <Sentences text={line.text} />
                      {canSpeak() && (
                        <button className={cx('listenButton')} type="button" onClick={() => speak(line.text)}>
                          <SpeakerIcon />
                          다시 듣기
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={cx('bubble')}>
                    <span className={cx('who')}>{line.heard ? '이렇게 들었어요' : '나'}</span>
                    <p>{line.text}</p>
                  </div>
                )}
              </li>
            ))}
            {thinking && (
              <li className={cx('line', 'companion', 'thinking')} role="status">
                <span className={cx('lineFace')}><MoodFace mood="calm" size={wide ? 64 : 48} /></span>
                <div className={cx('bubble')}>
                  <span className={cx('who')}>말벗</span>
                  <p>말벗이 생각하고 있어요<span className={cx('dots')} aria-hidden="true"><i /><i /><i /></span></p>
                </div>
              </li>
            )}
          </ol>

          {talk.ended ? (
            <section className={cx('endCard')} aria-labelledby="companion-end-title">
              <h2 id="companion-end-title">오늘도 이야기 나눠 주셔서 고마워요</h2>
              <p>시간이 되면 또 알려 드릴게요.</p>
              <button className={cx('primaryButton')} type="button" onClick={closeTalk}>{testMode ? '처음 화면으로' : '홈으로'}</button>
            </section>
          ) : (
            <section className={cx('answer')} aria-label="대답하기">
              {message && <p className={cx('notice', { recordingNotice: recording })} role={recording ? undefined : 'alert'}>{message}</p>}
              {cameraNotice && <p className={cx('notice')} role="alert">{cameraNotice}</p>}
              {mode === 'voice' && askCamera ? (
                <div className={cx('cameraAsk')} role="group" aria-labelledby="companion-camera-ask">
                  <p id="companion-camera-ask">{CAMERA_CONSENT_TEXT}</p>
                  <button className={cx('primaryButton')} type="button" onClick={() => handleCameraChoice(true)}>좋아요</button>
                  <button className={cx('switchButton')} type="button" onClick={() => handleCameraChoice(false)}>사진 없이 할게요</button>
                </div>
              ) : mode === 'voice' ? (
                <button
                  className={cx('micButton', { recording })}
                  type="button"
                  disabled={busy && !recording}
                  aria-pressed={recording}
                  onClick={handleVoice}
                >
                  {recording ? <span className={cx('recDot')} aria-hidden="true" /> : <MicIcon />}
                  {recording ? `다 했어요 · ${voice.elapsedSec}초` : thinking ? '듣고 있어요…' : '말로 대답하기'}
                </button>
              ) : (
                <form className={cx('textForm')} onSubmit={event => { event.preventDefault(); void handleSendText(); }}>
                  <label className={cx('srOnly')} htmlFor="companion-answer">대답 적기</label>
                  <textarea
                    id="companion-answer"
                    value={draft}
                    maxLength={MAX_ANSWER_LENGTH}
                    rows={3}
                    placeholder="여기에 대답을 적어 주세요"
                    disabled={busy}
                    onChange={event => setDraft(event.target.value)}
                  />
                  <button className={cx('primaryButton')} type="submit" disabled={busy}>
                    {pending === 'reply' ? '보내는 중…' : '보내기'}
                  </button>
                </form>
              )}
              <div className={cx('answerBar')}>
                <button
                  className={cx('switchButton')}
                  type="button"
                  disabled={busy || recording}
                  onClick={() => { setNotice(null); voice.clearNotice(); setAskCamera(false); setMode(mode === 'voice' ? 'text' : 'voice'); }}
                >
                  {mode === 'voice' ? '글로 대답하기' : '말로 대답하기'}
                </button>
                {!wide && stopButton}
              </div>
            </section>
          )}
          {!wide && testMode && <TestResults results={talk.results} compact />}
          <div ref={bottomRef} />
        </div>

        {wide && (
          <aside className={cx('talkSide')} aria-label="카메라와 판정 결과">
            <CameraPanel stream={camera.stream} />
            {testMode && <TestResults results={talk.results} />}
            {stopButton}
          </aside>
        )}
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
          <TodayPanel today={today.data} isLoading={today.isLoading} isError={today.isError} notice={notice} opening={pending === 'open'} onOpen={() => void withConsent(() => void handleOpen())} onRetry={() => void today.refetch()} />
          {testMode && (
            <section className={cx('testStart')} aria-labelledby="companion-test-title">
              <h2 id="companion-test-title" className={cx('testStartTitle')}>
                안부 말벗
                <span className={cx('testBadge', 'small')}>테스트</span>
              </h2>
              <div className={cx('greeting')}>
                <MoodFace mood="happy" size={wide ? 132 : 96} />
                <div className={cx('greetingBubble')}>
                  <Sentences text={`안녕하세요. ${formatSlotTime(testSlot)} 안부 인사를 나눠 볼까요?`} />
                </div>
              </div>
              <div className={cx('testSlots')} role="group" aria-label="안부 시간대">
                {TEST_SLOTS.map(slot => (
                  <button key={slot} type="button" className={cx('testSlot', { selected: slot === testSlot })} aria-pressed={slot === testSlot} onClick={() => setTestSlot(slot)}>
                    {formatSlotTime(slot)}
                  </button>
                ))}
              </div>
              <div className={cx('testActions')}>
                <button className={cx('startButton')} type="button" disabled={Boolean(pending)} onClick={() => void withConsent(() => void handleOpenTest(testSlot))}>
                  <Icon name="messageCircle" size={34} decorative />
                  {pending === 'open' ? '여는 중…' : '바로 이야기하기'}
                </button>
                <button className={cx('primaryButton', 'secondary')} type="button" disabled={Boolean(pending)} onClick={() => void handleSendTestPrompt()}>
                  {pending === 'prompt' ? '보내는 중…' : '안부 알림 받아 보기'}
                </button>
              </div>
              {testNotice && <p className={cx('notice')} role="status">{testNotice}</p>}
            </section>
          )}
        </>
      )}
      <p className={cx('privacy')}>{consent.data?.consented ? privacySharedText(consent.data.retentionDays) : PRIVACY_TEXT}</p>
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
      <h2 id="companion-hero-title">
        {inProgress ? '이야기하던 안부 대화가 있어요' : `${formatSlotTime(openSlot)} 안부 인사 시간이에요`}
      </h2>
      <p>{inProgress ? '이어서 이야기해 주세요.' : '말벗에게 오늘 이야기를 들려주세요.'}</p>
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

// 녹음하는 동안만 보이는 얼굴 미리보기 - 카메라가 켜져 있다는 것을 본인이 알 수 있게
function CameraPreview({ stream, size }: { stream: MediaStream; size: 'small' | 'large' }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play?.()?.catch?.(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <figure className={cx('cameraPreview', size)}>
      <video ref={videoRef} muted playsInline aria-label="내 얼굴 미리보기" />
      <figcaption>카메라 켜짐</figcaption>
    </figure>
  );
}

// [태블릿] 오른쪽 큰 카메라 칸 - 꺼져 있으면 언제 켜지는지만 알린다
function CameraPanel({ stream }: { stream: MediaStream | null }) {
  if (stream) return <CameraPreview stream={stream} size="large" />;
  return (
    <div className={cx('cameraPlaceholder')}>
      <p>말로 대답하는 동안 여기에 얼굴이 보여요</p>
    </div>
  );
}

// [테스트] 턴마다·마치기 뒤 판정 결과 - 화면 메모리에만. 방금 결과는 크게, 지난 결과는 한 줄씩(최근 것부터)
// 폰(compact)은 방금 결과 한 줄만 보이고 눌러서 지난 결과를 편다
function TestResults({ results, compact = false }: { results: { id: number; text: string }[]; compact?: boolean }) {
  const latest = results.at(-1);
  const earlier = results.slice(0, -1).reverse();
  const earlierList = earlier.length > 0 && (
    <ol className={cx('earlierResults')} aria-label="지난 대답 판정">
      {earlier.map(item => <li key={item.id} title={item.text}>{item.text}</li>)}
    </ol>
  );

  if (compact) {
    return (
      <details className={cx('testResults', 'compact')}>
        <summary>
          <h2 id="companion-test-results-title" className={cx('resultsTitle')}>
            판정 결과
            <span className={cx('testBadge', 'small')}>테스트</span>
          </h2>
          <span className={cx('latestLine')} aria-live="polite">{latest ? latest.text : '대답하면 판정 결과가 여기에 나와요.'}</span>
        </summary>
        {earlierList}
      </details>
    );
  }

  return (
    <section className={cx('testResults')} aria-labelledby="companion-test-results-title">
      <h2 id="companion-test-results-title" className={cx('resultsTitle')}>
        판정 결과
        <span className={cx('testBadge', 'small')}>테스트</span>
      </h2>
      {latest ? (
        <div className={cx('latestCard')} aria-live="polite">
          <span className={cx('latestLabel')}>방금 대답</span>
          <p>{latest.text}</p>
        </div>
      ) : (
        <p className={cx('resultsEmpty')}>대답하면 판정 결과가 여기에 나와요.</p>
      )}
      {earlierList}
    </section>
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
