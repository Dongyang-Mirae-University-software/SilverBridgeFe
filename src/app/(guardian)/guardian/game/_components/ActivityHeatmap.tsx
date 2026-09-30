'use client';

import classNames from 'classnames/bind';
import dayjs from 'dayjs';

import { IGameActivityDay } from '@/service/interface/game';
import styles from './ActivityHeatmap.module.css';

const cx = classNames.bind(styles);

const WEEKS = 26;
const WEEKDAY_LABELS = ['', '월', '', '수', '', '금', ''];

// 하루 풀이 횟수 → 0(없음)~4 단계. 단일 색상(브랜드 녹색) 명도 램프로 칠한다.
function toLevel(attempts: number) {
  if (attempts <= 0) return 0;
  if (attempts < 3) return 1;
  if (attempts < 6) return 2;
  if (attempts < 12) return 3;
  return 4;
}

export function ActivityHeatmap({ activity }: { activity: IGameActivityDay[] }) {
  const byDate = new Map(activity.map(day => [day.date, day]));
  const today = dayjs().startOf('day');
  // 오늘이 속한 주의 일요일부터 거꾸로 WEEKS주. 열 = 주, 행 = 요일(일~토).
  const gridStart = today.subtract(today.day(), 'day').subtract(WEEKS - 1, 'week');

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = gridStart.add(w * 7 + d, 'day');
      const key = date.format('YYYY-MM-DD');
      const day = byDate.get(key);
      return { key, date, day, future: date.isAfter(today) };
    }),
  );

  const monthLabels = weeks.map((week, w) => {
    const first = week[0].date;
    const showLabel = w === 0 || first.date() <= 7;
    return showLabel ? first.format('M월') : '';
  });

  const totalAttempts = activity.reduce((sum, day) => sum + day.attempts, 0);
  const activeDays = activity.length;

  return (
    <figure className={cx('figure')}>
      <figcaption className={cx('caption')}>
        <span>최근 {WEEKS}주 활동</span>
        <span className={cx('captionStat')}>
          {activeDays}일 · {totalAttempts}문제
        </span>
      </figcaption>
      <div className={cx('scroll')}>
        <div className={cx('grid')} style={{ '--weeks': WEEKS } as React.CSSProperties}>
          <div className={cx('months')}>
            {monthLabels.map((label, w) => (
              <span key={w}>{label}</span>
            ))}
          </div>
          <div className={cx('weekdays')}>
            {WEEKDAY_LABELS.map((label, d) => (
              <span key={d}>{label}</span>
            ))}
          </div>
          <div className={cx('cells')} role="img" aria-label={`최근 ${WEEKS}주 동안 ${activeDays}일 게임을 했습니다.`}>
            {weeks.map(week =>
              week.map(({ key, date, day, future }) => (
                <span
                  key={key}
                  className={cx('cell', `level${toLevel(day?.attempts ?? 0)}`, { future })}
                  title={
                    future
                      ? ''
                      : `${date.format('M월 D일')}: ${day ? `${day.attempts}문제 풀이, ${day.correct}문제 정답, ${day.score}점` : '활동 없음'}`
                  }
                />
              )),
            )}
          </div>
        </div>
      </div>
      <div className={cx('legend')} aria-hidden="true">
        <span>적게</span>
        {[0, 1, 2, 3, 4].map(level => (
          <span key={level} className={cx('cell', `level${level}`)} />
        ))}
        <span>많이</span>
      </div>
    </figure>
  );
}
