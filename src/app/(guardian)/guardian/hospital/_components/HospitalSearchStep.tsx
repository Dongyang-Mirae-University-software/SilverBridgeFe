import classNames from 'classnames/bind';

import { ReservationDemoNotice } from '@/components/reservation/ReservationDemoNotice';
import { ReservationPager } from '@/components/reservation/ReservationPager';
import { IHospital } from '@/service/interface/reservation';
import { isHospitalOpenNow, reservationErrorMessage } from '@/utils/reservation/reservationView';
import styles from './GuardianHospitalContent.module.css';
import { departmentSummary, searchHospitals } from './hospitalBooking';
import { SearchIcon } from './hospitalIcons';

const cx = classNames.bind(styles);

const PER_PAGE = 5;

interface Props {
  hospitals: IHospital[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  query: string;
  onQuery: (value: string) => void;
  page: number;
  onPage: (page: number) => void;
  onChoose: (hospital: IHospital) => void;
}

export function HospitalSearchStep({ hospitals, isLoading, error, onRetry, query, onQuery, page, onPage, onChoose }: Props) {
  const rows = searchHospitals(hospitals, query);
  const total = Math.ceil(rows.length / PER_PAGE);
  const current = Math.min(page, Math.max(0, total - 1));

  return (
    <>
      <ReservationDemoNotice />
      <label className={cx('searchBox')}>
        <SearchIcon />
        <input
          className={cx('searchInput')}
          type="search"
          placeholder="병원 이름이나 진료과로 찾기"
          aria-label="병원 찾기"
          value={query}
          onChange={event => onQuery(event.target.value)}
        />
      </label>
      <div className={cx('card', 'listCard')}>
        {isLoading ? (
          <p className={cx('emptyRow', 'center')}>병원 목록을 불러오는 중이에요</p>
        ) : error ? (
          <div className={cx('emptyRow', 'center')} role="alert">
            <p className={cx('message', 'inline')}>{reservationErrorMessage(error)}</p>
            <button type="button" className={cx('btn', 'ghost', 'smallButton')} onClick={onRetry}>
              다시 불러오기
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className={cx('emptyRow', 'center')}>찾는 병원이 없어요</p>
        ) : (
          rows.slice(current * PER_PAGE, (current + 1) * PER_PAGE).map(hospital => {
            // 예약 서비스는 지금 진료 중이 아닌 병원의 예약을 거절한다 - 끝까지 고른 뒤 거절되지 않게 미리 막는다
            const open = isHospitalOpenNow(hospital);
            return (
              <button
                key={hospital.id}
                type="button"
                className={cx('hospitalRow', { closed: !open })}
                disabled={!open}
                onClick={() => onChoose(hospital)}
              >
                <span className={cx('hospitalText')}>
                  <span className={cx('hospitalName')}>{hospital.name}</span>
                  <span className={cx('hospitalDept')}>{departmentSummary(hospital.departments)}</span>
                  <span className={cx('hospitalAddress')}>{hospital.address}</span>
                  {!open && <span className={cx('closedNote')}>지금은 예약을 받지 않아요</span>}
                </span>
                {open && (
                  <span className={cx('chevron')} aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
      <ReservationPager page={current} total={total} onChange={onPage} label="병원 목록 페이지" />
    </>
  );
}
