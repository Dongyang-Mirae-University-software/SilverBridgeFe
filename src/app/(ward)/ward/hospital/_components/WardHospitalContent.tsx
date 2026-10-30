'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { ReservationDemoNotice } from '@/components/reservation/ReservationDemoNotice';
import { ReservationPager } from '@/components/reservation/ReservationPager';
import { IReservationItem } from '@/service/interface/reservation';
import { hospitalsQueryOptions, myReservationsQueryOptions } from '@/service/query/guardian/reservation';
import {
  daysBetween,
  findHospitalByName,
  formatDateLong,
  formatTime,
  pastStatusLabel,
  reservationErrorMessage,
  splitReservations,
} from '@/utils/reservation/reservationView';
import { useKstNow } from '@/utils/reservation/useKstNow';
import styles from './WardHospitalContent.module.css';

const cx = classNames.bind(styles);
const PAST_PER_PAGE = 5;
// 다음 진료 아래 "그다음" 카드는 처음에 3장까지, 나머지는 펼쳐서 본다
const LATER_VISIBLE = 3;
// 켜 둔 화면에도 보호자가 새로 잡은 예약이 1분 안에 보인다(useKstNow 주기와 같음, 탭이 뒤에 있으면 멈춘다)
const REFETCH_MS = 60 * 1000;

// "5월 11일 월요일" → "5월 11일"
const shortDate = (iso: string) => formatDateLong(iso).replace(/ .요일$/, '');

// 오늘 · 내일 · N일 뒤
const ddayLabel = (days: number) => (days === 0 ? '오늘' : days === 1 ? '내일' : `${days}일 뒤`);

// 보기 전용 - 예약은 보호자가 피보호자 계정으로 대신 잡아 본인 계정 조회(wardId 없음)로 그대로 보인다.
export function WardHospitalContent() {
  const {
    data: reservations,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ ...myReservationsQueryOptions(), refetchInterval: REFETCH_MS });
  // 주소는 예약 응답에 없어 병원 목록에서 이름으로 찾는다. 못 불러오면 주소만 뺀다.
  const { data: hospitals = [] } = useQuery(hospitalsQueryOptions);
  const [pastPage, setPastPage] = useState(0);
  const [showAllLater, setShowAllLater] = useState(false);
  // 화면을 켜 둔 채 날이 바뀌어도 D-day·다가오는/지난 진료가 1분 안에 따라온다
  const { today, nowTime } = useKstNow();

  if (isLoading) return <p className={cx('message')}>예약 현황을 불러오는 중이에요.</p>;
  // 이미 보이던 예약이 있으면 주기 갱신이 한 번 실패해도 화면을 그대로 둔다
  if (isError && !reservations) {
    return (
      <div className={cx('card', 'messageCard')} role="alert">
        <p className={cx('message')}>{reservationErrorMessage(error)}</p>
        <button type="button" className={cx('retry')} onClick={() => refetch()}>
          다시 불러오기
        </button>
      </div>
    );
  }

  const { upcoming, past } = splitReservations(reservations ?? [], today, nowTime);
  const [next, ...others] = upcoming;
  const pastTotal = Math.ceil(past.length / PAST_PER_PAGE);
  const page = Math.min(pastPage, Math.max(0, pastTotal - 1));

  return (
    <div className={cx('page')}>
      <ReservationDemoNotice />
      {next ? (
        <NextCard item={next} today={today} address={findHospitalByName(hospitals, next.hospitalName)?.address} />
      ) : (
        <section className={cx('card', 'emptyCard')} aria-label="다음 진료">
          <p className={cx('emptyBig')}>병원 갈 날이 없어요</p>
        </section>
      )}

      {others.length > 0 && (
        <section className={cx('laterList')} aria-label="그 밖의 예약">
          {(showAllLater ? others : others.slice(0, LATER_VISIBLE)).map(item => (
            <div key={item.reservationId} className={cx('card', 'laterCard')}>
              <div className={cx('laterWhen')}>
                <span className={cx('laterLabel')}>그다음</span>
                <span className={cx('laterDday')}>{ddayLabel(daysBetween(today, item.reservationDate))}</span>
              </div>
              <div className={cx('laterBody')}>
                <div className={cx('laterDate')}>
                  {formatDateLong(item.reservationDate)}{' '}
                  <span className={cx('laterTime')}>{formatTime(item.reservationTime)}</span>
                </div>
                <div className={cx('laterName')}>
                  {item.hospitalName} <span className={cx('rowDept')}>· {item.department}</span>
                </div>
              </div>
            </div>
          ))}
          {others.length > LATER_VISIBLE && (
            <button
              type="button"
              className={cx('moreButton')}
              aria-expanded={showAllLater}
              onClick={() => setShowAllLater(open => !open)}
            >
              {showAllLater ? '접기' : `예약 ${others.length - LATER_VISIBLE}건 더 보기`}
            </button>
          )}
        </section>
      )}

      <section className={cx('card', 'listCard')} aria-label="지난 진료">
        <h2 className={cx('listHead')}>지난 진료</h2>
        {past.length === 0 ? (
          <p className={cx('emptyRow')}>지난 진료가 없어요</p>
        ) : (
          past.slice(page * PAST_PER_PAGE, (page + 1) * PAST_PER_PAGE).map(item => {
            // 취소·거절·미방문은 다녀온 진료처럼 보이지 않게 흐리게 + 상태 표시
            const status = pastStatusLabel(item.status);
            return (
              <div key={item.reservationId} className={cx('row', { canceled: status })}>
                <span className={cx('rowDate', 'pastDate')}>{shortDate(item.reservationDate)}</span>
                <span className={cx('rowName')}>
                  {item.hospitalName} <span className={cx('rowDept')}>· {item.department}</span>
                </span>
                {status && <span className={cx('tag')}>{status}</span>}
              </div>
            );
          })
        )}
      </section>
      <ReservationPager page={page} total={pastTotal} onChange={setPastPage} label="지난 진료 페이지" />

      <p className={cx('footnote')}>예약은 보호자가 대신 잡아 드려요</p>
    </div>
  );
}

function NextCard({ item, today, address }: { item: IReservationItem; today: string; address?: string }) {
  return (
    <section className={cx('card', 'nextCard')} aria-label="다음 진료">
      <div className={cx('ddayPanel')}>
        <span className={cx('ddayCaption')}>병원 가는 날</span>
        <span className={cx('ddayBig')}>{ddayLabel(daysBetween(today, item.reservationDate))}</span>
      </div>
      <div className={cx('nextBody')}>
        <div className={cx('infoRow')}>
          <span className={cx('infoIcon', 'infoIconBrand')}>
            <Icon name="calendar" size={32} />
          </span>
          <div className={cx('infoText')}>
            <div className={cx('bigDate')}>{formatDateLong(item.reservationDate)}</div>
            <div className={cx('bigDate', 'bigTime')}>{formatTime(item.reservationTime)}</div>
          </div>
        </div>
        <div className={cx('divider')} />
        <div className={cx('infoRow')}>
          <span className={cx('infoIcon')}>
            <Icon name="hospital" size={32} />
          </span>
          <div className={cx('infoText')}>
            <div className={cx('hospital')}>
              {item.hospitalName} <span className={cx('dept')}>· {item.department}</span>
            </div>
            {address && <div className={cx('address')}>{address}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
