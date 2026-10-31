'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { takeReservationWardId } from '@/components/chatbot/reservationWardHandoff';
import { ReservationDemoNotice } from '@/components/reservation/ReservationDemoNotice';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { cancelReservation, createReservation } from '@/service/api/guardian/reservation';
import { IReservationCreateReq } from '@/service/interface/reservation';
import {
  availableSlotsQueryOptions,
  hospitalsQueryOptions,
  myReservationsQueryKey,
  myReservationsQueryOptions,
} from '@/service/query/guardian/reservation';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import {
  formatDateShort,
  formatTime,
  isSlotPassed,
  kstNowTime,
  kstToday,
  reservationErrorMessage,
} from '@/utils/reservation/reservationView';
import { useKstNow } from '@/utils/reservation/useKstNow';
import styles from './GuardianHospitalContent.module.css';
import { HospitalConfirmStep } from './HospitalConfirmStep';
import { HospitalDateTimeStep } from './HospitalDateTimeStep';
import { HospitalListStep } from './HospitalListStep';
import { HospitalSearchStep } from './HospitalSearchStep';
import { createErrorMessage, PHONE_PATTERN, Pick, pickOf } from './hospitalBooking';
import { CheckIcon, XIcon } from './hospitalIcons';

const cx = classNames.bind(styles);

type Step = 'list' | 'search' | 'datetime' | 'confirm' | 'done';
type Booked = { date: string; time: string; hospitalName: string; department: string; wardName: string };

const STEPS: { step: Step; label: string }[] = [
  { step: 'search', label: '병원 고르기' },
  { step: 'datetime', label: '날짜·시간' },
  { step: 'confirm', label: '확인' },
];
const SLOT_PASSED_MESSAGE = '고르신 시간이 이미 지났어요. 다른 시간을 골라 주세요.';

