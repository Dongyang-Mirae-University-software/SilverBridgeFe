'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { ReservationPager } from '@/components/reservation/ReservationPager';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { cancelReservation, createReservation } from '@/service/api/guardian/reservation';
import { IHospital, IReservationCreateReq, IReservationItem } from '@/service/interface/reservation';
import {
  availableSlotsQueryOptions,
  hospitalsQueryOptions,
  myReservationsQueryKey,
  myReservationsQueryOptions,
} from '@/service/query/guardian/reservation';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import {
  buildDays,
  buildSlotGrid,
  daysBetween,
  findHospitalByName,
  formatDateShort,
  formatSlot,
  formatTime,
  hospitalRows,
  isHospitalOpenNow,
  isSlotPassed,
  kstNowTime,
  kstToday,
  reservationErrorMessage,
  splitReservations,
} from '@/utils/reservation/reservationView';
import { useKstNow } from '@/utils/reservation/useKstNow';
import styles from './GuardianHospitalContent.module.css';

const cx = classNames.bind(styles);

type Step = 'list' | 'search' | 'datetime' | 'confirm' | 'done';
type Pick = { hospital: IHospital; department: string };
type Booked = { date: string; time: string; hospitalName: string; department: string; wardName: string };

const STEPS: { step: Step; label: string }[] = [
  { step: 'search', label: '병원 고르기' },
  { step: 'datetime', label: '날짜·시간' },
  { step: 'confirm', label: '확인' },
];
const PER_PAGE = 5;
const SLOT_PASSED_MESSAGE = '고르신 시간이 이미 지났어요. 다른 시간을 골라 주세요.';

