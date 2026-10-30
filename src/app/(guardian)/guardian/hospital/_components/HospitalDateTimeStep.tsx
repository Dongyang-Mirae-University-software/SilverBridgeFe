import classNames from 'classnames/bind';

import { IHospital } from '@/service/interface/reservation';
import {
  buildDays,
  buildSlotGrid,
  formatDateShort,
  formatSlot,
  formatTime,
  hoursForDay,
  isClosedDay,
  reservationErrorMessage,
} from '@/utils/reservation/reservationView';
import styles from './GuardianHospitalContent.module.css';
import { Pick } from './hospitalBooking';

const cx = classNames.bind(styles);

interface Props {
  pick: Pick;
  onDepartment: (department: string) => void;
  onChangeHospital: () => void;
  today: string;
  nowTime: string;
  date: string;
  onDate: (date: string) => void;
  time: string;
  onTime: (time: string) => void;
  slots?: string[];
  slotsLoading: boolean;
  slotsError: unknown;
  notice: string | null;
  onNext: () => void;
}

export function HospitalDateTimeStep(props: Props) {
  const { pick, today, date } = props;
  const multiDept = pick.hospital.departments.length > 1;

  return (
    <>
      <div className={cx('card', 'pickedCard')}>
        <div className={cx('pickedName')}>
          {pick.hospital.name}
          {!multiDept && pick.department && <span className={cx('pickedDept')}> · {pick.department}</span>}
        </div>
        <button type="button" className={cx('btn', 'ghost', 'smallButton')} onClick={props.onChangeHospital}>
          병원 바꾸기
        </button>
      </div>

      {/* 시간 칸은 진료과마다 따로라 진료과가 여럿인 병원은 먼저 진료과를 고른다 */}
      {multiDept && (
        <section className={cx('card', 'pad22')} aria-label="진료과">
          <h2 className={cx('cardTitle')}>진료과</h2>
          <div className={cx('deptGrid')}>
            {pick.hospital.departments.map(department => (
              <button
                key={department}
                type="button"
                className={cx('slot', { selected: pick.department === department })}
                aria-pressed={pick.department === department}
                onClick={() => props.onDepartment(department)}
              >
                {department}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={cx('card', 'pad22')} aria-label="날짜">
        <h2 className={cx('cardTitle')}>날짜</h2>
        <div className={cx('days')}>
          {buildDays(today).map(day => {
            const closed = isClosedDay(pick.hospital, day.iso);
            return (
              <button
                key={day.iso}
                type="button"
                className={cx('day', { selected: date === day.iso, sunday: day.weekday === '일', closed })}
                aria-pressed={date === day.iso}
                aria-label={`${formatDateShort(day.iso)}${day.iso === today ? ' 오늘' : ''}${closed ? ' 휴진' : ''}`}
                disabled={closed}
                onClick={() => props.onDate(day.iso)}
              >
                <span className={cx('weekday')}>{day.weekday}</span>
                <span className={cx('dayNumber')}>{day.day}</span>
                {closed && <span className={cx('dayOff')}>휴진</span>}
              </button>
            );
          })}
        </div>
      </section>

      {date && (
        <section className={cx('card', 'pad22')} aria-label="시간">
          <h2 className={cx('cardTitle')}>
            시간 <span className={cx('cardTitleSub')}>· {formatDateShort(date)}</span>
          </h2>
          {pick.department ? (
            <SlotPicker
              hospital={pick.hospital}
              date={date}
              available={props.slots}
              isLoading={props.slotsLoading}
              error={props.slotsError}
              isToday={date === today}
              nowTime={props.nowTime}
              time={props.time}
              onTime={props.onTime}
            />
          ) : (
            <p className={cx('message', 'inline')}>진료과를 먼저 골라 주세요.</p>
          )}
        </section>
      )}

      {props.notice && (
        <p className={cx('notice', 'bad')} role="alert">
          {props.notice}
        </p>
      )}

      <button
        type="button"
        className={cx('btn', 'primary', 'wide')}
        disabled={!(pick.department && date && props.time)}
        onClick={props.onNext}
      >
        다음
      </button>
    </>
  );
}

interface SlotPickerProps {
  hospital: IHospital;
  date: string;
  available?: string[];
  isLoading: boolean;
  error: unknown;
  isToday: boolean;
  nowTime: string;
  time: string;
  onTime: (time: string) => void;
}

function SlotPicker({ hospital, date, available, isLoading, error, isToday, nowTime, time, onTime }: SlotPickerProps) {
  if (isLoading) return <p className={cx('message', 'inline')}>예약할 수 있는 시간을 확인하는 중이에요.</p>;
  if (error) return <p className={cx('message', 'inline')}>{reservationErrorMessage(error)}</p>;

  const hours = hoursForDay(hospital, date); // 요일별 진료 시간(예: 토요일 반일)
  const slots = buildSlotGrid(hours.openTime, hours.closeTime, available ?? [], {
    isToday,
    nowTime,
    breakStart: hospital.breakStart,
    breakEnd: hospital.breakEnd,
  });
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
