'use client';

import { useId } from 'react';
import classNames from 'classnames/bind';

import {
  createDraftKey,
  createEmptyDrug,
  decreaseDose,
  DraftDrug,
  DraftTime,
  findDuplicateDrugKeys,
  formatDoseLabel,
  formatTimeOption,
  increaseDose,
  MAX_DOSE_AMOUNT,
  MAX_DRUGS,
  MAX_MEMO_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TIMES,
  MedicationDraft,
  MIN_DOSE_AMOUNT,
  nextUnusedTime,
  TIME_OPTIONS,
} from '@/utils/medication/medicationDraft';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

interface MedicationDraftFormProps {
  draft: MedicationDraft;
  disabled: boolean;
  onChange: (draft: MedicationDraft) => void;
}

// "약 추가" 등록 양식 - 카메라로 찍기·직접 쓰기 두 탭이 함께 쓴다(약 목록 × 드시는 시간 목록)
export function MedicationDraftForm({ draft, disabled, onChange }: MedicationDraftFormProps) {
  const duplicateKeys = findDuplicateDrugKeys(draft.drugs);
  const lowConfidenceHintId = useId();
  const hasLowConfidence = draft.drugs.some(drug => drug.lowConfidence);

  const updateDrug = (key: string, patch: Partial<DraftDrug>) =>
    onChange({ ...draft, drugs: draft.drugs.map(drug => (drug.key === key ? { ...drug, ...patch } : drug)) });
  const removeDrug = (key: string) => onChange({ ...draft, drugs: draft.drugs.filter(drug => drug.key !== key) });
  const addDrug = () => onChange({ ...draft, drugs: [...draft.drugs, createEmptyDrug()] });

  const updateTime = (key: string, patch: Partial<DraftTime>) =>
    onChange({ ...draft, times: draft.times.map(time => (time.key === key ? { ...time, ...patch } : time)) });
  const removeTime = (key: string) => onChange({ ...draft, times: draft.times.filter(time => time.key !== key) });
  const addTime = () =>
    onChange({
      ...draft,
      times: [...draft.times, { key: createDraftKey(), time: nextUnusedTime(draft.times.map(time => time.time)) }],
    });

  return (
    <div className={cx('draftForm')}>
      <section className={cx('group')}>
        <h4 className={cx('groupTitle')}>약</h4>
        <ul className={cx('rows')}>
          {draft.drugs.map((drug, index) => (
            <li key={drug.key} className={cx('drugRow')}>
              <input
                className={cx('nameInput', {
                  lowConfidence: drug.lowConfidence,
                  duplicated: duplicateKeys.has(drug.key),
                })}
                value={drug.name}
                onChange={event => updateDrug(drug.key, { name: event.target.value, lowConfidence: false })}
                maxLength={MAX_NAME_LENGTH}
                placeholder="약 이름 입력"
                aria-label={`${index + 1}번째 약 이름`}
                aria-invalid={duplicateKeys.has(drug.key) || undefined}
                aria-describedby={drug.lowConfidence ? lowConfidenceHintId : undefined}
                disabled={disabled}
              />
              <div className={cx('stepper')}>
                <button
                  type="button"
                  onClick={() => updateDrug(drug.key, { doseAmount: decreaseDose(drug.doseAmount) })}
                  disabled={disabled || drug.doseAmount <= MIN_DOSE_AMOUNT}
                  aria-label={`${index + 1}번째 약 복용량 줄이기`}
                >
                  −
                </button>
                <span aria-live="polite">{formatDoseLabel(drug.doseAmount)}</span>
                <button
                  type="button"
                  onClick={() => updateDrug(drug.key, { doseAmount: increaseDose(drug.doseAmount) })}
                  disabled={disabled || drug.doseAmount >= MAX_DOSE_AMOUNT}
                  aria-label={`${index + 1}번째 약 복용량 늘리기`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={cx('removeButton')}
                onClick={() => removeDrug(drug.key)}
                disabled={disabled || draft.drugs.length <= 1}
                aria-label={`${index + 1}번째 약 빼기`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {hasLowConfidence && (
          <p id={lowConfidenceHintId} className={cx('lowConfidenceHint')}>
            노란 칸은 글자를 정확히 읽지 못했을 수 있어요. 한 번 더 확인해 주세요
          </p>
        )}
        {duplicateKeys.size > 0 && <p className={cx('hint')}>같은 이름의 약이 두 번 들어 있어요. 하나를 빼 주세요</p>}
        <button
          type="button"
          className={cx('addRowButton')}
          onClick={addDrug}
          disabled={disabled || draft.drugs.length >= MAX_DRUGS}
        >
          + 약 더 넣기
        </button>
      </section>

      <section className={cx('group')}>
        <h4 className={cx('groupTitle')}>드시는 시간 · 하루 {draft.times.length}번</h4>
        <ul className={cx('rows')}>
          {draft.times.map((time, index) => {
            const usedByOthers = draft.times.filter(other => other.key !== time.key).map(other => other.time);
            return (
              <li key={time.key} className={cx('timeRow')}>
                <select
                  className={cx('timeSelect')}
                  value={time.time}
                  onChange={event => updateTime(time.key, { time: event.target.value })}
                  aria-label={`${index + 1}번째 드시는 시간`}
                  disabled={disabled}
                >
                  {TIME_OPTIONS.map(option => (
                    <option key={option} value={option} disabled={usedByOthers.includes(option)}>
                      {formatTimeOption(option)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={cx('removeButton')}
                  onClick={() => removeTime(time.key)}
                  disabled={disabled || draft.times.length <= 1}
                  aria-label={`${index + 1}번째 시간 빼기`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={cx('addRowButton')}
          onClick={addTime}
          disabled={disabled || draft.times.length >= MAX_TIMES}
        >
          + 시간 더 넣기
        </button>
      </section>

      <label className={cx('memoField')}>
        <span>
          복용 안내 <span className={cx('optional')}>(선택)</span>
        </span>
        <input
          value={draft.memo}
          onChange={event => onChange({ ...draft, memo: event.target.value })}
          maxLength={MAX_MEMO_LENGTH}
          placeholder="예) 식후 30분"
          disabled={disabled}
        />
      </label>
    </div>
  );
}
