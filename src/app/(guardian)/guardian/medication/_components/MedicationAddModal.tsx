'use client';

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import classNames from 'classnames/bind';

import { useModalDialog } from '@/hooks/useModalDialog';
import { MedicationTimeSlot } from '@/service/interface/medication';
import { recognizeMedicationEnvelope } from '@/service/api/guardian/medication';
import { useAddWardMedicationBatchMutation } from '@/service/query/guardian/medication';
import {
  canProceedDrugs,
  createEmptyDrug,
  defaultSlotsForGroup,
  DraftDrug,
  getGroupTitle,
  groupDrugsByTimesPerDay,
  groupToBatchRequest,
  MAX_DRUGS,
  ocrResultToDraft,
} from '@/utils/medication/medicationDraft';
import { getOcrErrorMessage, OCR_NOT_FOUND_MESSAGE, prepareOcrImage } from '@/utils/medication/ocrImage';
import { MedicationDoseTimeStep } from './MedicationDoseTimeStep';
import { MedicationDraftForm } from './MedicationDraftForm';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

type AddTab = 'camera' | 'manual';
const TABS: { value: AddTab; label: string }[] = [
  { value: 'camera', label: '카메라로 찍기' },
  { value: 'manual', label: '직접 쓰기' },
];

type Step = 1 | 2;
const STEP_TITLE: Record<Step, string> = { 1: '약', 2: '언제 드세요?' };

type CameraState =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'result'; count: number; truncated: boolean }
  | { phase: 'error'; message: string };

interface MedicationAddModalProps {
  wardId: string;
  onClose: () => void;
}

function PillIcon() {
  return (
    <svg className={cx('pillIcon')} viewBox="0 0 48 48" aria-hidden="true">
      <g transform="rotate(-35 24 24)">
        <path d="M24 16 H14 a8 8 0 0 0 0 16 H24 Z" fill="currentColor" />
        <path d="M24 16 H34 a8 8 0 0 1 0 16 H24 Z" fill="#fff" />
      </g>
    </svg>
  );
}

