import { VisitDayCard } from '@/components/reservation/VisitDayCard';
import type { ChatToolName } from '@/service/interface/chat';
import { formatDateShort, kstToday } from '@/utils/reservation/reservationView';
import styles from './ChatToolCard.module.css';

interface Props {
  tool: ChatToolName;
  data: unknown;
  /** 말풍선에는 label 이 보인다 - value(예약 ID 등)는 화면에 내지 않는다. */
  onUiSelect: (field: string, value: string, label?: string) => void;
  /** 예약 목록은 AI로 묻지 않고 병원 가는 날 화면으로 간다. */
  onShowList: () => void;
  /** 같은 답에 [예약 목록 보기] 선택지가 따로 오면 카드의 버튼을 겹쳐 두지 않는다. */
  hideListButton?: boolean;
  variant?: 'guardian' | 'ward';
}

type HospitalItem = {
  id?: string | number;
  name?: string;
  address?: string;
  department?: string;
  phone?: string;
};

type AppointmentItem = {
  reservation_id?: string | number;
  id?: string | number;
  hospital_name?: string;
  department?: string;
  date?: string;
  time?: string;
  patient_name?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function shortDate(date?: string) {
  return date && ISO_DATE.test(date) ? formatDateShort(date) : (date ?? '');
}

export default function ChatToolCard({ tool, data, onUiSelect, onShowList, hideListButton, variant = 'guardian' }: Props) {
  const sizeClass = variant === 'ward' ? styles.ward : styles.guardian;
  const listButton = hideListButton ? null : (
    <button type="button" className={styles.listBtn} onClick={onShowList}>
      병원 가는 날 보기
    </button>
  );

  if (tool === 'search_hospital') {
    const hospitals = Array.isArray(data) ? (data as HospitalItem[]) : [];
    return (
      <div className={`${styles.card} ${sizeClass}`}>
        <p className={styles.cardTitle}>병원 검색 결과</p>
        {hospitals.length === 0 ? (
          <p className={styles.empty}>병원을 찾지 못했습니다.</p>
        ) : (
          <ul className={styles.hospitalList}>
            {hospitals.map((h, i) => (
              <li key={h.id ?? i} className={styles.hospitalItem}>
                <div className={styles.hospitalInfo}>
                  <strong>{h.name}</strong>
                  {h.department && <span>{h.department}</span>}
                  {h.address && <span className={styles.address}>{h.address}</span>}
                </div>
                <button
                  type="button"
                  className={styles.reserveBtn}
                  onClick={() => onUiSelect('hospital_confirm', h.name ?? '', h.name ? `${h.name} 예약하기` : undefined)}
                >
                  예약하기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (tool === 'make_appointment') {
    const appt = (data ?? {}) as AppointmentItem;
    // 병원·날짜가 있어야 병원 가는 날 카드로 보인다(없으면 받은 값만 표로).
    if (appt.hospital_name && appt.date) {
      return (
        <div className={`${styles.doneWrap} ${sizeClass}`}>
          <p className={styles.doneTitle}>예약했어요</p>
          <VisitDayCard
            compact
            ariaLabel="예약 완료"
            hospitalName={appt.hospital_name}
            department={appt.department}
            date={appt.date}
            time={appt.time ?? ''}
            today={kstToday()}
          />
          {appt.patient_name && <p className={styles.donePatient}>예약하신 분 {appt.patient_name}</p>}
          {listButton}
        </div>
      );
    }
    return (
      <div className={`${styles.card} ${styles.successCard} ${sizeClass}`}>
        <p className={styles.cardTitle}>예약 완료</p>
        <dl className={styles.apptDetail}>
          {appt.hospital_name && <><dt>병원</dt><dd>{appt.hospital_name}</dd></>}
          {appt.department && <><dt>진료과</dt><dd>{appt.department}</dd></>}
          {appt.date && <><dt>날짜</dt><dd>{shortDate(appt.date)}</dd></>}
          {appt.time && <><dt>시간</dt><dd>{appt.time}</dd></>}
          {appt.patient_name && <><dt>환자</dt><dd>{appt.patient_name}</dd></>}
        </dl>
        {listButton}
      </div>
    );
  }

  if (tool === 'list_my_appointments') {
    const list = Array.isArray(data) ? (data as AppointmentItem[]) : [];
    return (
      <div className={`${styles.card} ${sizeClass}`}>
        <p className={styles.cardTitle}>내 예약 목록</p>
        {list.length === 0 ? (
          <p className={styles.empty}>예약 내역이 없습니다.</p>
        ) : (
          <ul className={styles.apptList}>
            {list.map((a, i) => (
              <li key={a.reservation_id ?? a.id ?? i} className={styles.apptRow}>
                <div>
                  <strong>{a.hospital_name}</strong>
                  <span>{a.department} · {shortDate(a.date)} {a.time}</span>
                </div>
                <button
                  type="button"
                  className={styles.detailBtn}
                  onClick={() =>
                    onUiSelect(
                      'reservation_id',
                      String(a.reservation_id ?? a.id ?? ''),
                      [a.hospital_name, shortDate(a.date), a.time, '예약 보기'].filter(Boolean).join(' '),
                    )
                  }
                >
                  상세
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (tool === 'get_reservation') {
    const appt = (data ?? {}) as AppointmentItem;
    return (
      <div className={`${styles.card} ${sizeClass}`}>
        <p className={styles.cardTitle}>예약 상세</p>
        <dl className={styles.apptDetail}>
          {appt.hospital_name && <><dt>병원</dt><dd>{appt.hospital_name}</dd></>}
          {appt.department && <><dt>진료과</dt><dd>{appt.department}</dd></>}
          {appt.date && <><dt>날짜</dt><dd>{shortDate(appt.date)}</dd></>}
          {appt.time && <><dt>시간</dt><dd>{appt.time}</dd></>}
        </dl>
        {listButton}
      </div>
    );
  }

  return null;
}
