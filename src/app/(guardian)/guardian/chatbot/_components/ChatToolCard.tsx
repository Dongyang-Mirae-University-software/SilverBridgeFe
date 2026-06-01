import type { ChatToolName } from '@/service/interface/chat';
import styles from './ChatToolCard.module.css';

interface Props {
  tool: ChatToolName;
  data: unknown;
  onUiSelect: (field: string, value: string) => void;
}

type HospitalItem = {
  id?: string | number;
  name?: string;
  address?: string;
  department?: string;
  phone?: string;
};

type AppointmentItem = {
  reservation_id?: string;
  id?: string;
  hospital_name?: string;
  department?: string;
  date?: string;
  time?: string;
  patient_name?: string;
};

export default function ChatToolCard({ tool, data, onUiSelect }: Props) {
  if (tool === 'search_hospital') {
    const hospitals = Array.isArray(data) ? (data as HospitalItem[]) : [];
    return (
      <div className={styles.card}>
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
                  onClick={() => onUiSelect('hospital_confirm', h.name ?? '')}
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
    return (
      <div className={`${styles.card} ${styles.successCard}`}>
        <p className={styles.cardTitle}>예약 완료</p>
        <dl className={styles.apptDetail}>
          {appt.hospital_name && <><dt>병원</dt><dd>{appt.hospital_name}</dd></>}
          {appt.department && <><dt>진료과</dt><dd>{appt.department}</dd></>}
          {appt.date && <><dt>날짜</dt><dd>{appt.date}</dd></>}
          {appt.time && <><dt>시간</dt><dd>{appt.time}</dd></>}
          {appt.patient_name && <><dt>환자</dt><dd>{appt.patient_name}</dd></>}
        </dl>
        <button
          type="button"
          className={styles.listBtn}
          onClick={() => onUiSelect('reservation_followup', 'show_list')}
        >
          예약 목록 보기
        </button>
      </div>
    );
  }

  if (tool === 'list_my_appointments') {
    const list = Array.isArray(data) ? (data as AppointmentItem[]) : [];
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>내 예약 목록</p>
        {list.length === 0 ? (
          <p className={styles.empty}>예약 내역이 없습니다.</p>
        ) : (
          <ul className={styles.apptList}>
            {list.map((a, i) => (
              <li key={a.reservation_id ?? a.id ?? i} className={styles.apptRow}>
                <div>
                  <strong>{a.hospital_name}</strong>
                  <span>{a.department} · {a.date} {a.time}</span>
                </div>
                <button
                  type="button"
                  className={styles.detailBtn}
                  onClick={() => onUiSelect('reservation_id', a.reservation_id ?? a.id ?? '')}
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
      <div className={styles.card}>
        <p className={styles.cardTitle}>예약 상세</p>
        <dl className={styles.apptDetail}>
          {appt.hospital_name && <><dt>병원</dt><dd>{appt.hospital_name}</dd></>}
          {appt.department && <><dt>진료과</dt><dd>{appt.department}</dd></>}
          {appt.date && <><dt>날짜</dt><dd>{appt.date}</dd></>}
          {appt.time && <><dt>시간</dt><dd>{appt.time}</dd></>}
        </dl>
        <button
          type="button"
          className={styles.listBtn}
          onClick={() => onUiSelect('reservation_followup', 'show_list')}
        >
          예약 목록 보기
        </button>
      </div>
    );
  }

  return null;
}
