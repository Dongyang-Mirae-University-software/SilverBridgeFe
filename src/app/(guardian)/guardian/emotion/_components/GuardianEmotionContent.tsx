'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import { isAxiosError } from 'axios';

import { MoodFace, MoodFaceKind } from '@/components/MoodFace';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { wardCompanionTodayQueryOptions } from '@/service/query/guardian';
import type {
  CompanionMood,
  CompanionSlotStatus,
  ICompanionAttention,
  ICompanionSlot,
  ICompanionToday,
} from '@/service/interface/guardian/companion';
import { setSelectedWardId, useSelectedWard } from '@/store/selectedWardStore';
import { getTopicParticle } from '@/utils/format/korean';
import { formatSlotTime } from '@/utils/format/slotTime';
import styles from './GuardianEmotionContent.module.css';

const cx = classNames.bind(styles);

const UNKNOWN_MOOD = '확인할 수 없어요';

const MOOD_META: Record<CompanionMood, { label: string; face: MoodFaceKind; tone: string }> = {
  JOY: { label: '기쁨', face: 'happy', tone: 'joy' },
  CALM: { label: '평온', face: 'calm', tone: 'calm' },
  WORRY: { label: '걱정', face: 'worried', tone: 'worry' },
  DEPRESSED: { label: '우울', face: 'sad', tone: 'depressed' },
};

const STATUS_LABEL: Record<CompanionSlotStatus, string> = {
  DONE: '마침',
  UPCOMING: '예정',
  AVAILABLE: '지금 대화 가능',
  IN_PROGRESS: '대화 중',
  MISSED: '지나감',
};

// 병명이 아니라 관찰한 사실만 쓴다
const ATTENTION_TEXT: Record<ICompanionAttention['mood'], string> = {
  WORRY: '걱정스러운 기분이',
  DEPRESSED: '우울한 기분이',
};

function isNotAuthorized(error: unknown) {
  return isAxiosError<{ code?: string }>(error) && error.response?.data?.code === 'COMPANION_NOT_AUTHORIZED';
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
        <CompanionToday wardName={selectedWard.partnerName} today={data} />
      ) : (
        <p className={cx('emptyState')}>오늘 안부 대화 정보가 없어요.</p>
      )}
    </div>
  );
}

function CompanionToday({ wardName, today }: { wardName: string; today: ICompanionToday }) {
  const { current, attention } = today;
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

      <section className={cx('card', 'slotCard')} aria-labelledby="companion-slots-title">
        <h2 id="companion-slots-title" className={cx('slotTitle')}>
          오늘의 안부 대화
        </h2>
        <ul className={cx('slots')}>
          {today.slots.map(slot => (
            <SlotRow key={slot.slot} slot={slot} />
          ))}
        </ul>
      </section>
    </>
  );
}

function SlotRow({ slot }: { slot: ICompanionSlot }) {
  const done = slot.status === 'DONE';
  const mood = slot.mood ? MOOD_META[slot.mood] : null;

  return (
    <li className={cx('slot', { done })}>
      <span className={cx('slotTime')}>{formatSlotTime(slot.slot)}</span>
      <span className={cx('slotFace')}>
        {done && mood ? <MoodFace mood={mood.face} size={52} /> : <span className={cx('unknownFace')} aria-hidden="true" />}
      </span>
      <div className={cx('slotBody')}>
        {slot.question && <span className={cx('question')}>&ldquo;{slot.question}&rdquo;</span>}
        {done ? (
          <span className={cx('chip', 'moodChip', mood?.tone ?? 'unknown')}>{mood?.label ?? UNKNOWN_MOOD}</span>
        ) : (
          <span className={cx('chip', 'statusChip', { live: slot.status === 'AVAILABLE' || slot.status === 'IN_PROGRESS' })}>
            {STATUS_LABEL[slot.status]}
          </span>
        )}
      </div>
    </li>
  );
}
