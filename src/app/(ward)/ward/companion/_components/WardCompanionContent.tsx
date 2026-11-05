'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { useVoiceInput } from '@/components/chatbot/useVoiceInput';
import { canSpeak, speak, stopSpeaking } from '@/lib/audio/speech';
import {
  finishWardCompanionSession,
  openWardCompanionSession,
  replyWardCompanionAudio,
  replyWardCompanionText,
} from '@/service/api/ward/companion';
import type { CompanionSlotStatus } from '@/service/interface/guardian/companion';
import type { IWardCompanionReply, IWardCompanionToday } from '@/service/interface/ward/companion';
import { wardCompanionTodayQueryKey, wardCompanionTodayQueryOptions } from '@/service/query/ward';
import { getCompanionError } from '@/utils/companion/companionError';
import { formatSlotTime } from '@/utils/format/slotTime';
import styles from './WardCompanionContent.module.css';

const cx = classNames.bind(styles);

const MAX_ANSWER_LENGTH = 500;

const STATUS_LABEL: Record<CompanionSlotStatus, string> = {
  DONE: '마쳤어요',
  AVAILABLE: '지금',
  IN_PROGRESS: '이야기 중',
  MISSED: '지나갔어요',
  UPCOMING: '예정',
};

type Line = { id: number; who: 'companion' | 'me'; text: string; heard?: boolean };

// 대답·말벗 응답은 이 화면 메모리에만 둔다 - 서버도 저장하지 않으니 localStorage·로그에 남기지 않는다
type Talk = { sessionId: number; slot: string; maxTurns: number | null; resumed: boolean; turns: number; lines: Line[]; ended: boolean };

