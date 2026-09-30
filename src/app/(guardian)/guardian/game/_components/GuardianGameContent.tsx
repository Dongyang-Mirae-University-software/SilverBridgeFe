'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import dayjs from 'dayjs';

import { RefreshButton } from '@/components/RefreshButton';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { IConnectionItem } from '@/service/interface/connection';
import { IGameActivityDay, IWardGameSummary } from '@/service/interface/game';
import {
  wardGameActivityQueryOptions,
  wardGameSummaryQueryKey,
  wardGameSummaryQueryOptions,
} from '@/service/query/guardian/game';
import { toGameUserId } from '@/utils/game/userId';
import { ActivityHeatmap } from './ActivityHeatmap';
import styles from './GuardianGameContent.module.css';

const cx = classNames.bind(styles);

function formatPlayedAt(value: string | null) {
  return value ? dayjs(value).format('M월 D일 HH:mm') : '기록 없음';
}

interface WardGameCardProps {
  ward: IConnectionItem;
  summary: IWardGameSummary | null;
  activity: IGameActivityDay[];
  isLoading: boolean;
}

function WardGameCard({ ward, summary, activity, isLoading }: WardGameCardProps) {
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
      {!isLoading && !summary && <p className={cx('emptyText')}>게임 기록을 불러오지 못했습니다.</p>}

      {summary && <ActivityHeatmap activity={activity} />}

      {summary && (
        <ul className={cx('games')}>
          {summary.games.map(({ game, progress }) => {
            const done = progress ? (progress.cleared ? game.totalStages : progress.currentStageNo - 1) : 0;
            const percent = game.totalStages ? Math.round((done / game.totalStages) * 100) : 0;
            return (
              <li key={game.slug} className={cx('game')} style={{ '--game-color': game.themeColor } as React.CSSProperties}>
                <div className={cx('gameHead')}>
                  <strong>{game.title}</strong>
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
                    {done} / {game.totalStages} 문제
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
    queries: activeWards.map(ward => wardGameSummaryQueryOptions(toGameUserId(ward.partnerUserId))),
  });
  const activityResults = useQueries({
    queries: activeWards.map(ward => wardGameActivityQueryOptions(toGameUserId(ward.partnerUserId))),
  });
  const isRefreshing = results.some(result => result.isFetching);

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>게임 관리</strong>
          <span className={cx('toolbarSub')}>연결된 피보호자 {activeWards.length}명</span>
        </div>
        <RefreshButton
          ariaLabel="새로고침"
          disabled={isRefreshing}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: wardGameSummaryQueryKey })}
        />
      </header>

      {isWardsLoading && <p className={cx('emptyText')}>피보호자 목록을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>피보호자 목록을 불러오지 못했습니다.</p>}
      {!isWardsLoading && !isError && activeWards.length === 0 && (
        <p className={cx('emptyText')}>연결된 피보호자가 없습니다.</p>
      )}

      <ul className={cx('list')}>
        {activeWards.map((ward, index) => (
          <WardGameCard
            key={ward.partnerUserId}
            ward={ward}
            summary={results[index]?.data ?? null}
            activity={activityResults[index]?.data ?? []}
            isLoading={results[index]?.isLoading ?? false}
          />
        ))}
      </ul>
    </section>
  );
}
