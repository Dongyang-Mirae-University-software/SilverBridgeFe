import classNames from 'classnames/bind';
import { useState } from 'react';

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
  // 증상 칸은 선택이라 접어 둔다. 이미 적은 글이 있으면(이전 → 다시 확인) 펼친 채로 시작한다
  const [symptomOpen, setSymptomOpen] = useState(props.symptom !== '');
  const phoneHintIds = [!wardPhone && 'hospital-phone-hint', phoneInvalid && 'hospital-phone-error'].filter(Boolean);

  return (
    <>
      <div className={cx('card', 'confirmCard')}>
        <div className={cx('confirmAsk')}>이대로 예약할까요?</div>
        {/* 큰 글씨 요약: 날짜 / 시각 / 병원·진료과, 주소는 작게 */}
        <div className={cx('confirmSummary')}>
          <div className={cx('confirmDate')}>{formatDateShort(props.date)}</div>
          <div className={cx('confirmTime', 'brandText')}>{formatTime(props.time)}</div>
          <div className={cx('confirmWhere')}>
            {pick.hospital.name} <span className={cx('pickedDept')}>· {pick.department}</span>
          </div>
          <div className={cx('confirmAddress')}>{pick.hospital.address}</div>
        </div>

        {/* 진료받으실 분·연락처를 한 줄로 */}
        <div className={cx('confirmWho')} aria-label="진료받으실 분과 연락처" role="group">
          <span className={cx('confirmWhoName')}>{wardName} 님</span>
          {!showPhoneInput && (
            <>
              {/* 계정 번호가 줄표 없이 저장돼 있어도 읽기 쉽게 줄표를 넣어 보인다(보내는 값은 그대로) */}
              <span className={cx('confirmWhoPhone')}>{formatPhoneInput(wardPhone)}</span>
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
        </div>
        {showPhoneInput && (
          <div className={cx('phoneField', 'confirmPhoneField')}>
            <span id="hospital-phone-label" className={cx('symptomTitle')}>
              연락처
            </span>
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
          </div>
        )}

        {/* 병원에 전할 증상(선택). 입력값은 예약 요청에만 싣고 화면 밖 어디에도 남기지 않는다 */}
        <button
          type="button"
          className={cx('symptomToggle')}
          aria-expanded={symptomOpen}
          aria-controls="hospital-symptom"
          onClick={() => setSymptomOpen(open => !open)}
        >
          <span>
            불편한 곳 적기 <span className={cx('optional')}>{props.symptom.trim() ? '(적음)' : '(선택)'}</span>
          </span>
          <span className={cx('symptomToggleMark', { open: symptomOpen })} aria-hidden="true">
            ›
          </span>
        </button>
        {/* 접어도 지우지 않고 숨긴다 - aria-controls가 가리킬 대상이 남고, 적은 글은 그대로 함께 보낸다(F-3·F-4) */}
        <div id="hospital-symptom" className={cx('symptomField')} hidden={!symptomOpen}>
          <textarea
            className={cx('textarea')}
            rows={3}
            maxLength={SYMPTOM_MAX}
            aria-label="불편한 곳"
            placeholder="예) 며칠 전부터 무릎이 아프세요"
            value={props.symptom}
            aria-describedby="hospital-symptom-count"
            onChange={event => props.onSymptom(event.target.value)}
          />
          <span id="hospital-symptom-count" className={cx('fieldHint', 'counter')}>
            {props.symptom.length}/{SYMPTOM_MAX}자
          </span>
        </div>
      </div>
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
