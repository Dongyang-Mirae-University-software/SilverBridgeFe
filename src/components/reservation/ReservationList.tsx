'use client';

import classNames from 'classnames/bind';

import { IReservationItem } from '@/service/interface/reservation';
import styles from './ReservationList.module.css';

const cx = classNames.bind(styles);

const STATUS_LABEL: Record<IReservationItem['status'], string> = {
  BOOKED: '예약됨',
  CONFIRMED: '확정',
  COMPLETED: '진료 완료',
  CANCELED: '취소됨',
};

interface Props {
  reservations: IReservationItem[];
  isLoading: boolean;
  // 없으면 취소 버튼을 보이지 않는다(피보호자 웹은 확인만).
  onCancel?: (reservationId: number) => void;
  isCanceling?: boolean;
}

export function ReservationList({ reservations, isLoading, onCancel, isCanceling = false }: Props) {
  if (isLoading) return <p className={cx('emptyText')}>예약 내역을 불러오는 중입니다.</p>;
  if (reservations.length === 0) return <p className={cx('emptyText')}>예약 내역이 없습니다.</p>;

  return (
    <ul className={cx('list')}>
      {reservations.map(item => (
        <li key={item.reservationId} className={cx('reservationCard', { canceled: item.status === 'CANCELED' })}>
          <div className={cx('reservationMain')}>
            <span className={cx('hospitalName')}>
              {item.hospitalName}
              <span className={cx('badge')}>{STATUS_LABEL[item.status]}</span>
            </span>
            <span className={cx('hospitalMeta')}>
              {item.department} · {item.reservationDate} {item.reservationTime}
            </span>
            {item.symptomSummary && <span className={cx('hospitalMeta')}>{item.symptomSummary}</span>}
          </div>
          {onCancel && (item.status === 'BOOKED' || item.status === 'CONFIRMED') && (
            <button
              type="button"
              className={cx('cancelButton')}
              disabled={isCanceling}
              onClick={() => {
                if (window.confirm('예약을 취소할까요?')) onCancel(item.reservationId);
              }}
            >
              취소
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
