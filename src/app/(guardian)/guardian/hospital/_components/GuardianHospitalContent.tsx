'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import dayjs from 'dayjs';

import { RefreshButton } from '@/components/RefreshButton';
import { TabItem, Tabs } from '@/components/Tabs';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { cancelReservation, createReservation } from '@/service/api/guardian/reservation';
import { IHospital, IReservationItem } from '@/service/interface/reservation';
import {
  availableSlotsQueryOptions,
  hospitalsQueryOptions,
  myReservationsQueryKey,
  myReservationsQueryOptions,
} from '@/service/query/guardian/reservation';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import styles from './GuardianHospitalContent.module.css';

const cx = classNames.bind(styles);

type Tab = 'book' | 'history';

const TABS: TabItem<Tab>[] = [
  { value: 'book', label: '예약하기' },
  { value: 'history', label: '예약 내역' },
];

const STATUS_LABEL: Record<IReservationItem['status'], string> = {
  BOOKED: '예약됨',
  CONFIRMED: '확정',
  COMPLETED: '진료 완료',
  CANCELED: '취소됨',
};

const OPERATION_LABEL: Record<IHospital['operationStatus'], string> = {
  OPEN: '진료 중',
  CLOSED: '진료 종료',
  BREAK_TIME: '휴게 시간',
  HOLIDAY: '휴진',
};

const CONGESTION_LABEL: Record<IHospital['congestionLevel'], string> = {
  LOW: '여유',
  NORMAL: '보통',
  BUSY: '혼잡',
  VERY_BUSY: '매우 혼잡',
};

// 예약 서비스가 요구하는 형식과 동일
const PHONE_PATTERN = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

