'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import dayjs from 'dayjs';

import { RefreshButton } from '@/components/RefreshButton';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { IConnectionItem } from '@/service/interface/connection';
import { IGameActivityDay, IGameProgress, IWardGameSummary } from '@/service/interface/game';
import {
  wardGameActivityQueryOptions,
  wardGameSummaryQueryKey,
  wardGameSummaryQueryOptions,
} from '@/service/query/guardian/game';
import { parseServerTime } from '@/utils/format/serverTime';
import { ActivityHeatmap } from './ActivityHeatmap';
import { gameErrorMessage } from './gameErrorMessage';
import styles from './GuardianGameContent.module.css';

const cx = classNames.bind(styles);

// AI 게임 기록 시각은 시간대 표시 없는 UTC라 그대로 읽으면 9시간 이르게 보였다(2026-11-12) - UTC로 읽어 화면 시간대로 보인다
function formatPlayedAt(value: string | null) {
  const time = parseServerTime(value);
  return time === null ? '기록 없음' : dayjs(time).format('M월 D일 HH:mm');
}

interface WardGameCardProps {
  ward: IConnectionItem;
  summary: IWardGameSummary | null;
  activity: IGameActivityDay[];
  isLoading: boolean;
  error: unknown;
  activityError: unknown;
}

// 진행 막대·문제 수 - BE가 null을 실을 수 있어 기본값을 둔다(FE #293 점검 L-1)
function gameProgressView(totalStages: number | null, progress: IGameProgress | null) {
  const total = totalStages ?? 0;
  const done = !progress ? 0 : progress.cleared ? total : Math.max(0, (progress.currentStageNo ?? 1) - 1);
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return { total, done, percent };
}

function WardGameCard({ ward, summary, activity, isLoading, error, activityError }: WardGameCardProps) {
  return (
    <li className={cx('card')}>
      <header className={cx('cardHeader')}>
        <div>
          <strong className={cx('wardName')}>{ward.partnerName}</strong>
          <span className={cx('meta')}>마지막 플레이 {formatPlayedAt(summary?.lastPlayedAt ?? null)}</span>
        </div>
        <div className={cx('total')}>
          <span className={cx('meta')}>총점</span>
          <strong>{summary?.totalScore ?? 0}점</strong>
        </div>
      </header>

      {isLoading && <p className={cx('emptyText')}>게임 기록을 불러오는 중입니다.</p>}
      {!isLoading && !summary && (
        <p className={cx('emptyText')} role={error ? 'alert' : undefined}>
          {gameErrorMessage(error)}
        </p>
      )}

      {/* 활동만 실패하면 빈 히트맵(0일·0문제)이 "활동 없음"처럼 보인다 - 안내로 바꾼다(FE #293 점검 L-2) */}
      {summary && !activityError && <ActivityHeatmap activity={activity} />}
      {summary && Boolean(activityError) && (
        <p className={cx('emptyText')} role="alert">
          최근 활동 기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </p>
      )}

      {summary && (
        <ul className={cx('games')}>
          {summary.games.map(({ game, progress }) => {
            const { total, done, percent } = gameProgressView(game.totalStages, progress);
            return (
              <li key={game.slug} className={cx('game')} style={game.themeColor ? ({ '--game-color': game.themeColor } as React.CSSProperties) : undefined}>
                <div className={cx('gameHead')}>
                  <strong>{game.title ?? '게임'}</strong>
                  {progress?.cleared ? (
                    <span className={cx('badge', 'done')}>완료</span>
                  ) : progress ? (
                    <span className={cx('badge')}>진행 중</span>
                  ) : (
                    <span className={cx('badge', 'idle')}>시작 전</span>
                  )}
                </div>
                <div className={cx('bar')} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div className={cx('stats')}>
                  <span>
                    {done} / {total} 문제
                  </span>
                  <span>{progress?.score ?? 0}점</span>
                  <span>시도 {progress?.attempts ?? 0}회</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function GuardianGameContent() {
  const queryClient = useQueryClient();
  const { activeWards, isLoading: isWardsLoading, isError } = useGuardianActiveWards();
  const results = useQueries({
    queries: activeWards.map(ward => wardGameSummaryQueryOptions(ward.partnerUserId)),
  });
  const activityResults = useQueries({
    queries: activeWards.map(ward => wardGameActivityQueryOptions(ward.partnerUserId)),
  });
  const isRefreshing = [...results, ...activityResults].some(result => result.isFetching);

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>게임 관리</strong>
          <span className={cx('toolbarSub')}>연결된 어르신 {activeWards.length}명</span>
        </div>
        <RefreshButton
          ariaLabel="새로고침"
          disabled={isRefreshing}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: wardGameSummaryQueryKey })}
        />
      </header>

      {isWardsLoading && <p className={cx('emptyText')}>어르신 목록을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>어르신 목록을 불러오지 못했습니다.</p>}
      {!isWardsLoading && !isError && activeWards.length === 0 && (
        <p className={cx('emptyText')}>연결된 어르신이 없습니다.</p>
      )}

      <ul className={cx('list')}>
        {activeWards.map((ward, index) => (
          <WardGameCard
            key={ward.partnerUserId}
            ward={ward}
            summary={results[index]?.data ?? null}
            activity={activityResults[index]?.data ?? []}
            isLoading={results[index]?.isLoading ?? false}
            error={results[index]?.error ?? null}
            activityError={activityResults[index]?.error ?? null}
          />
        ))}
      </ul>
    </section>
  );
}
