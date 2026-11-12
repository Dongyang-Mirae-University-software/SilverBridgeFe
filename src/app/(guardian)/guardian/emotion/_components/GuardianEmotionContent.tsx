'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import { isAxiosError } from 'axios';

import { useState } from 'react';
import Link from 'next/link';
import { MoodFace } from '@/components/MoodFace';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import {
  wardCompanionDayQueryOptions,
  wardCompanionTodayQueryOptions,
  wardCompanionWeekQueryOptions,
} from '@/service/query/guardian';
import type {
  ICompanionAttention,
  ICompanionDayMood,
  ICompanionSlot,
  ICompanionToday,
} from '@/service/interface/guardian/companion';
import { setSelectedWardId, useSelectedWard } from '@/store/selectedWardStore';
import { getTopicParticle } from '@/utils/format/korean';
import { formatSlotTime } from '@/utils/format/slotTime';
import {
  MOOD_META,
  STATUS_LABEL,
  UNKNOWN_MOOD,
  companionSessionHref,
  formatDateLabel,
  parseDate,
} from './companionMood';
import styles from './GuardianEmotionContent.module.css';

const cx = classNames.bind(styles);

// 병명이 아니라 관찰한 사실만 쓴다
const ATTENTION_TEXT: Record<ICompanionAttention['mood'], string> = {
  WORRY: '걱정스러운 기분이',
  DEPRESSED: '우울한 기분이',
};

function errorCode(error: unknown) {
  return isAxiosError<{ code?: string }>(error) ? error.response?.data?.code : undefined;
}

function isNotAuthorized(error: unknown) {
  return errorCode(error) === 'COMPANION_NOT_AUTHORIZED';
}

