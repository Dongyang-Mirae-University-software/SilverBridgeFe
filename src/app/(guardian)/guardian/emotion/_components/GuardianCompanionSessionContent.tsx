'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { wardCompanionSessionQueryOptions } from '@/service/query/guardian';
import type { CompanionTranscriptState, ICompanionSessionDetail, ICompanionTurn } from '@/service/interface/guardian/companion';
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
    <Link className={cx('backLink')} href="/guardian/emotion" aria-label="AI 기분 체크로 돌아가기">
      <span aria-hidden="true">‹</span>
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
      <header className={cx('detailHead')}>
        {back}
        <div>
          <span className={cx('headDate')}>{formatDateLabel(data.date)}</span>
          <h2 className={cx('headTitle')}>{formatSlotTime(data.slot)} 안부 대화</h2>
        </div>
      </header>
      <SessionSummary session={data} />
      <Transcript session={data} />
      <p className={cx('footNote')}>어르신이 대화 내용 공유에 동의한 경우에만 보여요. 보관 기간이 지나면 지워져요.</p>
    </div>
  );
}

// 턴 기분 글자 - 판단 보류는 '판단 안 함'(프로토타입)
const TURN_UNKNOWN = '판단 안 함';
const LEGEND_ORDER = ['joy', 'calm', 'worry', 'depressed', 'unknown'] as const;

function SessionSummary({ session }: { session: ICompanionSessionDetail }) {
  const mood = session.mood ? MOOD_META[session.mood] : null;
  const statusText = STATUS_TEXT[session.status];
  const turnMoods = session.turns.map(turn => (turn.mood ? MOOD_META[turn.mood] : null));
  const legend = LEGEND_ORDER.filter(tone => turnMoods.some(m => (m?.tone ?? 'unknown') === tone)).map(tone =>
    tone === 'unknown' ? { tone, label: TURN_UNKNOWN } : { tone, label: Object.values(MOOD_META).find(m => m.tone === tone)!.label },
  );

  return (
    <section className={cx('card', 'summary')} aria-label="이 대화의 상태">
      <div className={cx('summaryHead')}>
        <strong className={cx('moodLine')}>
          이 대화의 기분 · <span className={cx('moodText', mood?.tone ?? 'unknown')}>{mood?.label ?? UNKNOWN_MOOD}</span>
        </strong>
        {session.test && <span className={cx('testBadge')}>테스트</span>}
      </div>
      <span className={cx('counts')}>
        {session.turnCount}번 대답 · 걱정·우울 {session.negativeCount}번 · 위험 알림 {session.riskAlerted ? '보냄' : '없음'}
      </span>
      {statusText && <span className={cx('status')}>{statusText}</span>}
      {turnMoods.length > 0 && (
        <>
          <div className={cx('strip')} role="img" aria-label={`대답별 기분: ${turnMoods.map(m => m?.label ?? TURN_UNKNOWN).join(', ')}`}>
            {turnMoods.map((m, index) => (
              <span key={session.turns[index].turnNo} className={cx('segment', m?.tone ?? 'unknown')} />
            ))}
          </div>
          <div className={cx('legend')} aria-hidden="true">
            {legend.map(item => (
              <span key={item.tone} className={cx('legendItem', item.tone)}>{item.label}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Transcript({ session }: { session: ICompanionSessionDetail }) {
  const hidden = session.transcript !== 'AVAILABLE';
  return (
    <section className={cx('transcriptSection')} aria-labelledby="companion-transcript">
      <h2 id="companion-transcript" className={cx('sectionTitle')}>나눈 이야기</h2>
      {hidden ? (
        <p className={cx('hiddenNote')} role="note">
          {TRANSCRIPT_HIDDEN_TEXT[session.transcript as Exclude<CompanionTranscriptState, 'AVAILABLE'>] ?? TRANSCRIPT_HIDDEN_TEXT.NO_CONSENT}
        </p>
      ) : (
        <ol className={cx('talk')}>
          {session.question && <TalkLine who="companion" text={session.question} />}
          {session.turns.map(turn => (
            <TurnLines key={turn.turnNo} answer={turn.answerText} bot={turn.botText} mood={turn.mood} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TurnLines({ answer, bot, mood }: { answer: string | null; bot: string | null; mood: ICompanionTurn['mood'] }) {
  const meta = mood ? MOOD_META[mood] : null;
  return (
    <>
      {answer && <TalkLine who="ward" text={answer} mood={{ label: meta?.label ?? TURN_UNKNOWN, tone: meta?.tone ?? 'unknown' }} />}
      {bot && <TalkLine who="companion" text={bot} />}
    </>
  );
}

function TalkLine({ who, text, mood }: { who: 'companion' | 'ward'; text: string; mood?: { label: string; tone: string } }) {
  const sentences = who === 'companion' ? splitSentences(text) : [text];
  return (
    <li className={cx('talkLine', who)}>
      <span className={cx('srOnly')}>{who === 'companion' ? '말벗' : '어르신'}</span>
      <p className={cx('bubble')}>
        {sentences.map((sentence, index) => (
          <span key={index} className={cx('sentence')}>
            {index > 0 && ' '}
            {sentence}
          </span>
        ))}
      </p>
      {mood && <span className={cx('moodChip', mood.tone)}>{mood.label}</span>}
    </li>
  );
}
