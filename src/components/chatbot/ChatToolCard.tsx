import { useState } from 'react';

import { VisitDayCard } from '@/components/reservation/VisitDayCard';
import type { ChatToolName } from '@/service/interface/chat';
import { formatDateShort, kstToday } from '@/utils/reservation/reservationView';
import styles from './ChatToolCard.module.css';
import { commonDepartment, HOSPITAL_PREVIEW_COUNT, shortAddress, splitDepartments } from './hospitalListView';

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
    return <HospitalResults hospitals={hospitals} sizeClass={sizeClass} ward={variant === 'ward'} onUiSelect={onUiSelect} />;
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
          {/* 피보호자 화면은 본인 예약이라 "예약하신 분" 줄을 빼 카드만 크게 본다(2026-11-26) */}
          {appt.patient_name && variant !== 'ward' && <p className={styles.donePatient}>예약하신 분 {appt.patient_name}</p>}
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
            {list.map((a, i) => {
              const reservationId = String(a.reservation_id ?? a.id ?? '').trim();
              return (
                <li key={reservationId || i} className={styles.apptRow}>
                  <div>
                    <strong>{a.hospital_name}</strong>
                    <span>{a.department} · {shortDate(a.date)} {a.time}</span>
                  </div>
                  {reservationId && (
                    <button
                      type="button"
                      className={styles.detailBtn}
                      onClick={() =>
                        onUiSelect(
                          'reservation_id',
                          reservationId,
                          [a.hospital_name, shortDate(a.date), a.time, '예약 보기'].filter(Boolean).join(' '),
                        )
                      }
                    >
                      상세
                    </button>
                  )}
                </li>
              );
            })}
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

// 병원 검색 결과(2026-11-23 사용자 결정 A안) - 병원마다 진료과 전체와 긴 주소를 나열하던 것을 줄였다.
// 고른 진료과 하나(모든 병원에 공통인 진료과)와 "구 + 길" 주소만, 처음엔 3곳만 보이고 [병원 더 보기]로 나머지를 편다
// 제목은 "병원 N곳"만 - AI는 지역만으로도 검색하고(진료과 없이) 카드에 검색한 진료과를 싣지 않아, 공통 진료과를 제목에 넣으면
// 우연히 모든 병원에 있는 과가 "고른 과"처럼 보일 수 있다(2026-11-23 FE 디자인 점검 D-4, 사용자 결정). 병원별 칩은 그 병원에 실제로 있는 과라 그대로 둔다
// 피보호자(2026-11-26 사용자 결정): 제목 "병원 N곳" 없이 병원마다 큰 카드 + 가로 전체 폭 [이 병원 예약하기]. 말풍선 안내 문장은 ChatBubble 이 숨긴다
function HospitalResults({ hospitals, sizeClass, ward, onUiSelect }: {
  hospitals: HospitalItem[];
  sizeClass: string;
  ward: boolean;
  onUiSelect: Props['onUiSelect'];
}) {
  const [showAll, setShowAll] = useState(false);
  const common = commonDepartment(hospitals.map(h => h.department));
  const visible = showAll ? hospitals : hospitals.slice(0, HOSPITAL_PREVIEW_COUNT);
  const hidden = hospitals.length - visible.length;
  const cardsOnly = ward && hospitals.length > 0;
  return (
    <div className={`${cardsOnly ? styles.wardHospitals : styles.card} ${sizeClass}`}>
      {!cardsOnly && (
        <p className={styles.cardTitle}>
          {hospitals.length === 0 ? '병원 검색 결과' : `병원 ${hospitals.length}곳`}
        </p>
      )}
      {hospitals.length === 0 ? (
        <p className={styles.empty}>병원을 찾지 못했습니다.</p>
      ) : (
        <>
          <ul className={styles.hospitalList}>
            {visible.map((h, i) => {
              const name = h.name?.trim();
              const count = splitDepartments(h.department).length;
              const tag = common ?? (count > 0 ? `진료과 ${count}개` : null);
              const place = shortAddress(h.address);
              return (
                <li key={h.id ?? i} className={`${styles.hospitalItem} ${cardsOnly ? styles.wardHospitalCard : ''}`}>
                  <div className={styles.hospitalInfo}>
                    <strong>{h.name}</strong>
                    {(tag || place) && (
                      <span className={styles.hospitalMeta}>
                        {tag && <span className={styles.deptChip}>{tag}</span>}
                        {place && <span className={styles.address}>{place}</span>}
                      </span>
                    )}
                  </div>
                  {/* 병원 이름이 없으면 고를 값이 없다 - 빈 값으로 보내지 않게 버튼을 두지 않는다(점검 🟡) */}
                  {name && (
                    <button
                      type="button"
                      className={`${styles.reserveBtn} ${cardsOnly ? styles.wardReserveBtn : ''}`}
                      aria-label={`${name} 예약하기`}
                      onClick={() => onUiSelect('hospital_confirm', name, `${name} 예약하기`)}
                    >
                      {cardsOnly ? '이 병원 예약하기' : '예약'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <button type="button" className={styles.moreBtn} onClick={() => setShowAll(true)}>
              병원 더 보기 ({hidden}곳)
            </button>
          )}
        </>
      )}
    </div>
  );
}