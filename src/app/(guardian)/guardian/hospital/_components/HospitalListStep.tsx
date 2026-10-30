import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { ReservationPager } from '@/components/reservation/ReservationPager';
import { IHospital, IReservationItem } from '@/service/interface/reservation';
import {
  daysBetween,
  findHospitalByName,
  formatDateShort,
  formatTime,
  isHospitalOpenNow,
  pastStatusLabel,
  reservationErrorMessage,
  splitReservations,
} from '@/utils/reservation/reservationView';
import styles from './GuardianHospitalContent.module.css';
import { ddayLabel, Pick } from './hospitalBooking';
import { ChevronIcon, PlusIcon } from './hospitalIcons';

const cx = classNames.bind(styles);

const PAST_PER_PAGE = 6;

interface Props {
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
  isCanceling: boolean;
  onAskCancel: () => void;
  // 끝나면 성공 여부를 돌려준다(성공·실패 모두 확인 창은 닫고 결과는 알림 줄에 보인다)
  onCancel: (reservationId: number) => Promise<boolean>;
  onNew: () => void;
  onRebook: (pick: Pick) => void;
}

export function HospitalListStep(props: Props) {
  const { reservations, hospitals, today, nowTime } = props;
  const [cancelTarget, setCancelTarget] = useState<IReservationItem | null>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const askCancel = (item: IReservationItem, opener: HTMLElement) => {
    openerRef.current = opener;
    props.onAskCancel();
    setCancelTarget(item);
  };

  // 창을 닫으면 누른 버튼으로 포커스를 돌린다 - 취소돼 그 줄이 사라졌으면 [새 진료 예약하기]로
  const closeDialog = () => {
    setCancelTarget(null);
    const opener = openerRef.current;
    requestAnimationFrame(() => (opener?.isConnected ? opener : newButtonRef.current)?.focus());
  };

  const newButton = (
    <button ref={newButtonRef} type="button" className={cx('ctaButton')} onClick={props.onNew}>
      <span className={cx('ctaIcon')}>
        <PlusIcon />
      </span>
      <span className={cx('ctaText')}>새 진료 예약하기</span>
      <ChevronIcon />
    </button>
  );

  if (props.isLoading || props.error) {
    return (
      <>
        {newButton}
        {props.isLoading ? (
          <div className={cx('card', 'emptyCard')}>
            <p className={cx('message', 'inline')}>{props.wardName}의 예약을 불러오는 중이에요.</p>
          </div>
        ) : (
          <div className={cx('card', 'emptyCard')} role="alert">
            <p className={cx('message', 'inline')}>{reservationErrorMessage(props.error)}</p>
            <button type="button" className={cx('btn', 'ghost', 'smallButton')} onClick={props.onRetry}>
              다시 불러오기
            </button>
          </div>
        )}
      </>
    );
  }

  const { upcoming, past } = splitReservations(reservations, today, nowTime);
  const [next, ...others] = upcoming;
  const pastTotal = Math.ceil(past.length / PAST_PER_PAGE);
  const page = Math.min(props.pastPage, Math.max(0, pastTotal - 1));

  // 지난 예약의 병원을 다시 고를 수 있을 때만 [다시 예약]을 둔다(예약 응답엔 병원 ID가 없어 이름으로 찾는다)
  const rebookOf = (item: IReservationItem): Pick | null => {
    const hospital = findHospitalByName(hospitals, item.hospitalName);
    return hospital?.bookingAvailable && isHospitalOpenNow(hospital) && hospital.departments.includes(item.department)
      ? { hospital, department: item.department }
      : null;
  };

  const cancelButton = (item: IReservationItem, className?: string) => (
    <button
      type="button"
      className={cx('btn', 'ghost', 'cancelButton', className)}
      aria-label={`${formatDateShort(item.reservationDate)} ${formatTime(item.reservationTime)} ${item.hospitalName} 예약 취소`}
      onClick={event => askCancel(item, event.currentTarget)}
    >
      예약 취소
    </button>
  );

  return (
    <>
      {newButton}

      {/* 알림 영역은 늘 두고 내용만 바꾼다 - 새로 생기는 영역은 화면 읽기 프로그램이 놓칠 수 있다 */}
      <div aria-live="polite">
        {props.notice && <p className={cx('notice', props.notice.tone)}>{props.notice.text}</p>}
      </div>

      <section className={cx('section')} aria-labelledby="hospital-upcoming-title">
        <h2 id="hospital-upcoming-title" className={cx('sectionTitle')}>
          예약 현황 <span className={cx('sectionCount')}>{upcoming.length}건</span>
        </h2>

        {next ? (
          <div className={cx('card', 'nextCard')} role="group" aria-label="다음 진료">
            <div className={cx('nextDday')}>
              <span className={cx('nextLabel')}>다음 진료</span>
              <span className={cx('ddayBig')}>{ddayLabel(daysBetween(today, next.reservationDate))}</span>
            </div>
            <div className={cx('nextBody')}>
              <div className={cx('nextText')}>
                <div className={cx('nextWhen')}>
                  {formatDateShort(next.reservationDate)}{' '}
                  <span className={cx('brandText')}>{formatTime(next.reservationTime)}</span>
                </div>
                <div className={cx('nextWhere')}>
                  {next.hospitalName} <span className={cx('dept')}>· {next.department}</span>
                </div>
              </div>
              {cancelButton(next, 'nextCancel')}
            </div>
          </div>
        ) : (
          <div className={cx('card', 'emptyCard')}>
            <p className={cx('emptyText')}>잡혀 있는 예약이 없어요</p>
          </div>
        )}

        {others.length > 0 && (
          <div className={cx('card', 'listCard')} role="group" aria-label="그 밖의 예약">
            {others.map(item => (
              <div key={item.reservationId} className={cx('moreRow')}>
                <span className={cx('ddayChip')}>{ddayLabel(daysBetween(today, item.reservationDate))}</span>
                <span className={cx('moreText')}>
                  <span className={cx('moreWhen')}>
                    {formatDateShort(item.reservationDate)} {formatTime(item.reservationTime)}
                  </span>
                  <span className={cx('moreWhere')}>
                    {item.hospitalName} · {item.department}
                  </span>
                </span>
                {cancelButton(item)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cx('section')} aria-labelledby="hospital-past-title">
        <h2 id="hospital-past-title" className={cx('sectionTitle')}>
          지난 진료
        </h2>
        {past.length === 0 ? (
          <div className={cx('card', 'emptyCard')}>
            <p className={cx('emptyText')}>지난 진료가 없어요</p>
          </div>
        ) : (
          <div className={cx('pastGrid')}>
            {past.slice(page * PAST_PER_PAGE, (page + 1) * PAST_PER_PAGE).map(item => {
              const rebook = rebookOf(item);
              const status = pastStatusLabel(item.status);
              const body = (
                <>
                  <span className={cx('pastName')}>{item.hospitalName}</span>
                  <span className={cx('pastMeta')}>
                    {item.department} · {formatDateShort(item.reservationDate)}
                  </span>
                  {status && <span className={cx('tag')}>{status}</span>}
                  {rebook && (
                    <span className={cx('pastAction')} aria-hidden="true">
                      다시 예약 ›
                    </span>
                  )}
                </>
              );
              return rebook ? (
                <button
                  key={item.reservationId}
                  type="button"
                  className={cx('card', 'pastCard', 'pastButton')}
                  // 같은 병원 카드가 여럿일 수 있어 날짜·상태까지 읽어 준다
                  aria-label={`${item.hospitalName} ${item.department} ${formatDateShort(item.reservationDate)}${status ? ` ${status}` : ''} 다시 예약`}
                  onClick={() => props.onRebook(rebook)}
                >
                  {body}
                </button>
              ) : (
                <div key={item.reservationId} className={cx('card', 'pastCard', { canceled: status })}>
                  {body}
                </div>
              );
            })}
          </div>
        )}
        <ReservationPager page={page} total={pastTotal} onChange={props.onPastPage} label="지난 진료 페이지" />
      </section>

      {cancelTarget && (
        <CancelDialog
          item={cancelTarget}
          wardName={props.wardName}
          isCanceling={props.isCanceling}
          onKeep={closeDialog}
          onConfirm={async () => {
            await props.onCancel(cancelTarget.reservationId);
            closeDialog();
          }}
        />
      )}
    </>
  );
}

interface CancelDialogProps {
  item: IReservationItem;
  wardName: string;
  isCanceling: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}

function CancelDialog({ item, wardName, isCanceling, onKeep, onConfirm }: CancelDialogProps) {
  // 창이 뜨면 [그대로 두기]로 포커스를 옮긴다(되돌릴 수 없는 쪽을 실수로 누르지 않게)
  const keepRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  // 창이 떠 있는 동안 뒤 화면이 함께 스크롤되지 않게 한다
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // 취소하는 동안 두 버튼이 잠겨 포커스가 창 밖으로 빠지지 않게 창 자체로 옮긴다
  useEffect(() => {
    if (isCanceling) dialogRef.current?.focus();
  }, [isCanceling]);

  const close = () => {
    if (!isCanceling) onKeep();
  };

  return (
    <div className={cx('overlay')} role="presentation" onClick={close}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cx('dialog')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hospital-cancel-title"
        aria-describedby="hospital-cancel-desc"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') close();
          // 포커스가 창 밖(가려진 화면)으로 나가지 않게 두 버튼 사이에서만 돈다
          if (event.key !== 'Tab') return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          // 취소하는 중(두 버튼 모두 잠김)에는 창에 머문다
          if (buttons.length === 0) {
            event.preventDefault();
            return;
          }
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h3 id="hospital-cancel-title" className={cx('dialogTitle')}>
          이 예약을 취소할까요?
        </h3>
        <div id="hospital-cancel-desc" className={cx('dialogBody')}>
          <div className={cx('dialogWhen')}>
            {formatDateShort(item.reservationDate)} {formatTime(item.reservationTime)}
          </div>
          <div className={cx('dialogWhere')}>
            {item.hospitalName} · {item.department}
          </div>
          <p className={cx('dialogNote')}>{wardName} 님 화면에서도 취소된 것으로 보여요</p>
        </div>
        <div className={cx('dialogButtons')}>
          <button ref={keepRef} type="button" className={cx('btn', 'ghost', 'tall')} disabled={isCanceling} onClick={close}>
            그대로 두기
          </button>
          <button type="button" className={cx('btn', 'dark', 'tall')} disabled={isCanceling} onClick={onConfirm}>
            {isCanceling ? '취소하는 중' : '예약 취소'}
          </button>
        </div>
      </div>
    </div>
  );
}
