'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { MoodFace } from '@/components/MoodFace';
import { wardCompanionSessionQueryOptions } from '@/service/query/guardian';
import type { CompanionTranscriptState, ICompanionSessionDetail } from '@/service/interface/guardian/companion';
import { splitSentences } from '@/utils/companion/splitSentences';
import { formatSlotTime } from '@/utils/format/slotTime';
import { MOOD_META, UNKNOWN_MOOD, formatDateLabel } from './companionMood';
import styles from './GuardianCompanionSessionContent.module.css';

const cx = classNames.bind(styles);

// 글이 없을 때 안내 - 대화 내용은 어르신 동의가 있을 때만, 보관 기간(서버 설정) 동안만 보인다
export const TRANSCRIPT_HIDDEN_TEXT: Record<Exclude<CompanionTranscriptState, 'AVAILABLE'>, string> = {
  NO_CONSENT: '어르신이 대화 내용 공유에 동의하지 않아 기분만 보여 드려요.',
  EXPIRED: '보관 기간이 지나 대화 내용을 지웠어요. 기분만 보여 드려요.',
};

const STATUS_TEXT: Record<ICompanionSessionDetail['status'], string | null> = {
  OPEN: '아직 대화 중이에요',
  LOST: '대화가 중간에 끊겼어요',
  FINISHED: null,
};

function errorCode(error: unknown) {
  return isAxiosError<{ code?: string }>(error) ? error.response?.data?.code : undefined;
}

export function GuardianCompanionSessionContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const wardId = searchParams?.get('wardId') ?? '';
  const sessionId = Number(params?.sessionId);
  const valid = Boolean(wardId) && Number.isSafeInteger(sessionId) && sessionId > 0;

  const { data, error, isLoading, isError, isFetching, refetch } = useQuery({
    ...wardCompanionSessionQueryOptions(wardId, sessionId),
    enabled: valid,
  });

  const back = (
    <Link className={cx('backLink')} href="/guardian/emotion">
      <span aria-hidden="true">&lt;</span> AI 기분 체크
    </Link>
  );

  if (!valid) {
    return (
      <div className={cx('page')}>
        {back}
        <p className={cx('state')} role="alert">대화를 찾을 수 없어요.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cx('page')}>
        {back}
        <p className={cx('state')} role="status">대화를 불러오는 중이에요.</p>
      </div>
    );
  }

  if (isError || !data) {
    const code = errorCode(error);
    const message =
      code === 'COMPANION_NOT_AUTHORIZED'
        ? '연결된 피보호자의 안부 대화만 볼 수 있습니다.'
        : code === 'COMPANION_SESSION_NOT_FOUND'
          ? '대화를 찾을 수 없어요.'
          : '대화를 불러오지 못했어요.';
    const retryable = code !== 'COMPANION_NOT_AUTHORIZED' && code !== 'COMPANION_SESSION_NOT_FOUND';
    return (
      <div className={cx('page')}>
        {back}
        <div className={cx('state')} role="alert">
          <strong>{message}</strong>
          {retryable && (
            <button className={cx('retryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
              다시 불러오기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cx('page')}>
      {back}
      <SessionSummary session={data} />
      <TurnMoods session={data} />
      <Transcript session={data} />
    </div>
  );
}

function SessionSummary({ session }: { session: ICompanionSessionDetail }) {
  const mood = session.mood ? MOOD_META[session.mood] : null;
  const statusText = STATUS_TEXT[session.status];

  return (
    <section className={cx('card', 'summary')} aria-label="기분 요약">
      {mood ? <MoodFace mood={mood.face} size={84} /> : <span className={cx('unknownFace', 'large')} aria-hidden="true" />}
      <div className={cx('summaryText')}>
        <span className={cx('meta')}>
          {formatDateLabel(session.date)} · {formatSlotTime(session.slot)}
          {session.test && <span className={cx('testBadge')}>테스트</span>}
        </span>
        <strong className={cx('moodLine')}>
          대화 기분 <span className={cx('moodText', mood?.tone ?? 'unknown')}>{mood?.label ?? UNKNOWN_MOOD}</span>
        </strong>
        <span className={cx('counts')}>
          {session.turnCount}번 대답 · 걱정·우울 {session.negativeCount}번
        </span>
        {statusText && <span className={cx('status')}>{statusText}</span>}
        {session.riskAlerted && <span className={cx('risk')}>이 대화로 위험 알림을 보냈어요</span>}
      </div>
    </section>
  );
}

// 턴별 기분 막대 - 기분은 동의와 관계없이 항상 보인다
function TurnMoods({ session }: { session: ICompanionSessionDetail }) {
  if (session.turns.length === 0) return null;
  return (
    <section className={cx('card')} aria-labelledby="companion-turn-moods">
      <h2 id="companion-turn-moods" className={cx('cardTitle')}>대답마다 기분</h2>
      <ol className={cx('bars')}>
        {session.turns.map(turn => {
          const mood = turn.mood ? MOOD_META[turn.mood] : null;
          return (
            <li key={turn.turnNo} className={cx('bar', mood?.tone ?? 'unknown')} aria-label={`${turn.turnNo}번째 대답 기분 ${mood?.label ?? UNKNOWN_MOOD}`}>
              <span className={cx('barFill')} aria-hidden="true" />
              <span className={cx('barLabel')} aria-hidden="true">{mood?.label ?? '?'}</span>
              <span className={cx('barNo')} aria-hidden="true">{turn.turnNo}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Transcript({ session }: { session: ICompanionSessionDetail }) {
  const hidden = session.transcript !== 'AVAILABLE';
  return (
    <section className={cx('card')} aria-labelledby="companion-transcript">
      <h2 id="companion-transcript" className={cx('cardTitle')}>나눈 이야기</h2>
      {hidden ? (
        <p className={cx('hiddenNote')} role="note">
          {TRANSCRIPT_HIDDEN_TEXT[session.transcript as Exclude<CompanionTranscriptState, 'AVAILABLE'>] ?? TRANSCRIPT_HIDDEN_TEXT.NO_CONSENT}
        </p>
      ) : (
        <ol className={cx('talk')}>
          {session.question && <TalkLine who="companion" text={session.question} />}
          {session.turns.map(turn => (
            <TurnLines key={turn.turnNo} answer={turn.answerText} bot={turn.botText} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TurnLines({ answer, bot }: { answer: string | null; bot: string | null }) {
  return (
    <>
      {answer && <TalkLine who="ward" text={answer} />}
      {bot && <TalkLine who="companion" text={bot} />}
    </>
  );
}

function TalkLine({ who, text }: { who: 'companion' | 'ward'; text: string }) {
  const sentences = who === 'companion' ? splitSentences(text) : [text];
  return (
    <li className={cx('talkLine', who)}>
      <span className={cx('who')}>{who === 'companion' ? '말벗' : '어르신'}</span>
      <p>
        {sentences.map((sentence, index) => (
          <span key={index} className={cx('sentence')}>
            {index > 0 && ' '}
            {sentence}
          </span>
        ))}
      </p>
    </li>
  );
}
