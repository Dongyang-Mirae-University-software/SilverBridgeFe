import classNames from 'classnames/bind';

import { ReservationDemoNotice } from '@/components/reservation/ReservationDemoNotice';
import { formatDateShort, formatTime } from '@/utils/reservation/reservationView';
import styles from './GuardianHospitalContent.module.css';
import { formatPhoneInput, PHONE_PATTERN, Pick, SYMPTOM_MAX } from './hospitalBooking';

const cx = classNames.bind(styles);

interface Props {
  pick: Pick;
  date: string;
  time: string;
  wardName: string;
  wardPhone: string | null;
  phoneEditing: boolean;
  phoneInput: string;
  patientPhone: string;
  onEditPhone: () => void;
  onPhoneInput: (value: string) => void;
  symptom: string;
  onSymptom: (value: string) => void;
  isPending: boolean;
  errorText: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

export function HospitalConfirmStep(props: Props) {
  const { pick, wardName, wardPhone } = props;
  const showPhoneInput = !wardPhone || props.phoneEditing;
  const phoneValid = PHONE_PATTERN.test(props.patientPhone);
  const phoneInvalid = Boolean(props.phoneInput) && !phoneValid;
  const phoneHintIds = [!wardPhone && 'hospital-phone-hint', phoneInvalid && 'hospital-phone-error'].filter(Boolean);

  return (
    <>
      <div className={cx('card', 'confirmCard')}>
        <div className={cx('confirmAsk')}>이대로 예약할까요?</div>
        <div className={cx('confirmWhen')}>
          {formatDateShort(props.date)} {formatTime(props.time)}
        </div>
        <div className={cx('confirmWhere')}>
          {pick.hospital.name} <span className={cx('pickedDept')}>· {pick.department}</span>
        </div>
        <div className={cx('confirmAddress')}>{pick.hospital.address}</div>

        <dl className={cx('confirmRows')}>
          <div className={cx('confirmRow')}>
            <dt>진료받으실 분</dt>
            <dd className={cx('confirmValue')}>{wardName}</dd>
          </div>
          <div className={cx('confirmRow')}>
            <dt id="hospital-phone-label">연락처</dt>
            <dd className={cx('confirmValue', 'phoneValue')}>
              {showPhoneInput ? (
                <span className={cx('phoneField')}>
                  <input
                    className={cx('input')}
                    type="tel"
                    inputMode="tel"
                    placeholder="010-0000-0000"
                    autoComplete="off"
                    aria-labelledby="hospital-phone-label"
                    value={props.phoneInput}
                    aria-invalid={phoneInvalid}
                    aria-describedby={phoneHintIds.length > 0 ? phoneHintIds.join(' ') : undefined}
                    onChange={event => props.onPhoneInput(formatPhoneInput(event.target.value))}
                  />
                  {!wardPhone && (
                    <span id="hospital-phone-hint" className={cx('fieldHint')}>
                      {wardName} 계정에 휴대폰 번호가 없어 예약에 쓸 번호를 적어 주세요.
                    </span>
                  )}
                  {phoneInvalid && (
                    <span id="hospital-phone-error" className={cx('fieldError')}>
                      010-1234-5678처럼 휴대폰 번호를 적어 주세요.
                    </span>
                  )}
                </span>
              ) : (
                <>
                  <span>{wardPhone}</span>
                  <button
                    type="button"
                    className={cx('btn', 'ghost', 'smallButton')}
                    aria-label="연락처 바꾸기"
                    onClick={props.onEditPhone}
                  >
                    바꾸기
                  </button>
                </>
              )}
            </dd>
          </div>
        </dl>

        {/* 병원에 전할 증상(선택). 입력값은 예약 요청에만 싣고 화면 밖 어디에도 남기지 않는다 */}
        <label className={cx('symptomField')}>
          <span className={cx('symptomTitle')}>
            어디가 불편하세요? <span className={cx('optional')}>(선택)</span>
          </span>
          <textarea
            className={cx('textarea')}
            rows={3}
            maxLength={SYMPTOM_MAX}
            placeholder="예) 며칠 전부터 무릎이 아프세요"
            value={props.symptom}
            aria-describedby="hospital-symptom-count"
            onChange={event => props.onSymptom(event.target.value)}
          />
          <span id="hospital-symptom-count" className={cx('fieldHint', 'counter')}>
            {props.symptom.length}/{SYMPTOM_MAX}자
          </span>
        </label>
      </div>
      <ReservationDemoNotice />
      {props.errorText && (
        <p className={cx('notice', 'bad')} role="alert">
          {props.errorText}
        </p>
      )}
      <div className={cx('confirmButtons')}>
        <button type="button" className={cx('btn', 'ghost', 'tall')} disabled={props.isPending} onClick={props.onBack}>
          이전
        </button>
        <button
          type="button"
          className={cx('btn', 'primary', 'tall')}
          disabled={props.isPending || !phoneValid}
          onClick={props.onSubmit}
        >
          {props.isPending ? '예약하는 중' : '예약하기'}
        </button>
      </div>
    </>
  );
}