type Pending = 'open' | 'reply' | 'finish' | null;

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

  // 대화하는 동안에는 현황을 다시 받을 일이 없다. 대화 밖에서는 시간대가 바뀌면 시작 버튼이 열리도록 1분마다 받는다
  const today = useQuery({ ...wardCompanionTodayQueryOptions, refetchInterval: talk ? false : 60_000 });

  useEffect(() => stopSpeaking, []);

  // 새 말이 붙으면 대답 버튼까지 보이게 아래로 내린다 - 대화가 길어지면 버튼이 화면 밖으로 밀린다
  const bottomRef = useRef<HTMLDivElement>(null);
  const lineCount = talk?.lines.length ?? 0;
  const ended = talk?.ended ?? false;
  useEffect(() => {
    if (lineCount > 1 || ended) bottomRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [lineCount, ended]);

  const nextLine = (who: Line['who'], text: string, heard?: boolean): Line => ({ id: ++lineId.current, who, text, heard });

  const refreshToday = useCallback(() => void queryClient.invalidateQueries({ queryKey: wardCompanionTodayQueryKey }), [queryClient]);

  // 이어갈 수 없는 대화는 닫고 오늘 현황을 다시 받는다
  const leaveTalk = useCallback((message: string) => {
    stopSpeaking();
    setTalk(null);
    setDraft('');
    setNotice(message);
    refreshToday();
  }, [refreshToday]);

  const handleError = useCallback((error: unknown) => {
    const { message, action } = getCompanionError(error);
    if (action === 'exit') {
      leaveTalk(message);
      return;
    }
    if (action === 'text') setMode('text');
    setNotice(message);
  }, [leaveTalk]);

  const applyReply = useCallback((result: IWardCompanionReply | null, answer: string, heard: boolean) => {
    if (!result) return;
    setTalk(current => {
      if (!current) return current;
      const lines = [...current.lines, nextLine('me', answer, heard)];
      if (result.reply) lines.push(nextLine('companion', result.reply));
      return { ...current, turns: result.turnNo, lines, ended: result.ended };
    });
    if (result.reply) speak(result.reply);
    if (result.ended) refreshToday();
  }, [refreshToday]);

  const voiceOptions = useMemo(() => ({
    send: (audio: Blob, signal: AbortSignal) => {
      const current = talkRef.current;
      if (!current) return Promise.reject(new Error('대화가 열려 있지 않다'));
      return replyWardCompanionAudio(current.sessionId, audio, signal);
    },
    onError: handleError,
  }), [handleError]);

  const voice = useVoiceInput<IWardCompanionReply | null>(
    result => applyReply(result, result?.transcript?.trim() || '말로 대답했어요', Boolean(result?.transcript?.trim())),
    voiceOptions,
  );

  const handleOpen = async () => {
    if (pending) return;
    setPending('open');
    setNotice(null);
    try {
      const session = await openWardCompanionSession();
      if (!session) throw new Error('빈 응답');
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
      });
      speak(session.question);
    } catch (error) {
      const { message, action } = getCompanionError(error);
      setNotice(message);
      if (action === 'exit') refreshToday();
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
    stopSpeaking();
    setNotice(null);
    voice.clearNotice();
    voice.toggle();
  };

  const handleFinish = async () => {
    if (!talk || pending) return;
    voice.cancel();
    stopSpeaking();
    setPending('finish');
    setNotice(null);
    try {
      await finishWardCompanionSession(talk.sessionId);
      setTalk(current => (current ? { ...current, ended: true } : current));
      refreshToday();
    } catch (error) {
      handleError(error);
    } finally {
      setPending(null);
    }
  };

  const closeTalk = () => {
    stopSpeaking();
    setTalk(null);
    setNotice(null);
    refreshToday();
  };

  if (talk) {
    const thinking = pending === 'reply' || voice.state === 'uploading';
    const busy = Boolean(pending) || voice.state === 'uploading';
    const recording = voice.state === 'recording';
    const message = recording ? '말씀하세요. 다 하셨으면 다시 눌러 주세요.' : (notice ?? voice.notice);

    return (
      <div className={cx('page')}>
        <header className={cx('talkHead')}>
          <div>
            <span className={cx('talkSlot')}>{formatSlotTime(talk.slot)} 안부 대화</span>
            {talk.maxTurns !== null && !talk.ended && (
              <span className={cx('talkTurns')}>{talk.maxTurns}번 중 {Math.min(talk.turns + 1, talk.maxTurns)}번째 대답</span>
            )}
          </div>
          {!talk.ended && (
            <button className={cx('stopButton')} type="button" disabled={busy} onClick={() => void handleFinish()}>
              {pending === 'finish' ? '마치는 중…' : '그만하기'}
            </button>
          )}
        </header>

        {talk.resumed && <p className={cx('resumed')}>하던 이야기를 이어서 해요.</p>}

        <ol className={cx('lines')} aria-label="안부 대화" aria-live="polite">
          {talk.lines.map(line => (
            <li key={line.id} className={cx('line', line.who)}>
              {line.who === 'companion' ? (
                <>
                  <span className={cx('who')}>말벗</span>
                  <p>{line.text}</p>
                  {canSpeak() && (
                    <button className={cx('listenButton')} type="button" onClick={() => speak(line.text)}>
                      <SpeakerIcon />
                      다시 듣기
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className={cx('who')}>{line.heard ? '이렇게 들었어요' : '나'}</span>
                  <p>{line.text}</p>
                </>
              )}
            </li>
          ))}
          {thinking && (
            <li className={cx('line', 'companion', 'thinking')} role="status">
              <span className={cx('who')}>말벗</span>
              <p>말벗이 생각하고 있어요<span className={cx('dots')} aria-hidden="true"><i /><i /><i /></span></p>
            </li>
          )}
        </ol>

        {talk.ended ? (
          <section className={cx('endCard')} aria-labelledby="companion-end-title">
            <h2 id="companion-end-title">오늘도 이야기 나눠 주셔서 고마워요</h2>
            <NextSlotText today={today.data} />
            <button className={cx('primaryButton')} type="button" onClick={closeTalk}>처음 화면으로</button>
          </section>
        ) : (
          <section className={cx('answer')} aria-label="대답하기">
            {message && <p className={cx('notice', { recordingNotice: recording })} role={recording ? undefined : 'alert'}>{message}</p>}
            {mode === 'voice' ? (
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
            <button
              className={cx('switchButton')}
              type="button"
              disabled={busy || recording}
              onClick={() => { setNotice(null); voice.clearNotice(); setMode(mode === 'voice' ? 'text' : 'voice'); }}
            >
              {mode === 'voice' ? '글로 대답하기' : '말로 대답하기'}
            </button>
          </section>
        )}
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    <div className={cx('page')}>
      <TodayPanel today={today.data} isLoading={today.isLoading} isError={today.isError} notice={notice} opening={pending === 'open'} onOpen={() => void handleOpen()} onRetry={() => void today.refetch()} />
      <p className={cx('privacy')}>대답한 말과 목소리는 저장하지 않아요.</p>
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

  const current = today.currentSlot ? today.slots.find(slot => slot.slot === today.currentSlot) : undefined;
  const inProgress = current?.status === 'IN_PROGRESS';

  return (
    <>
      <section className={cx('hero', { open: Boolean(today.currentSlot) })} aria-labelledby="companion-hero-title">
        {today.currentSlot ? (
          <>
            <h2 id="companion-hero-title">
              {inProgress ? '이야기하던 안부 대화가 있어요' : `${formatSlotTime(today.currentSlot)} 안부 인사 시간이에요`}
            </h2>
            <p>{inProgress ? '이어서 이야기해 주세요.' : '말벗에게 오늘 이야기를 들려주세요.'}</p>
            <button className={cx('startButton')} type="button" disabled={opening} onClick={onOpen}>
              <Icon name="messageCircle" size={34} decorative />
              {opening ? '여는 중…' : inProgress ? '이어서 이야기하기' : '이야기 시작하기'}
            </button>
          </>
        ) : (
          <>
            <h2 id="companion-hero-title">
              {today.slots.some(slot => slot.status === 'UPCOMING') ? '지금은 안부 대화 시간이 아니에요' : '오늘 안부 대화는 모두 끝났어요'}
            </h2>
            <NextSlotText today={today} />
          </>
        )}
        {notice && <p className={cx('notice')} role="alert">{notice}</p>}
      </section>

      <section className={cx('slots')} aria-labelledby="companion-slots-title">
        <h2 id="companion-slots-title" className={cx('slotsTitle')}>오늘 안부 시간</h2>
        <ul>
          {today.slots.map(slot => (
            <li key={slot.slot} className={cx('slot', slot.status.toLowerCase())}>
              <strong>{formatSlotTime(slot.slot)}</strong>
              <span>{STATUS_LABEL[slot.status]}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// 다음에 열리는 시간대 - 없으면 내일 첫 시간대
function NextSlotText({ today }: { today: IWardCompanionToday | null | undefined }) {
  if (!today || today.slots.length === 0) return null;
  const next = today.slots.find(slot => slot.status === 'UPCOMING');
  if (next) return <p>다음 안부는 {formatSlotTime(next.slot)}예요. 시간이 되면 알려 드릴게요.</p>;
  return <p>내일 {formatSlotTime(today.slots[0].slot)}에 다시 만나요.</p>;
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