// 보호자 병원 예약 - 목록 → 1. 병원 고르기 → 2. 진료과·날짜·시간 → 3. 확인 → 완료 (Claude 디자인 2026-10-30)
export function GuardianHospitalContent() {
  const queryClient = useQueryClient();
  const { activeWards, isLoading: isWardsLoading } = useGuardianActiveWards();
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const guardian = getUserProfileData(profileResponse);

  const [wardId, setWardId] = useState<string | null>(null);
  // 챗봇 예약 칩에서 고른 피보호자 - 들어오자마자 저장소에서 꺼내 지우고, 목록이 오면 내 ACTIVE 피보호자일 때만 쓴다.
  // 확인이 끝나기 전에는 화면·예약 조회를 미룬다(첫 번째 피보호자가 잠깐 보이고 그 사람 예약을 부르지 않게).
  const handoffWardIdRef = useRef<string | null>(null);
  const [handoffChecked, setHandoffChecked] = useState(false);
  const [step, setStep] = useState<Step>('list');
  const [pick, setPick] = useState<Pick | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [query, setQuery] = useState('');
  const [hospitalPage, setHospitalPage] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  // 피보호자 번호를 [바꾸기]로 고치거나, 번호가 없어 새로 적을 때만 쓴다
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [symptom, setSymptom] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);
  const [listNotice, setListNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const doneTitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handoff = takeReservationWardId();
    if (handoff) handoffWardIdRef.current = handoff;
  }, []);

  useEffect(() => {
    if (handoffChecked || isWardsLoading) return;
    const handoff = handoffWardIdRef.current;
    handoffWardIdRef.current = null;
    if (handoff && activeWards.some(item => item.partnerUserId === handoff)) setWardId(handoff);
    setHandoffChecked(true);
  }, [handoffChecked, isWardsLoading, activeWards]);

  const ward = activeWards.find(item => item.partnerUserId === wardId) ?? activeWards[0] ?? null;
  const wardPhone = ward?.partnerPhone && PHONE_PATTERN.test(ward.partnerPhone) ? ward.partnerPhone : null;
  const patientPhone = wardPhone && !phoneEditing ? wardPhone : phoneInput.trim();

  const hospitalsQuery = useQuery(hospitalsQueryOptions);
  const hospitals = hospitalsQuery.data ?? [];
  const slotsQuery = useQuery(availableSlotsQueryOptions(pick?.hospital.id ?? null, date, pick?.department ?? ''));
  const reservationsQuery = useQuery({
    ...myReservationsQueryOptions(ward?.partnerUserId),
    enabled: Boolean(ward) && handoffChecked,
  });

  const { today, nowTime } = useKstNow();

  // 완료 화면이 뜨면 결과 제목으로 포커스를 옮겨 화면 읽기 프로그램이 바로 읽게 한다
  useEffect(() => {
    if (step === 'done') doneTitleRef.current?.focus();
  }, [step]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: myReservationsQueryKey });
    queryClient.invalidateQueries({ queryKey: ['reservation-slots'] });
  };

  const resetFlow = () => {
    setStep('list');
    setPick(null);
    setDate('');
    setTime('');
    setQuery('');
    setHospitalPage(0);
    setPhoneEditing(false);
    setPhoneInput('');
    setSymptom('');
    setSlotNotice(null);
    createMutation.reset();
  };

  const createMutation = useMutation({
    mutationFn: ({ wardId, body }: { wardId: string; body: IReservationCreateReq; hospitalName: string }) =>
      createReservation(wardId, body),
    // 병원 이름은 보낼 때의 값으로 - 화면 상태(pick)는 그 사이 바뀌었을 수 있다
    onSuccess: (_, { body, hospitalName }) => {
      invalidate();
      setBooked({
        date: body.reservationDate,
        time: body.reservationTime,
        hospitalName,
        department: body.department,
        wardName: body.patientName,
      });
      setStep('done');
    },
    // 그새 다른 예약이 시간을 잡았을 수 있어 빈 시간을 다시 받는다
    onError: () => queryClient.invalidateQueries({ queryKey: ['reservation-slots'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ wardId, reservationId }: { wardId: string; reservationId: number }) =>
      cancelReservation(wardId, reservationId),
    onSuccess: () => {
      invalidate();
      setListNotice({ tone: 'ok', text: '예약을 취소했어요.' });
    },
    onError: error => setListNotice({ tone: 'bad', text: reservationErrorMessage(error) }),
  });

  const choose = (next: Pick) => {
    setPick(next);
    setDate('');
    setTime('');
    setSlotNotice(null);
    setStep('datetime');
  };

  // 화면을 오래 열어 둔 사이 고른 시각이 지났으면 날짜·시간 단계로 되돌린다(예약 서비스도 오늘의 지난 시각은 막지 않는다)
  const slotStillAhead = () => {
    if (!isSlotPassed(date, time, kstToday(), kstNowTime())) return true;
    setTime('');
    setSlotNotice(SLOT_PASSED_MESSAGE);
    setStep('datetime');
    return false;
  };

  const submit = () => {
    if (!ward || !pick || !pick.department || !date || !time || !PHONE_PATTERN.test(patientPhone)) return;
    if (!slotStillAhead()) return;
    const guardianPhone = guardian?.phone && PHONE_PATTERN.test(guardian.phone) ? guardian.phone : undefined;
    const birthDate =
      ward.partnerBirthDate && /^\d{4}-\d{2}-\d{2}/.test(ward.partnerBirthDate)
        ? ward.partnerBirthDate.slice(0, 10)
        : undefined;
    const symptomSummary = symptom.trim();
    createMutation.mutate({
      wardId: ward.partnerUserId,
      hospitalName: pick.hospital.name,
      body: {
        hospitalId: pick.hospital.id,
        department: pick.department,
        reservationDate: date,
        reservationTime: time,
        patientName: ward.partnerName,
        phone: patientPhone,
        birthDate,
        guardianName: guardian?.name,
        guardianPhone,
        ...(symptomSummary ? { symptomSummary } : {}),
      },
    });
  };

  if (isWardsLoading || !handoffChecked) return <p className={cx('message')}>피보호자 정보를 불러오는 중이에요.</p>;
  if (!ward) return <p className={cx('message')}>연결된 피보호자가 없어요. 먼저 피보호자를 연결해 주세요.</p>;

  const stepIndex = STEPS.findIndex(item => item.step === step);
  const inFlow = stepIndex >= 0;

  return (
    <div className={cx('page')}>
      {(activeWards.length > 1 || inFlow) && (
        <div className={cx('head')}>
          {activeWards.length > 1 ? (
            <label className={cx('wardPicker')}>
              <span>진료받으실 분</span>
              <select
                className={cx('select')}
                value={ward.partnerUserId}
                disabled={inFlow}
                onChange={event => {
                  setWardId(event.target.value);
                  setPastPage(0);
                  setListNotice(null);
                }}
              >
                {activeWards.map(item => (
                  <option key={item.partnerUserId} value={item.partnerUserId}>
                    {item.partnerName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span />
          )}
          {inFlow && (
            <button
              type="button"
              className={cx('btn', 'ghost', 'headButton')}
              disabled={createMutation.isPending}
              onClick={resetFlow}
            >
              <XIcon />
              예약 취소
            </button>
          )}
        </div>
      )}

      {inFlow && (
        <ol className={cx('progress')} aria-label="예약 단계">
          {STEPS.map((item, i) => (
            <li
              key={item.step}
              className={cx('progressItem', { reached: i <= stepIndex, current: i === stepIndex })}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              <span className={cx('progressBar')} />
              <span className={cx('progressLabel')}>
                {i + 1}. {item.label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {step === 'list' && (
        <HospitalListStep
          wardName={ward.partnerName}
          reservations={reservationsQuery.data ?? []}
          isLoading={reservationsQuery.isLoading}
          error={reservationsQuery.isError ? reservationsQuery.error : null}
          onRetry={() => reservationsQuery.refetch()}
          hospitals={hospitals}
          today={today}
          nowTime={nowTime}
          pastPage={pastPage}
          onPastPage={setPastPage}
          notice={listNotice}
          isCanceling={cancelMutation.isPending}
          onAskCancel={() => setListNotice(null)}
          onCancel={reservationId =>
            cancelMutation.mutateAsync({ wardId: ward.partnerUserId, reservationId }).then(
              () => true,
              () => false,
            )
          }
          onNew={() => {
            setListNotice(null);
            setStep('search');
          }}
          onRebook={next => {
            setListNotice(null);
            choose(next);
          }}
        />
      )}

      {step === 'search' && (
        <HospitalSearchStep
          hospitals={hospitals}
          isLoading={hospitalsQuery.isLoading}
          error={hospitalsQuery.isError ? hospitalsQuery.error : null}
          onRetry={() => hospitalsQuery.refetch()}
          query={query}
          onQuery={value => {
            setQuery(value);
            setHospitalPage(0);
          }}
          page={hospitalPage}
          onPage={setHospitalPage}
          onChoose={hospital => choose(pickOf(hospital))}
        />
      )}

      {step === 'datetime' && pick && (
        <HospitalDateTimeStep
          pick={pick}
          onDepartment={department => {
            setPick({ ...pick, department });
            setTime('');
            setSlotNotice(null);
          }}
          onChangeHospital={() => setStep('search')}
          today={today}
          nowTime={nowTime}
          date={date}
          onDate={value => {
            setDate(value);
            setTime('');
            setSlotNotice(null);
          }}
          time={time}
          onTime={value => {
            setTime(value);
            setSlotNotice(null);
          }}
          slots={slotsQuery.data}
          slotsLoading={slotsQuery.isFetching && !slotsQuery.data}
          slotsError={slotsQuery.isError ? slotsQuery.error : null}
          notice={slotNotice}
          onNext={() => {
            if (!slotStillAhead()) return;
            createMutation.reset();
            setStep('confirm');
          }}
        />
      )}

      {step === 'confirm' && pick && (
        <HospitalConfirmStep
          pick={pick}
          date={date}
          time={time}
          wardName={ward.partnerName}
          wardPhone={wardPhone}
          phoneEditing={phoneEditing}
          phoneInput={phoneInput}
          patientPhone={patientPhone}
          onEditPhone={() => {
            setPhoneEditing(true);
            setPhoneInput(wardPhone ?? '');
          }}
          onPhoneInput={setPhoneInput}
          symptom={symptom}
          onSymptom={setSymptom}
          isPending={createMutation.isPending}
          errorText={createMutation.isError ? createErrorMessage(createMutation.error, ward.partnerName) : null}
          onBack={() => setStep('datetime')}
          onSubmit={submit}
        />
      )}

      {step === 'done' && booked && (
        <div className={cx('card', 'doneCard')} role="status">
          <span className={cx('doneCheck')}>
            <CheckIcon />
          </span>
          <div ref={doneTitleRef} tabIndex={-1} className={cx('doneTitle')}>
            예약했어요
          </div>
          <div className={cx('doneSummary')}>
            <div className={cx('doneWhen')}>
              {formatDateShort(booked.date)} <span className={cx('brandText')}>{formatTime(booked.time)}</span>
            </div>
            <div className={cx('doneWhere')}>
              {booked.hospitalName} · {booked.department}
            </div>
          </div>
          <div className={cx('doneNote')}>{booked.wardName} 화면에서도 볼 수 있어요</div>
          <ReservationDemoNotice />
          <button
            type="button"
            className={cx('btn', 'primary', 'doneButton')}
            onClick={() => {
              setBooked(null);
              resetFlow();
            }}
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
