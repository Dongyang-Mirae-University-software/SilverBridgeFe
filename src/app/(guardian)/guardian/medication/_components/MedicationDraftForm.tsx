'use client';

import classNames from 'classnames/bind';
import { useId } from 'react';

import {
  createEmptyDrug,
  decreaseDose,
  DraftDrug,
  findDuplicateDrugKeys,
  formatDoseLabel,
  increaseDose,
  MAX_DOSE_AMOUNT,
  MAX_DRUGS,
  MAX_NAME_LENGTH,
  MIN_DOSE_AMOUNT,
  needsNameCheck,
  renameDrug,
} from '@/utils/medication/medicationDraft';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

interface MedicationDraftFormProps {
  drugs: DraftDrug[];
  lowConfidenceHintId?: string; // 노란 칸 안내 박스(모달이 결과 문구 아래에 그린다)의 id
  onChange: (drugs: DraftDrug[]) => void;
}

// "약 추가" 1/2 약 - 카메라로 찍기·직접 쓰기 두 탭이 함께 쓴다(약 이름 × 1회 복용량)
export function MedicationDraftForm({ drugs, lowConfidenceHintId, onChange }: MedicationDraftFormProps) {
  const duplicateKeys = findDuplicateDrugKeys(drugs);
  const idPrefix = useId();
  // 목록에 없는 이름 안내 줄 - 이름 칸이 노란 확인 박스와 함께 이 줄을 설명으로 읽는다
  const hasSuggestions = (drug: DraftDrug) => drug.notInList && drug.suggestions.length > 0;
  const notInListId = (drug: DraftDrug) => `${idPrefix}-${drug.key}-not-in-list`;
  const describedBy = (drug: DraftDrug) =>
    [needsNameCheck(drug) && lowConfidenceHintId, hasSuggestions(drug) && notInListId(drug)].filter(Boolean).join(' ') ||
    undefined;

  const updateDrug = (key: string, patch: Partial<DraftDrug>) =>
    onChange(drugs.map(drug => (drug.key === key ? { ...drug, ...patch } : drug)));
  const removeDrug = (key: string) => onChange(drugs.filter(drug => drug.key !== key));
  const addDrug = () => onChange([...drugs, createEmptyDrug()]);

  return (
    <div className={cx('drugCard')}>
      <ul className={cx('rows')}>
        {drugs.map((drug, index) => (
          <li key={drug.key} className={cx('drugRow')}>
            <input
              className={cx('nameInput', {
                lowConfidence: needsNameCheck(drug),
                duplicated: duplicateKeys.has(drug.key),
              })}
              value={drug.name}
              onChange={event => updateDrug(drug.key, renameDrug(event.target.value))}
              maxLength={MAX_NAME_LENGTH}
              placeholder="약 이름을 써 주세요"
              aria-label={`${index + 1}번째 약 이름`}
              aria-invalid={duplicateKeys.has(drug.key) || undefined}
              aria-describedby={describedBy(drug)}
            />
            <button
              type="button"
              className={cx('removeButton')}
              onClick={() => removeDrug(drug.key)}
              disabled={drugs.length <= 1}
              aria-label={`${index + 1}번째 약 빼기`}
            >
              ×
            </button>
            {/* 복용량 −/+는 늘 보인다(접어 두던 "1알 ✎"는 2026-10-24 사용자 요청으로 되돌림) */}
            <div className={cx('stepper')}>
              <button
                type="button"
                onClick={() => updateDrug(drug.key, { doseAmount: decreaseDose(drug.doseAmount) })}
                disabled={drug.doseAmount <= MIN_DOSE_AMOUNT}
                aria-label={`${index + 1}번째 약 복용량 줄이기`}
              >
                −
              </button>
              <span aria-live="polite">{formatDoseLabel(drug.doseAmount)}</span>
              <button
                type="button"
                onClick={() => updateDrug(drug.key, { doseAmount: increaseDose(drug.doseAmount) })}
                disabled={drug.doseAmount >= MAX_DOSE_AMOUNT}
                aria-label={`${index + 1}번째 약 복용량 늘리기`}
              >
                +
              </button>
            </div>
            {/* 허가 목록에 없는 이름 - 노란 칸 + 비슷한 이름 칩만(안내 문장은 2026-10-24 사용자 요청으로 뺐다) */}
            {hasSuggestions(drug) && (
              <div id={notInListId(drug)} className={cx('nameCheck')}>
                <span className={cx('suggestionChips')}>
                  <span className={cx('suggestionLabel')}>비슷한 이름:</span>
                  {drug.suggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      className={cx('suggestionChip')}
                      onClick={() => updateDrug(drug.key, renameDrug(suggestion))}
                      aria-label={`${index + 1}번째 약을 ${suggestion}(으)로 바꾸기`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {duplicateKeys.size > 0 && <p className={cx('hint')}>같은 이름의 약이 두 번 들어 있어요. 하나를 빼 주세요</p>}
      <button
        type="button"
        className={cx('addRowButton')}
        onClick={addDrug}
        disabled={drugs.length >= MAX_DRUGS}
      >
        + 약 더 넣기
      </button>
    </div>
  );
}