export function GuardianHospitalContent() {
  const queryClient = useQueryClient();
  const { activeWards, isLoading: isWardsLoading } = useGuardianActiveWards();
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const guardian = getUserProfileData(profileResponse);

  const [tab, setTab] = useState<Tab>('book');
  const [wardId, setWardId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [department, setDepartment] = useState('');
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [time, setTime] = useState('');
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [symptom, setSymptom] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const ward = activeWards.find(item => item.partnerUserId === wardId) ?? activeWards[0] ?? null;
  const patientPhone = phoneInput ?? ward?.partnerPhone ?? '';

  const {
    data: hospitals = [],
    isLoading: isHospitalsLoading,
    isError: isHospitalsError,
    refetch: refetchHospitals,
  } = useQuery(hospitalsQueryOptions);
  const { data: slots = [], isFetching: isSlotsLoading } = useQuery(availableSlotsQueryOptions(hospitalId, date));
  const { data: reservations = [], isLoading: isReservationsLoading } = useQuery(myReservationsQueryOptions);

  const hospital = hospitals.find(item => item.id === hospitalId) ?? null;
  const keyword = search.trim();
  const filteredHospitals = keyword
    ? hospitals.filter(item =>
        [item.name, item.region, item.address, ...item.departments].some(value => value.includes(keyword)),
      )
    : hospitals;

  const today = dayjs().format('YYYY-MM-DD');
  const visibleSlots = date === today ? slots.filter(slot => slot > dayjs().format('HH:mm')) : slots;

  const invalidateReservations = () => {
    queryClient.invalidateQueries({ queryKey: myReservationsQueryKey });
    queryClient.invalidateQueries({ queryKey: ['reservation-slots'] });
  };

  const createMutation = useMutation({
    mutationFn: createReservation,
    onSuccess: () => {
      invalidateReservations();
      setTime('');
      setSymptom('');
      setNotice({ tone: 'ok', text: '예약이 완료되었습니다.' });
      setTab('history');
    },
    onError: error => setNotice({ tone: 'bad', text: getErrorMessage(error) }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      invalidateReservations();
      setNotice({ tone: 'ok', text: '예약이 취소되었습니다.' });
    },
    onError: error => setNotice({ tone: 'bad', text: getErrorMessage(error) }),
  });

  const selectHospital = (item: IHospital) => {
    setHospitalId(item.id);
    setDepartment(item.departments[0] ?? '');
    setTime('');
    setNotice(null);
  };

  const canSubmit =
    Boolean(ward && hospital && department && date && time) && PHONE_PATTERN.test(patientPhone) && !createMutation.isPending;

  const submit = () => {
    if (!ward || !hospital) return;
    const guardianPhone = guardian?.phone && PHONE_PATTERN.test(guardian.phone) ? guardian.phone : undefined;
    const birthDate = ward.partnerBirthDate && /^\d{4}-\d{2}-\d{2}/.test(ward.partnerBirthDate) ? ward.partnerBirthDate.slice(0, 10) : undefined;
    createMutation.mutate({
      hospitalId: hospital.id,
      department,
      reservationDate: date,
      reservationTime: time,
      patientName: ward.partnerName,
      phone: patientPhone,
      birthDate,
      symptomSummary: symptom.trim() || undefined,
      guardianName: guardian?.name,
      guardianPhone,
    });
  };

  if (!isWardsLoading && activeWards.length === 0) {
    return <p className={cx('emptyText')}>연결된 피보호자가 없습니다. 먼저 피보호자를 연결해주세요.</p>;
  }

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>병원 예약</strong>
          <span className={cx('toolbarSub')}>{ward ? `${ward.partnerName} 님의 예약` : '피보호자를 불러오는 중'}</span>
        </div>
        <div className={cx('toolbarRight')}>
          <select
            className={cx('select')}
            aria-label="피보호자 선택"
            value={ward?.partnerUserId ?? ''}
            onChange={event => {
              setWardId(event.target.value);
              setPhoneInput(null);
            }}
          >
            {activeWards.map(item => (
              <option key={item.partnerUserId} value={item.partnerUserId}>
                {item.partnerName}
              </option>
            ))}
          </select>
          <RefreshButton
            ariaLabel="새로고침"
            disabled={isHospitalsLoading}
            onRefresh={() => {
              refetchHospitals();
              invalidateReservations();
            }}
          />
        </div>
      </header>

      <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="예약 메뉴" />
      {notice && <p className={cx('notice', notice.tone)}>{notice.text}</p>}

      {tab === 'book' ? (
        <div className={cx('booking')}>
          <div className={cx('field')}>
            <input
              className={cx('input')}
              type="search"
              placeholder="병원명, 지역, 진료과 검색"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            {isHospitalsLoading && <p className={cx('emptyText')}>병원 목록을 불러오는 중입니다.</p>}
            {isHospitalsError && <p className={cx('emptyText')}>병원 목록을 불러오지 못했습니다.</p>}
            <ul className={cx('hospitalList')}>
              {filteredHospitals.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cx('hospitalCard', { active: item.id === hospitalId })}
                    disabled={!item.bookingAvailable}
                    onClick={() => selectHospital(item)}
                  >
                    <span className={cx('hospitalName')}>{item.name}</span>
                    <span className={cx('hospitalMeta')}>
                      {item.region} · {item.departments.join(', ')}
                    </span>
                    <span className={cx('hospitalMeta')}>
                      {OPERATION_LABEL[item.operationStatus]} · {CONGESTION_LABEL[item.congestionLevel]} · {item.openTime}~
                      {item.closeTime}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {hospital ? (
            <form
              className={cx('form')}
              onSubmit={event => {
                event.preventDefault();
                submit();
              }}
            >
              <div>
                <strong className={cx('toolbarTitle')}>{hospital.name}</strong>
                <span className={cx('hospitalMeta')}>
                  {hospital.address} · {hospital.phone}
                </span>
              </div>

              <div className={cx('field')}>
                <span className={cx('fieldLabel')}>진료과</span>
                <div className={cx('chips')}>
                  {hospital.departments.map(name => (
                    <button
                      key={name}
                      type="button"
                      className={cx('chip', { active: name === department })}
                      onClick={() => setDepartment(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <label className={cx('field')}>
                <span className={cx('fieldLabel')}>날짜</span>
                <input
                  className={cx('input')}
                  type="date"
                  min={today}
                  value={date}
                  onChange={event => {
                    setDate(event.target.value);
                    setTime('');
                  }}
                />
              </label>

              <div className={cx('field')}>
                <span className={cx('fieldLabel')}>시간</span>
                {isSlotsLoading ? (
                  <span className={cx('hospitalMeta')}>예약 가능 시간을 확인하는 중입니다.</span>
                ) : visibleSlots.length === 0 ? (
                  <span className={cx('hospitalMeta')}>예약 가능한 시간이 없습니다.</span>
                ) : (
                  <div className={cx('chips')}>
                    {visibleSlots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        className={cx('chip', { active: slot === time })}
                        onClick={() => setTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className={cx('field')}>
                <span className={cx('fieldLabel')}>환자 연락처</span>
                <input
                  className={cx('input')}
                  type="tel"
                  placeholder="010-0000-0000"
                  value={patientPhone}
                  onChange={event => setPhoneInput(event.target.value)}
                />
              </label>

              <label className={cx('field')}>
                <span className={cx('fieldLabel')}>증상 (선택)</span>
                <textarea className={cx('textarea')} value={symptom} onChange={event => setSymptom(event.target.value)} />
              </label>

              <button type="submit" className={cx('submit')} disabled={!canSubmit}>
                {createMutation.isPending ? '예약 중입니다' : `${ward?.partnerName ?? ''} 님 예약하기`}
              </button>
            </form>
          ) : (
            <p className={cx('emptyText')}>예약할 병원을 선택하세요.</p>
          )}
        </div>
      ) : (
        <>
          {isReservationsLoading && <p className={cx('emptyText')}>예약 내역을 불러오는 중입니다.</p>}
          {!isReservationsLoading && reservations.length === 0 && (
            <p className={cx('emptyText')}>예약 내역이 없습니다.</p>
          )}
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
                {(item.status === 'BOOKED' || item.status === 'CONFIRMED') && (
                  <button
                    type="button"
                    className={cx('cancelButton')}
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      if (window.confirm('예약을 취소할까요?')) cancelMutation.mutate(item.reservationId);
                    }}
                  >
                    취소
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
