'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { ReservationPager } from '@/components/reservation/ReservationPager';
import { IReservationItem } from '@/service/interface/reservation';
import { hospitalsQueryOptions, myReservationsQueryOptions } from '@/service/query/guardian/reservation';
import {
  daysBetween,
  findHospitalByName,
  formatDateLong,
  formatTime,
  reservationErrorMessage,
  splitReservations,
} from '@/utils/reservation/reservationView';
import { useKstNow } from '@/utils/reservation/useKstNow';
import styles from './WardHospitalContent.module.css';

const cx = classNames.bind(styles);
const PAST_PER_PAGE = 5;

// "5월 11일 월요일" → "5월 11일"
const shortDate = (iso: string) => formatDateLong(iso).replace(/ .요일$/, '');

// 보기 전용 - 예약은 보호자가 피보호자 계정으로 대신 잡아 본인 계정 조회(wardId 없음)로 그대로 보인다.
export function WardHospitalContent() {
  const { data: reservations = [], isLoading, isError, error, refetch } = useQuery(myReservationsQueryOptions());
  // 주소는 예약 응답에 없어 병원 목록에서 이름으로 찾는다. 못 불러오면 주소만 뺀다.
  const { data: hospitals = [] } = useQuery(hospitalsQueryOptions);
  const [pastPage, setPastPage] = useState(0);
  // 화면을 켜 둔 채 날이 바뀌어도 D-day·다가오는/지난 진료가 1분 안에 따라온다
  const { today, nowTime } = useKstNow();

  if (isLoading) return <p className={cx('message')}>예약 현황을 불러오는 중이에요.</p>;
  if (isError) {
    return (
      <div className={cx('card', 'messageCard')} role="alert">
        <p className={cx('message')}>{reservationErrorMessage(error)}</p>
        <button type="button" className={cx('retry')} onClick={() => refetch()}>
          다시 불러오기
        </button>
      </div>
    );
  }

  const { upcoming, past } = splitReservations(reservations, today, nowTime);
  const [next, ...others] = upcoming;
  const pastTotal = Math.ceil(past.length / PAST_PER_PAGE);
  const page = Math.min(pastPage, Math.max(0, pastTotal - 1));

  return (
    <div className={cx('page')}>
      {next ? (
        <NextCard item={next} today={today} address={findHospitalByName(hospitals, next.hospitalName)?.address} />
      ) : (
        <section className={cx('card', 'nextCard')} aria-label="다음 진료">
          <span className={cx('nextLabel')}>다음 진료</span>
          <p className={cx('emptyBig')}>예정된 진료가 없어요</p>
        </section>
      )}

      {others.length > 0 && (
        <section className={cx('card', 'listCard')} aria-label="그 밖의 예약">
          <h2 className={cx('listHead')}>그 밖의 예약</h2>
          {others.map(item => (
            <div key={item.reservationId} className={cx('row')}>
              <span className={cx('rowDate')}>
                {shortDate(item.reservationDate)} {formatTime(item.reservationTime)}
              </span>
              <span className={cx('rowName')}>
                {item.hospitalName} <span className={cx('rowDept')}>· {item.department}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className={cx('card', 'listCard')} aria-label="지난 진료">
        <h2 className={cx('listHead')}>지난 진료</h2>
        {past.length === 0 ? (
          <p className={cx('emptyRow')}>지난 진료가 없어요</p>
        ) : (
          past.slice(page * PAST_PER_PAGE, (page + 1) * PAST_PER_PAGE).map(item => (
            <div key={item.reservationId} className={cx('row', { canceled: item.status === 'CANCELED' })}>
              <span className={cx('rowDate', 'pastDate')}>{shortDate(item.reservationDate)}</span>
              <span className={cx('rowName')}>
                {item.hospitalName} <span className={cx('rowDept')}>· {item.department}</span>
              </span>
              {item.status === 'CANCELED' && <span className={cx('tag')}>취소됨</span>}
            </div>
          ))
        )}
      </section>
      <ReservationPager page={page} total={pastTotal} onChange={setPastPage} label="지난 진료 페이지" />

      <p className={cx('footnote')}>예약은 보호자가 대신 잡아 드려요</p>
    </div>
  );
}

function NextCard({ item, today, address }: { item: IReservationItem; today: string; address?: string }) {
  const days = daysBetween(today, item.reservationDate);
  return (
    <section className={cx('card', 'nextCard')} aria-label="다음 진료">
      <div className={cx('nextTop')}>
        <span className={cx('nextLabel')}>다음 진료</span>
        <span className={cx('dday')}>{days === 0 ? '오늘이에요' : `${days}일 남았어요`}</span>
      </div>
      <div>
        <div className={cx('bigDate')}>{formatDateLong(item.reservationDate)}</div>
        <div className={cx('bigDate', 'bigTime')}>{formatTime(item.reservationTime)}</div>
      </div>
      <div className={cx('place')}>
        <div className={cx('hospital')}>
          {item.hospitalName} <span className={cx('dept')}>· {item.department}</span>
        </div>
        {address && <div className={cx('address')}>{address}</div>}
      </div>
    </section>
  );
}