// 보호자 "약 추가" - 1/2 약(봉투를 찍어 채우거나 직접 쓴다) → 2/2 언제 드세요?(칩 선택)
// 하루 횟수가 다른 약은 2/2에서 줄을 나누고, 줄마다 일괄 등록 API를 1번씩 부른다(줄 안은 전부 성공 또는 전부 실패)
// 사진·인식 결과는 화면 상태로만 다루고 저장하지 않는다. 인식 결과는 언제나 초안이라 자동 등록하지 않는다
export function MedicationAddModal({ wardId, onClose }: MedicationAddModalProps) {
  const [tab, setTab] = useState<AddTab>('camera');
  const [camera, setCamera] = useState<CameraState>({ phase: 'idle' });
  const [step, setStep] = useState<Step>(1);
  const [drugs, setDrugs] = useState<DraftDrug[]>(() => [createEmptyDrug()]);
  const [selections, setSelections] = useState<Record<string, MedicationTimeSlot[]>>({});
  const [doneKeys, setDoneKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const movedStepRef = useRef(false);
  const batchMutation = useAddWardMedicationBatchMutation();
  const idPrefix = useId();
  const tabId = (value: AddTab) => `${idPrefix}-tab-${value}`;
  const panelId = `${idPrefix}-panel`;

  // 모달을 닫으면 진행 중인 인식 요청을 끊는다
  useEffect(() => () => abortRef.current?.abort(), []);

  // 단계를 옮기면 새 단계 제목으로 포커스를 옮긴다(화면 읽기 프로그램이 바뀐 화면을 알 수 있게)
  useEffect(() => {
    if (!movedStepRef.current) return;
    stepTitleRef.current?.focus();
  }, [step]);

  const groups = useMemo(() => groupDrugsByTimesPerDay(drugs), [drugs]);
  const pendingGroups = groups.filter(group => !doneKeys.has(group.key));
  const hasDone = doneKeys.size > 0;

  const isReading = camera.phase === 'reading';
  const showForm = tab === 'manual' || camera.phase === 'result';
  const canProceed = step === 1 && showForm && canProceedDrugs(drugs);
  const canSubmit =
    step === 2 &&
    !isSubmitting &&
    pendingGroups.length > 0 &&
    pendingGroups.every(group => (selections[group.key]?.length ?? 0) > 0);
  // 읽는 중에 탭을 바꾸면 뒤늦게 온 인식 결과가 직접 쓴 내용을 덮는다 - 읽는 동안은 탭을 잠근다
  // 일부 줄이 이미 등록됐으면 탭을 바꿔 처음부터 다시 쓰다가 같은 약을 또 등록하지 않게 잠근다
  const isTabLocked = isReading || isSubmitting || hasDone;

  // 등록 중에 닫으면 결과(실패 안내)를 볼 수 없다 - 등록이 끝날 때까지 닫지 않는다
  const requestClose = () => {
    if (isSubmitting) return;
    onClose();
  };
  const { dialogRef, onDialogKeyDown, overlayProps } = useModalDialog<HTMLFormElement>({
    onRequestClose: requestClose,
    initialFocusSelector: '[role="tab"][aria-selected="true"]',
  });

  const moveStep = (next: Step) => {
    movedStepRef.current = true;
    setStep(next);
    setSubmitError(undefined);
  };

  const changeDrugs = (next: DraftDrug[]) => {
    setDrugs(next);
    setSubmitError(undefined);
  };

  // 탭을 바꾸면 처음부터(1/2, 빈 약 1개)
  const selectTab = (next: AddTab) => {
    if (isTabLocked || next === tab) return;
    abortRef.current?.abort();
    setTab(next);
    setCamera({ phase: 'idle' });
    setStep(1);
    setDrugs([createEmptyDrug()]);
    setSelections({});
    setSubmitError(undefined);
  };

  const openCamera = () => {
    if (isReading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // 같은 사진을 다시 골라도 change가 일어나게
    if (!file) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCamera({ phase: 'reading' });
    setSubmitError(undefined);

    try {
      const image = await prepareOcrImage(file);
      const result = await recognizeMedicationEnvelope(wardId, image, controller.signal);
      if (controller.signal.aborted) return;
      const recognized = ocrResultToDraft(result);
      if (!recognized) {
        setCamera({ phase: 'error', message: OCR_NOT_FOUND_MESSAGE });
        return;
      }
      // 다시 찍으면 전에 고른 시간도 새 봉투 기준으로 다시 정한다
      setDrugs(recognized.drugs);
      setSelections({});
      setCamera({ phase: 'result', count: recognized.drugs.length, truncated: recognized.truncated });
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      setCamera({ phase: 'error', message: getOcrErrorMessage(error) });
    }
  };

  // 1/2 → 2/2: 처음 보는 줄만 기본 선택을 채운다(이전으로 돌아갔다 와도 고른 값은 그대로)
  const goNext = () => {
    if (!canProceed) return;
    setSelections(current => {
      const next = { ...current };
      groups.forEach(group => {
        if (!next[group.key]) next[group.key] = defaultSlotsForGroup(group, drugs);
      });
      return next;
    });
    moveStep(2);
  };

  const changeSelection = (groupKey: string, slots: MedicationTimeSlot[]) => {
    setSelections(current => ({ ...current, [groupKey]: slots }));
    setSubmitError(undefined);
  };

  // 줄마다 1번씩 차례로 등록한다. 실패하면 거기서 멈추고, 성공한 줄은 "등록됨"으로 잠가 다시 보내지 않는다
  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(undefined);
    const done = new Set(doneKeys);
    try {
      for (const group of pendingGroups) {
        try {
          await batchMutation.mutateAsync({ wardId, body: groupToBatchRequest(group, selections[group.key]) });
          done.add(group.key);
          setDoneKeys(new Set(done));
        } catch (error) {
          const message = (error instanceof Error && error.message) || '등록에 실패했어요. 다시 시도해 주세요';
          setSubmitError(groups.length > 1 ? `${getGroupTitle(group)} - ${message}` : message);
          return;
        }
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) goNext();
    else void submit();
  };

  // 탭 목록: ←/→·Home/End로 이동(선택 즉시 전환)
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex(item => item.value === tab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null || isTabLocked) return;
    event.preventDefault();
    const next = TABS[nextIndex].value;
    selectTab(next);
    document.getElementById(tabId(next))?.focus();
  };

  const submitLabel = isSubmitting ? '등록 중…' : hasDone ? '남은 약 다시 등록' : '등록';

  return (
    <div className={cx('overlay')} role="presentation" {...overlayProps}>
      <form
        ref={dialogRef}
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="약 추가"
        onSubmit={handleSubmit}
        onKeyDown={onDialogKeyDown}
      >
        <header className={cx('header')}>
          <h3>약 추가</h3>
          <button type="button" className={cx('close')} onClick={requestClose} disabled={isSubmitting} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('tabs')} role="tablist" aria-label="약 추가 방법" onKeyDown={handleTabKeyDown}>
          {TABS.map(item => {
            const selected = tab === item.value;
            return (
              <button
                key={item.value}
                id={tabId(item.value)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                className={cx('tab', { active: selected })}
                onClick={() => selectTab(item.value)}
                disabled={isTabLocked && !selected}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={cx('fileInput')}
          onChange={handleFileChange}
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className={cx('body')} id={panelId} role="tabpanel" aria-labelledby={tabId(tab)}>
          {tab === 'camera' && camera.phase !== 'result' && (
            <div className={cx('cameraBox', { reading: isReading, failed: camera.phase === 'error' })}>
              {camera.phase === 'idle' && (
                <>
                  <p className={cx('cameraText')}>약 봉투를 카메라에 대주세요</p>
                  <button type="button" className={cx('cameraButton')} onClick={openCamera}>
                    카메라 열기
                  </button>
                </>
              )}
              {camera.phase === 'reading' && (
                <>
                  <PillIcon />
                  <p className={cx('cameraText')} role="status">
                    약 이름을 읽는 중…
                  </p>
                  <button type="button" className={cx('cameraButton')} disabled>
                    읽는 중…
                  </button>
                </>
              )}
              {camera.phase === 'error' && (
                <>
                  <p className={cx('cameraText')} role="alert">
                    {camera.message}
                  </p>
                  <div className={cx('cameraActions')}>
                    <button type="button" className={cx('cameraButton')} onClick={openCamera}>
                      다시 찍기
                    </button>
                    <button type="button" className={cx('cameraButton', 'ghost')} onClick={() => selectTab('manual')}>
                      직접 쓰기로
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {showForm && (
            <>
              <div className={cx('progress')}>
                <div className={cx('progressBar')} aria-hidden="true">
                  <span className={cx('progressFill')} />
                  <span className={cx('progressFill', { empty: step === 1 })} />
                </div>
                <span className={cx('progressText')} aria-label={`2단계 중 ${step}단계`}>
                  {step} / 2
                </span>
              </div>
              <h4 ref={stepTitleRef} className={cx('stepTitle')} tabIndex={-1}>
                {STEP_TITLE[step]}
              </h4>
            </>
          )}

          {step === 1 && tab === 'camera' && camera.phase === 'result' && (
            <div className={cx('resultBanner')} role="status">
              <p>✓ 약 {camera.count}개를 찾았어요. 맞는지 확인해 주세요</p>
              {camera.truncated && (
                <p className={cx('resultNote')}>
                  한 번에 {MAX_DRUGS}개까지만 가져왔어요. 나머지는 등록 후 다시 추가해 주세요
                </p>
              )}
            </div>
          )}

          {showForm && step === 1 && <MedicationDraftForm drugs={drugs} disabled={false} onChange={changeDrugs} />}

          {showForm && step === 2 && (
            <MedicationDoseTimeStep
              groups={groups}
              selections={selections}
              doneKeys={doneKeys}
              disabled={isSubmitting}
              onChange={changeSelection}
            />
          )}

          {submitError && (
            <p className={cx('error')} role="alert">
              {submitError}
              {hasDone && <span className={cx('errorNote')}>등록됨 표시가 있는 약은 다시 보내지 않아요</span>}
            </p>
          )}
        </div>

        <footer className={cx('footer')}>
          {!showForm && (
            <button type="button" className={cx('cancelButton')} onClick={requestClose}>
              취소
            </button>
          )}
          {showForm && step === 1 && tab === 'camera' && (
            <button type="button" className={cx('cancelButton')} onClick={openCamera}>
              다시 찍기
            </button>
          )}
          {showForm && step === 1 && (
            <button type="submit" className={cx('submitButton')} disabled={!canProceed}>
              다음
            </button>
          )}
          {showForm && step === 2 && (
            <>
              <button
                type="button"
                className={cx('cancelButton')}
                onClick={() => moveStep(1)}
                disabled={isSubmitting || hasDone}
              >
                이전
              </button>
              <button type="submit" className={cx('submitButton')} disabled={!canSubmit}>
                {submitLabel}
              </button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
