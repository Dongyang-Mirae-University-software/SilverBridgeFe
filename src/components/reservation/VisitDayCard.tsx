import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { daysBetween, formatDateLong, formatTime } from '@/utils/reservation/reservationView';

import styles from './VisitDayCard.module.css';

const cx = classNames.bind(styles);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{1,2}:\d{2}/;

// 오늘 · 내일 · N일 뒤 (지난 날짜는 숫자 대신 날짜만 크게 보인다)
export const ddayLabel = (days: number) => (days === 0 ? '오늘' : days === 1 ? '내일' : `${days}일 뒤`);

interface Props {
  hospitalName: string;
  department?: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM - 형식이 다르면 받은 글자 그대로 보인다 */
  time: string;
  /** KST 오늘(YYYY-MM-DD) */
  today: string;
  address?: string;
  /** 좁은 칸(챗봇 말풍선)용 - 한 열로 쌓는다 */
  compact?: boolean;
  /** 화면 읽기용 이름 - 다음 진료 / 예약 완료 */
  ariaLabel?: string;
}

/** 병원 가는 날 카드 - 피보호자 병원 화면의 다음 진료와 챗봇 예약 완료가 같은 모양을 쓴다. */
export function VisitDayCard({ hospitalName, department, date, time, today, address, compact, ariaLabel }: Props) {
  const validDate = ISO_DATE.test(date);
  const days = validDate ? daysBetween(today, date) : -1;
  return (
    <section className={cx('root', { compact })} aria-label={ariaLabel ?? '다음 진료'}>
      <div className={cx('ddayPanel')}>
        <span className={cx('ddayCaption')}>병원 가는 날</span>
        {days >= 0 && <span className={cx('ddayBig')}>{ddayLabel(days)}</span>}
      </div>
      <div className={cx('nextBody')}>
        <div className={cx('infoRow')}>
          <span className={cx('infoIcon', 'infoIconBrand')}>
            <Icon name="calendar" size={32} />
          </span>
          <div className={cx('infoText')}>
            <div className={cx('bigDate')}>{validDate ? formatDateLong(date) : date}</div>
            <div className={cx('bigDate', 'bigTime')}>{HH_MM.test(time) ? formatTime(time) : time}</div>
          </div>
        </div>
        <div className={cx('divider')} />
        <div className={cx('infoRow')}>
          <span className={cx('infoIcon')}>
            <Icon name="hospital" size={32} />
          </span>
          <div className={cx('infoText')}>
            <div className={cx('hospital')}>
              {hospitalName} {department && <span className={cx('dept')}>· {department}</span>}
            </div>
            {address && <div className={cx('address')}>{address}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
