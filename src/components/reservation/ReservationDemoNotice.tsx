import classNames from 'classnames/bind';

import { RESERVATION_DEMO_NOTICE } from '@/constants/reservation';
import styles from './ReservationDemoNotice.module.css';

const cx = classNames.bind(styles);

// 예약 화면의 "시연용 가상 병원" 안내 한 줄(병원 목록·확인·완료·예약 목록)
export function ReservationDemoNotice({ className }: { className?: string }) {
  return <p className={cx('demoNotice', className)}>{RESERVATION_DEMO_NOTICE}</p>;
}