// 예약 서비스가 요구하는 형식과 동일
const PHONE_PATTERN = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon')}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'iconLg')}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'iconLg', 'iconMute')}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'checkIcon')}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function GuardianHospitalContent() {
  const queryClient = useQueryClient();
  const { activeWards, isLoading: isWardsLoading } = useGuardianActiveWards();
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const guardian = getUserProfileData(profileResponse);

  const [wardId, setWardId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('list');
  const [pick, setPick] = useState<Pick | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [query, setQuery] = useState('');
  const [hospitalPage, setHospitalPage] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const [phoneInput, setPhoneInput] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [listNotice, setListNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const doneTitleRef = useRef<HTMLDivElement>(null);

  const ward = activeWards.find(item => item.partnerUserId === wardId) ?? activeWards[0] ?? null;
  const wardPhone = ward?.partnerPhone && PHONE_PATTERN.test(ward.partnerPhone) ? ward.partnerPhone : null;
  const patientPhone = wardPhone ?? phoneInput.trim();

  const hospitalsQuery = useQuery(hospitalsQueryOptions);
  const hospitals = hospitalsQuery.data ?? [];
  const slotsQuery = useQuery(availableSlotsQueryOptions(pick?.hospital.id ?? null, date));
  const reservationsQuery = useQuery({ ...myReservationsQueryOptions(ward?.partnerUserId), enabled: Boolean(ward) });

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
    setPhoneInput('');
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
      setCancelTarget(null);
      setListNotice({ tone: 'ok', text: '예약을 취소했어요.' });
    },
    onError: error => {
      setCancelTarget(null);
      setListNotice({ tone: 'bad', text: reservationErrorMessage(error) });
    },
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
    if (!ward || !pick || !date || !time || !PHONE_PATTERN.test(patientPhone)) return;
    if (!slotStillAhead()) return;
    const guardianPhone = guardian?.phone && PHONE_PATTERN.test(guardian.phone) ? guardian.phone : undefined;
    const birthDate =
      ward.partnerBirthDate && /^\d{4}-\d{2}-\d{2}/.test(ward.partnerBirthDate)
        ? ward.partnerBirthDate.slice(0, 10)
        : undefined;
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
      },
    });
  };

  if (isWardsLoading) return <p className={cx('message')}>피보호자 정보를 불러오는 중이에요.</p>;
  if (!ward) return <p className={cx('message')}>연결된 피보호자가 없어요. 먼저 피보호자를 연결해 주세요.</p>;

  const phoneInvalid = Boolean(phoneInput) && !PHONE_PATTERN.test(patientPhone);
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
                  setCancelTarget(null);
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
        <ListStep
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
          cancelTarget={cancelTarget}
          isCanceling={cancelMutation.isPending}
          onAskCancel={id => {
            setListNotice(null);
            setCancelTarget(id);
          }}
          onCancel={reservationId => cancelMutation.mutate({ wardId: ward.partnerUserId, reservationId })}
          onKeep={() => setCancelTarget(null)}
          onNew={() => {
            setListNotice(null);
            setCancelTarget(null);
            setStep('search');
          }}
          onRebook={next => {
            setListNotice(null);
            setCancelTarget(null);
            choose(next);
          }}
        />
      )}

      {step === 'search' && (
        <SearchStep
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
          onChoose={choose}
        />
      )}

      {step === 'datetime' && pick && (
        <>
          <div className={cx('card', 'pickedCard')}>
            <div className={cx('pickedName')}>
              {pick.hospital.name} <span className={cx('pickedDept')}>· {pick.department}</span>
            </div>
            <button type="button" className={cx('btn', 'ghost', 'smallButton')} onClick={() => setStep('search')}>
              병원 바꾸기
            </button>
          </div>

          <section className={cx('card', 'pad22')} aria-label="날짜">
            <h2 className={cx('cardTitle')}>날짜</h2>
            <div className={cx('days')}>
              {buildDays(today).map(day => (
                <button
                  key={day.iso}
                  type="button"
                  className={cx('day', { selected: date === day.iso, sunday: day.weekday === '일' })}
                  aria-pressed={date === day.iso}
                  aria-label={`${formatDateShort(day.iso)}${day.iso === today ? ' 오늘' : ''}`}
                  onClick={() => {
                    setDate(day.iso);
                    setTime('');
                    setSlotNotice(null);
                  }}
                >
                  <span className={cx('weekday')}>{day.weekday}</span>
                  <span className={cx('dayNumber')}>{day.day}</span>
                </button>
              ))}
            </div>
          </section>

          {date && (
            <section className={cx('card', 'pad22')} aria-label="시간">
              <h2 className={cx('cardTitle')}>
                시간 <span className={cx('cardTitleSub')}>· {formatDateShort(date)}</span>
              </h2>
              <SlotPicker
                hospital={pick.hospital}
                available={slotsQuery.data}
                isLoading={slotsQuery.isFetching && !slotsQuery.data}
                error={slotsQuery.isError ? slotsQuery.error : null}
                isToday={date === today}
                nowTime={nowTime}
                time={time}
                onTime={value => {
                  setTime(value);
                  setSlotNotice(null);
                }}
              />
            </section>
          )}

          {slotNotice && (
            <p className={cx('notice', 'bad')} role="alert">
              {slotNotice}
            </p>
          )}

          <button
            type="button"
            className={cx('btn', 'primary', 'wide')}
            disabled={!(date && time)}
            onClick={() => {
              if (!slotStillAhead()) return;
              createMutation.reset();
              setStep('confirm');
            }}
          >
            다음
          </button>
        </>
      )}

      {step === 'confirm' && pick && (
        <>
          <div className={cx('card', 'confirmCard')}>
            <div className={cx('confirmAsk')}>이대로 예약할까요?</div>
            <div className={cx('confirmWhen')}>
              {formatDateShort(date)} {formatTime(time)}
            </div>
            <div className={cx('confirmWhere')}>
              {pick.hospital.name} <span className={cx('pickedDept')}>· {pick.department}</span>
            </div>
            {/*
              v13 확인 단계는 날짜·시간·병원만 크게 보여 준다.
              이전 주소·진료 대상 표시 구조는 아래처럼 남겨 둔다. 예약 요청에는 계속 ward 정보를 전송한다.
              <div className={cx('confirmAddress')}>{pick.hospital.address}</div>
              <div className={cx('confirmWho')}>진료받으실 분: {ward.partnerName}</div>
            */}
            {!wardPhone && (
              <label className={cx('phoneField')}>
                <span>병원 연락을 받을 번호</span>
                <input
                  className={cx('input')}
                  type="tel"
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  value={phoneInput}
                  aria-invalid={phoneInvalid}
                  aria-describedby={phoneInvalid ? 'hospital-phone-hint hospital-phone-error' : 'hospital-phone-hint'}
                  onChange={event => setPhoneInput(event.target.value)}
                />
                <span id="hospital-phone-hint" className={cx('fieldHint')}>
                  {ward.partnerName} 계정에 휴대폰 번호가 없어 예약에 쓸 번호를 적어 주세요.
                </span>
                {phoneInvalid && (
                  <span id="hospital-phone-error" className={cx('fieldError')}>
                    010-1234-5678처럼 휴대폰 번호를 적어 주세요.
                  </span>
                )}
              </label>
            )}
          </div>
          {createMutation.isError && (
            <p className={cx('notice', 'bad')} role="alert">
              {reservationErrorMessage(createMutation.error)}
            </p>
          )}
          <div className={cx('confirmButtons')}>
            <button
              type="button"
              className={cx('btn', 'ghost', 'tall')}
              disabled={createMutation.isPending}
              onClick={() => setStep('datetime')}
            >
              이전
            </button>
            <button
              type="button"
              className={cx('btn', 'primary', 'tall')}
              disabled={createMutation.isPending || !PHONE_PATTERN.test(patientPhone)}
              onClick={submit}
            >
              {createMutation.isPending ? '예약하는 중' : '예약하기'}
            </button>
          </div>
        </>
      )}

      {step === 'done' && booked && (
        <div className={cx('card', 'doneCard')} role="status">
          <span className={cx('doneCheck')}>
            <CheckIcon />
          </span>
          <div ref={doneTitleRef} tabIndex={-1} className={cx('doneTitle')}>
            예약했어요
          </div>
          <div className={cx('doneWhen')}>
            {formatDateShort(booked.date)} {formatTime(booked.time)}
          </div>
          <div className={cx('doneWhere')}>
            {booked.hospitalName} · {booked.department}
          </div>
          <div className={cx('doneNote')}>{booked.wardName} 화면에서도 볼 수 있어요</div>
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

interface ListStepProps {
  wardName: string;
  reservations: IReservationItem[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  hospitals: IHospital[];
  today: string;
  nowTime: string;
  pastPage: number;
  onPastPage: (page: number) => void;
  notice: { tone: 'ok' | 'bad'; text: string } | null;
  cancelTarget: number | null;
  isCanceling: boolean;
  onAskCancel: (reservationId: number) => void;
  onCancel: (reservationId: number) => void;
  onKeep: () => void;
  onNew: () => void;
  onRebook: (pick: Pick) => void;
}

function ListStep(props: ListStepProps) {
  const { reservations, hospitals, today, nowTime } = props;
  // 취소 확인으로 바뀌면 [아니요]로 포커스를 옮긴다(누른 버튼이 사라져 포커스가 길을 잃지 않게)
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (props.cancelTarget !== null) keepRef.current?.focus();
  }, [props.cancelTarget]);
  const newButton = (
    <button type="button" className={cx('btn', 'primary', 'newButton')} onClick={props.onNew}>
      <PlusIcon />새 진료 예약하기
    </button>
  );

  if (props.isLoading) {
    return (
      <>
        <div className={cx('card', 'nextCard')}>
          <p className={cx('message', 'inline')}>{props.wardName}의 예약을 불러오는 중이에요.</p>
          {newButton}
        </div>
      </>
    );
  }
  if (props.error) {
    return (
      <div className={cx('card', 'nextCard')} role="alert">
        <p className={cx('message', 'inline')}>{reservationErrorMessage(props.error)}</p>
        <button type="button" className={cx('btn', 'ghost', 'headButton')} onClick={props.onRetry}>
          다시 불러오기
        </button>
      </div>
    );
  }

  const { upcoming, past } = splitReservations(reservations, today, nowTime);
  const [next, ...others] = upcoming;
  const pastTotal = Math.ceil(past.length / PER_PAGE);
  const page = Math.min(props.pastPage, Math.max(0, pastTotal - 1));

  // 지난 예약의 병원을 다시 고를 수 있을 때만 버튼을 둔다(예약 응답엔 병원 ID가 없어 이름으로 찾는다)
  const rebookOf = (item: IReservationItem): Pick | null => {
    const hospital = findHospitalByName(hospitals, item.hospitalName);
    return hospital?.bookingAvailable && isHospitalOpenNow(hospital) && hospital.departments.includes(item.department)
      ? { hospital, department: item.department }
      : null;
  };

  const cancelControls = (item: IReservationItem) =>
    props.cancelTarget === item.reservationId ? (
      <div className={cx('cancelAsk')} role="group" aria-label="예약 취소 확인">
        <span>이 예약을 취소할까요?</span>
        <button ref={keepRef} type="button" className={cx('btn', 'ghost', 'smallButton')} onClick={props.onKeep}>
          아니요
        </button>
        <button
          type="button"
          className={cx('btn', 'primary', 'smallButton')}
          disabled={props.isCanceling}
          onClick={() => props.onCancel(item.reservationId)}
        >
          {props.isCanceling ? '취소하는 중' : '예약 취소하기'}
        </button>
      </div>
    ) : (
      <button
        type="button"
        className={cx('btn', 'ghost', 'smallButton')}
        aria-label={`${formatDateShort(item.reservationDate)} ${formatTime(item.reservationTime)} ${item.hospitalName} 예약 취소`}
        onClick={() => props.onAskCancel(item.reservationId)}
      >
        이 예약 취소
      </button>
    );

  return (
    <>
      {/* 알림 영역은 늘 두고 내용만 바꾼다 - 새로 생기는 영역은 화면 읽기 프로그램이 놓칠 수 있다 */}
      <div aria-live="polite">
        {props.notice && <p className={cx('notice', props.notice.tone)}>{props.notice.text}</p>}
      </div>

      <section className={cx('card', 'nextCard')} aria-label="다음 진료">
        <div className={cx('nextBody')}>
          <div className={cx('nextTop')}>
            <span className={cx('nextLabel')}>다음 진료</span>
            {next && (
              <span className={cx('dday')}>
                {daysBetween(today, next.reservationDate) === 0
                  ? '오늘'
                  : `${daysBetween(today, next.reservationDate)}일 남음`}
              </span>
            )}
          </div>
          {next ? (
            <>
              <div className={cx('nextWhen')}>
                {formatDateShort(next.reservationDate)} {formatTime(next.reservationTime)}
              </div>
              <div className={cx('nextWhere')}>
                {next.hospitalName} · {next.department}
              </div>
            </>
          ) : (
            <div className={cx('nextEmpty')}>예정된 진료가 없어요</div>
          )}
        </div>
        <div className={cx('nextActions')}>
          {newButton}
          {next && cancelControls(next)}
        </div>
      </section>

      {others.length > 0 && (
        <section className={cx('card', 'listCard')} aria-label="그 밖의 예약">
          <h2 className={cx('listHead')}>그 밖의 예약</h2>
          {others.map(item => (
            <div key={item.reservationId} className={cx('row')}>
              <span className={cx('rowDate', 'rowDateWide')}>
                {formatDateShort(item.reservationDate)} {formatTime(item.reservationTime)}
              </span>
              <span className={cx('rowName')}>
                {item.hospitalName} <span className={cx('rowDept')}>· {item.department}</span>
              </span>
              {cancelControls(item)}
            </div>
          ))}
        </section>
      )}

      <section className={cx('card', 'listCard')} aria-label="지난 진료">
        <h2 className={cx('listHead')}>지난 진료</h2>
        {past.length === 0 ? (
          <p className={cx('emptyRow')}>지난 진료가 없어요</p>
        ) : (
          past.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(item => {
            const rebook = rebookOf(item);
            return (
              <div key={item.reservationId} className={cx('row', { canceled: item.status === 'CANCELED' })}>
                <span className={cx('rowDate')}>{formatDateShort(item.reservationDate)}</span>
                <span className={cx('rowName')}>
                  {item.hospitalName} <span className={cx('rowDept')}>· {item.department}</span>
                  {item.status === 'CANCELED' && <span className={cx('tag')}> 취소됨</span>}
                </span>
                {rebook && (
                  <button
                    type="button"
                    className={cx('btn', 'ghost', 'smallButton')}
                    aria-label={`${item.hospitalName} ${item.department} 다시 예약`}
                    onClick={() => props.onRebook(rebook)}
                  >
                    같은 곳 다시 예약
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>
      <ReservationPager page={page} total={pastTotal} onChange={props.onPastPage} label="지난 진료 페이지" />
    </>
  );
}

interface SearchStepProps {
  hospitals: IHospital[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  query: string;
  onQuery: (value: string) => void;
  page: number;
  onPage: (page: number) => void;
  onChoose: (pick: Pick) => void;
}

function SearchStep({ hospitals, isLoading, error, onRetry, query, onQuery, page, onPage, onChoose }: SearchStepProps) {
  const rows = hospitalRows(hospitals, query);
  const total = Math.ceil(rows.length / PER_PAGE);
  const current = Math.min(page, Math.max(0, total - 1));

  return (
    <>
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
          rows.slice(current * PER_PAGE, (current + 1) * PER_PAGE).map(({ hospital, department }) => {
            // 예약 서비스는 지금 진료 중이 아닌 병원의 예약을 거절한다 - 끝까지 고른 뒤 거절되지 않게 미리 막는다
            const open = isHospitalOpenNow(hospital);
            return (
              <button
                key={`${hospital.id}-${department}`}
                type="button"
                className={cx('hospitalRow', { closed: !open })}
                disabled={!open}
                onClick={() => onChoose({ hospital, department })}
              >
                <span className={cx('hospitalText')}>
                  <span className={cx('hospitalName')}>
                    {hospital.name} <span className={cx('hospitalDept')}>· {department}</span>
                  </span>
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

interface SlotPickerProps {
  hospital: IHospital;
  available?: string[];
  isLoading: boolean;
  error: unknown;
  isToday: boolean;
  nowTime: string;
  time: string;
  onTime: (time: string) => void;
}

function SlotPicker({ hospital, available, isLoading, error, isToday, nowTime, time, onTime }: SlotPickerProps) {
  if (isLoading) return <p className={cx('message', 'inline')}>예약할 수 있는 시간을 확인하는 중이에요.</p>;
  if (error) return <p className={cx('message', 'inline')}>{reservationErrorMessage(error)}</p>;

  const slots = buildSlotGrid(hospital.openTime, hospital.closeTime, available ?? [], { isToday, nowTime });
  if (slots.length === 0 || slots.every(slot => slot.taken)) {
    return <p className={cx('message', 'inline')}>이날은 예약할 수 있는 시간이 없어요. 다른 날을 골라 주세요.</p>;
  }

  const groups = [
    { label: '오전', list: slots.filter(slot => slot.time < '12:00') },
    { label: '오후', list: slots.filter(slot => slot.time >= '12:00') },
  ].filter(group => group.list.length > 0);

  return (
    <div className={cx('slotGroups')}>
      {groups.map(group => (
        <div key={group.label} className={cx('slotRow')}>
          <span className={cx('slotLabel')}>{group.label}</span>
          <div className={cx('slots')}>
            {group.list.map(slot => (
              <button
                key={slot.time}
                type="button"
                className={cx('slot', { selected: time === slot.time })}
                disabled={slot.taken}
                aria-pressed={time === slot.time}
                aria-label={`${formatTime(slot.time)}${slot.taken ? ' 마감' : ''}`}
                onClick={() => onTime(slot.time)}
              >
                {slot.taken ? '마감' : formatSlot(slot.time)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