export function GuardianEmotionContent() {
  const {
    activeWards,
    hasActiveWards,
    isLoading: isWardsLoading,
    isError: isWardsError,
    refetch: refetchWards,
  } = useGuardianActiveWards();
  const selectedWard = useSelectedWard(activeWards, ward => ward.partnerUserId);
  const wardId = selectedWard?.partnerUserId ?? '';

  const { data, error, isLoading, isError, isFetching, refetch } = useQuery({
    ...wardCompanionTodayQueryOptions(wardId),
    enabled: Boolean(wardId),
  });

  if (isWardsLoading) {
    return (
      <p className={cx('emptyState')} role="status">
        피보호자 정보를 불러오는 중이에요.
      </p>
    );
  }

  if (isWardsError && !hasActiveWards) {
    return (
      <div className={cx('emptyState')} role="alert">
        <strong>피보호자 정보를 불러오지 못했어요.</strong>
        <button className={cx('retryButton')} type="button" onClick={() => void refetchWards()}>
          다시 불러오기
        </button>
      </div>
    );
  }

  if (!hasActiveWards || !selectedWard) {
    return (
      <div className={cx('emptyState')}>
        <strong>연결된 피보호자가 없습니다.</strong>
        <span>피보호자와 연결되면 안부 대화와 기분을 확인할 수 있습니다.</span>
      </div>
    );
  }

  return (
    <div className={cx('page')}>
      {activeWards.length > 1 && (
        <WardSelectorTabs
          wards={activeWards.map(ward => ({
            wardId: ward.partnerUserId,
            wardName: ward.partnerName,
            profileImage: ward.partnerProfileImage,
            relation: ward.relation,
          }))}
          selectedWardId={wardId}
          onSelect={setSelectedWardId}
        />
      )}

      {isLoading ? (
        <p className={cx('emptyState')} role="status">
          오늘 안부 대화를 불러오는 중이에요.
        </p>
      ) : isError && !data ? (
        <div className={cx('emptyState')} role="alert">
          <strong>
            {isNotAuthorized(error) ? '연결된 피보호자의 안부 대화만 볼 수 있습니다.' : '안부 대화를 불러오지 못했어요.'}
          </strong>
          {!isNotAuthorized(error) && (
            <button className={cx('retryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
              다시 불러오기
            </button>
          )}
        </div>
      ) : data ? (
        <CompanionToday key={wardId} wardId={wardId} wardName={selectedWard.partnerName} today={data} />
      ) : (
        <p className={cx('emptyState')}>오늘 안부 대화 정보가 없어요.</p>
      )}
    </div>
  );
}

function CompanionToday({ wardId, wardName, today }: { wardId: string; wardName: string; today: ICompanionToday }) {
  const { current, attention } = today;
  // 7일 줄에서 고른 날. null·오늘이면 위 오늘 목록만 보인다
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const pastDate = pickedDate && pickedDate !== today.date ? pickedDate : null;
  const currentMood = current?.mood ? MOOD_META[current.mood] : null;

  return (
    <>
      <section className={cx('card', 'currentCard')} aria-label="지금 기분">
        {currentMood ? <MoodFace mood={currentMood.face} size={84} /> : <span className={cx('unknownFace', 'large')} aria-hidden="true" />}
        <div className={cx('currentText')}>
          {current && <span className={cx('currentMeta')}>최근 안부 · {formatSlotTime(current.slot)}</span>}
          <strong className={cx('currentMood')}>
            {currentMood ? (
              <>
                {wardName}{getTopicParticle(wardName)} 지금 <span className={cx('moodText', currentMood.tone)}>{currentMood.label}</span> 상태예요
              </>
            ) : (
              <>지금 기분은 {UNKNOWN_MOOD}</>
            )}
          </strong>
          {current?.summary && <p className={cx('summary')}>{current.summary}</p>}
          <span className={cx('progress')}>
            오늘 {today.slotCount}번 중 {today.answeredCount}번 대화했어요
            {today.nextSlot && ` · 다음 안부는 ${formatSlotTime(today.nextSlot)}`}
          </span>
        </div>
      </section>

      {attention && (
        <section className={cx('card', 'attentionCard')} role="note" aria-label="확인할 일">
          <strong>확인할 일</strong>
          <p>
            {ATTENTION_TEXT[attention.mood]} {attention.days}일째 이어지고 있어요. 안부 전화를 드려 보세요.
          </p>
        </section>
      )}

      <WeekMoods wardId={wardId} today={today.date} picked={pastDate ?? today.date} onPick={setPickedDate} />

      {pastDate ? (
        <DaySlots wardId={wardId} date={pastDate} />
      ) : (
        <section className={cx('card', 'slotCard')} aria-labelledby="companion-slots-title">
          <h2 id="companion-slots-title" className={cx('slotTitle')}>
            오늘의 안부 대화
          </h2>
          <ul className={cx('slots')}>
            {today.slots.map(slot => (
              <SlotRow key={slot.slot} slot={slot} wardId={wardId} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SlotRow({ slot, wardId }: { slot: ICompanionSlot; wardId: string }) {
  const done = slot.status === 'DONE';
  const mood = slot.mood ? MOOD_META[slot.mood] : null;
  const linked = done && slot.sessionId != null;
  const content = (
    <>
      <span className={cx('slotTime')}>{formatSlotTime(slot.slot)}</span>
      <span className={cx('slotFace')}>
        {done && mood ? <MoodFace mood={mood.face} size={48} /> : <span className={cx('unknownFace')} aria-hidden="true" />}
      </span>
      <span className={cx('slotBody')}>
        {slot.question && <span className={cx('question')}>&ldquo;{slot.question}&rdquo;</span>}
        {done ? (
          <span className={cx('chip', 'moodChip', mood?.tone ?? 'unknown')}>{mood?.label ?? UNKNOWN_MOOD}</span>
        ) : (
          <span className={cx('chip', 'statusChip', { live: slot.status === 'AVAILABLE' || slot.status === 'IN_PROGRESS' })}>
            {STATUS_LABEL[slot.status]}
          </span>
        )}
      </span>
    </>
  );

  // 마친 시간대는 줄 전체가 대화 보기로 가는 링크(프로토타입). 읽기 프로그램에는 '대화 보기'를 덧붙인다
  return (
    <li className={cx('slotItem')}>
      {linked ? (
        <Link className={cx('slot', 'done', 'linked')} href={companionSessionHref(wardId, slot.sessionId as number)}>
          {content}
          <span className={cx('srOnly')}> 대화 보기</span>
          <span className={cx('chevron')} aria-hidden="true">›</span>
        </Link>
      ) : (
        <div className={cx('slot', { done })}>{content}</div>
      )}
    </li>
  );
}

// 최근 7일 하루 기분 - 날짜를 누르면 그날 시간대 목록을 아래에 연다
function WeekMoods({ wardId, today, picked, onPick }: {
  wardId: string;
  today: string;
  picked: string;
  onPick: (date: string) => void;
}) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery(wardCompanionWeekQueryOptions(wardId));

  return (
    <section className={cx('card', 'weekCard')} aria-labelledby="companion-week-title">
      <div className={cx('weekHead')}>
        <h2 id="companion-week-title" className={cx('weekTitle')}>최근 7일 기분</h2>
        <span className={cx('weekHint')}>날짜를 누르면 그날 대화</span>
      </div>
      {isLoading ? (
        <p className={cx('weekState')} role="status">최근 기분을 불러오는 중이에요.</p>
      ) : isError || !data ? (
        <p className={cx('weekState')} role="alert">
          최근 기분을 불러오지 못했어요.{' '}
          <button className={cx('textButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>다시 불러오기</button>
        </p>
      ) : (
        <ol className={cx('weekDays')}>
          {data.days.map(day => (
            <WeekDay key={day.date} day={day} isToday={day.date === today} selected={day.date === picked} onPick={onPick} />
          ))}
        </ol>
      )}
    </section>
  );
}

function WeekDay({ day, isToday, selected, onPick }: {
  day: ICompanionDayMood;
  isToday: boolean;
  selected: boolean;
  onPick: (date: string) => void;
}) {
  const mood = day.mood ? MOOD_META[day.mood] : null;
  const { weekday } = parseDate(day.date);
  const name = `${isToday ? '오늘' : formatDateLabel(day.date)} 기분 ${mood?.label ?? '기록 없음'}`;

  return (
    <li>
      <button className={cx('weekDay', { selected })} type="button" aria-pressed={selected} aria-label={name} onClick={() => onPick(day.date)}>
        <span className={cx('weekLabel')}>{isToday ? '오늘' : weekday}</span>
        <span className={cx('weekDot', mood?.tone ?? 'none')} aria-hidden="true" />
        <span className={cx('weekMood', mood?.tone ?? 'unknown')}>{mood?.label ?? '없음'}</span>
      </button>
    </li>
  );
}

// 고른 지난 날의 시간대 목록
function DaySlots({ wardId, date }: { wardId: string; date: string }) {
  const { data, error, isLoading, isError, isFetching, refetch } = useQuery(wardCompanionDayQueryOptions(wardId, date));
  const title = `${formatDateLabel(date)} 안부 대화`;
  const code = errorCode(error);

  return (
    <section className={cx('card', 'slotCard')} aria-labelledby="companion-day-title">
      <h2 id="companion-day-title" className={cx('slotTitle')}>{title}</h2>
      {isLoading ? (
        <p className={cx('weekState')} role="status">불러오는 중이에요.</p>
      ) : isError || !data ? (
        <p className={cx('weekState')} role="alert">
          {code === 'COMPANION_NOT_AUTHORIZED'
            ? '연결된 피보호자의 안부 대화만 볼 수 있습니다.'
            : code === 'COMPANION_DATE_OUT_OF_RANGE'
              ? '최근 7일 안의 날짜만 볼 수 있어요.'
              : '그날 안부 대화를 불러오지 못했어요.'}
          {code !== 'COMPANION_NOT_AUTHORIZED' && code !== 'COMPANION_DATE_OUT_OF_RANGE' && (
            <>
              {' '}
              <button className={cx('textButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>다시 불러오기</button>
            </>
          )}
        </p>
      ) : (
        <ul className={cx('slots')}>
          {data.slots.map(slot => (
            <SlotRow key={slot.slot} slot={slot} wardId={wardId} />
          ))}
        </ul>
      )}
    </section>
  );
}
