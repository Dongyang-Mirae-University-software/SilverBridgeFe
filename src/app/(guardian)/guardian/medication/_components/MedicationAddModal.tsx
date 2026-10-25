'use client';

import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  groupToBatchRequest,
  isUncertainFailure,
  MAX_DRUGS,
  needsNameCheck,
  ocrResultToDraft,
  toDoseGroup,
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

type CameraResult = { count: number; truncated: boolean };
// previous: 다시 찍기 전의 인식 결과 - 다시 찍기가 실패해도 고쳐 둔 1/2 초안으로 돌아갈 수 있게 남겨 둔다
type CameraState =
  | { phase: 'idle' }
  | { phase: 'reading'; previous?: CameraResult }
  | ({ phase: 'result' } & CameraResult)
  | { phase: 'error'; message: string; previous?: CameraResult };

const UNCERTAIN_MESSAGE = '등록됐는지 확인하지 못했어요. 약 목록에서 확인한 뒤, 빠진 약만 다시 추가해 주세요';

// 2/2에 들어온 직후·화면이 다시 켜진 직후에는 [등록]을 잠깐 막는다 - [다음]을 한 번 더 누른 탭이나
// 꺼지려던 화면을 깨우려고 누른 탭이 [등록]에 닿아, 누르지 않은 약이 등록된 일이 있었다(2026-10-22 gosky)
const SUBMIT_GUARD_MS = 1000;

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

// 보호자 "약 추가" - 1/2 약(봉투를 찍어 채우거나 직접 쓴다) → 2/2 언제 드세요?(칩 선택, 모든 약에 같은 시간)
// 등록은 일괄 등록 API 1번(전부 성공 또는 전부 실패). 하루 횟수가 다른 약이 섞이면 안내만 한다
// 사진·인식 결과는 화면 상태로만 다루고 저장하지 않는다. 인식 결과는 언제나 초안이라 자동 등록하지 않는다
export function MedicationAddModal({ wardId, onClose }: MedicationAddModalProps) {
  const [tab, setTab] = useState<AddTab>('camera');
  const [camera, setCamera] = useState<CameraState>({ phase: 'idle' });
  const [step, setStep] = useState<Step>(1);
  const [drugs, setDrugs] = useState<DraftDrug[]>(() => [createEmptyDrug()]);
  const [selected, setSelected] = useState<MedicationTimeSlot[] | null>(null); // null = 아직 2/2에 가지 않음
  // 응답 전에 끊겨 등록됐는지 모른다 - BE는 다른 요청의 같은 이름을 막지 않아 다시 보내면 중복 등록이므로 다시 보내지 않는다
  const [uncertain, setUncertain] = useState(false);
  const [isGuarded, setIsGuarded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const movedStepRef = useRef(false);
  const stepRef = useRef<Step>(1);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchMutation = useAddWardMedicationBatchMutation();
  const idPrefix = useId();
  const tabId = (value: AddTab) => `${idPrefix}-tab-${value}`;
  const panelId = `${idPrefix}-panel`;

  // 모달을 닫으면 진행 중인 인식 요청을 끊는다
  useEffect(() => () => abortRef.current?.abort(), []);

  const startGuard = useCallback(() => {
    // 잠금으로 [등록]이 꺼지면 Chrome이 포커스를 body로 옮긴다 - 화면 읽기 위치를 잃지 않게 단계 제목으로 옮겨 둔다
    if (document.activeElement === submitRef.current) stepTitleRef.current?.focus();
    setIsGuarded(true);
    if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
    guardTimerRef.current = setTimeout(() => setIsGuarded(false), SUBMIT_GUARD_MS);
  }, []);

  // 화면이 다시 켜지면(탭이 다시 보이면) 2/2의 [등록]을 잠깐 막는다
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && stepRef.current === 2) startGuard();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
    };
  }, [startGuard]);

  // 단계를 옮기면 새 단계 제목으로 포커스를 옮긴다(화면 읽기 프로그램이 바뀐 화면을 알 수 있게)
  useEffect(() => {
    if (!movedStepRef.current) return;
    stepTitleRef.current?.focus();
  }, [step]);

  // 등록이 끝나 실패 문구가 보이면 그 문구로 포커스를 옮긴다(비활성화된 등록 버튼에서 빠진 포커스를 되찾는다)
  useEffect(() => {
    if (submitError && !isSubmitting) errorRef.current?.focus();
  }, [submitError, isSubmitting]);

  const group = useMemo(() => toDoseGroup(drugs), [drugs]);
  const hasLowConfidence = drugs.some(needsNameCheck); // 확신 low 또는 허가 목록에 없는 이름
  const lowConfidenceHintId = `${idPrefix}-low-confidence`;

  const isReading = camera.phase === 'reading';
  const showForm = tab === 'manual' || camera.phase === 'result';
  const canProceed = step === 1 && showForm && canProceedDrugs(drugs);
  const canSubmit = step === 2 && !isSubmitting && !uncertain && !isGuarded && (selected?.length ?? 0) > 0;
  // 읽는 중에 탭을 바꾸면 뒤늦게 온 인식 결과가 직접 쓴 내용을 덮는다 - 읽는 동안은 탭을 잠근다
  // 등록됐는지 모르는 상태면 탭을 바꿔 처음부터 다시 쓰다가 같은 약을 또 등록하지 않게 잠근다
  const isTabLocked = isReading || isSubmitting || uncertain;

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
    stepRef.current = next;
    setStep(next);
    setSubmitError(undefined);
    if (next === 2) startGuard();
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
    stepRef.current = 1;
    setDrugs([createEmptyDrug()]);
    setSelected(null);
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
    const previous: CameraResult | undefined =
      camera.phase === 'result' ? { count: camera.count, truncated: camera.truncated } : camera.phase === 'idle' ? undefined : camera.previous;
    setCamera({ phase: 'reading', previous });
    setSubmitError(undefined);

    try {
      const image = await prepareOcrImage(file);
      const result = await recognizeMedicationEnvelope(wardId, image, controller.signal);
      if (controller.signal.aborted) return;
      const recognized = ocrResultToDraft(result);
      if (!recognized) {
        setCamera({ phase: 'error', message: OCR_NOT_FOUND_MESSAGE, previous });
        return;
      }
      // 다시 찍으면 전에 고른 시간도 새 봉투 기준으로 다시 정한다
      setDrugs(recognized.drugs);
      setSelected(null);
      setCamera({ phase: 'result', count: recognized.drugs.length, truncated: recognized.truncated });
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      setCamera({ phase: 'error', message: getOcrErrorMessage(error), previous });
    }
  };

  // 1/2 → 2/2: 처음 갈 때만 기본 선택을 채운다(이전으로 돌아갔다 와도 고른 값은 그대로)
  const goNext = () => {
    if (!canProceed) return;
    setSelected(current => current ?? defaultSlotsForGroup(group));
    moveStep(2);
  };

  const changeSelection = (slots: MedicationTimeSlot[]) => {
    setSelected(slots);
    setSubmitError(undefined);
  };

  // 결과를 모르는 실패(응답 없음·408·5xx)는 서버에 등록됐을 수 있다 - "확인 필요"로 막고 다시 보내지 않는다
  // (목록은 mutation이 실패에도 새로고침한다). BE가 처리 전에 거절한 4xx는 고쳐서 다시 등록할 수 있다
  const submit = async () => {
    if (!canSubmit || !selected) return;
    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      await batchMutation.mutateAsync({ wardId, body: groupToBatchRequest(group, selected) });
      onClose();
    } catch (error) {
      const unknownResult = isUncertainFailure(error);
      if (unknownResult) setUncertain(true);
      setSubmitError(
        unknownResult ? UNCERTAIN_MESSAGE : (error instanceof Error && error.message) || '등록에 실패했어요. 다시 시도해 주세요',
      );
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

  const submitLabel = isSubmitting ? '등록 중…' : '등록';

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

        {/* 사진 결과가 나왔거나 2/2면 핸드폰에서는 탭을 접는다 - 탭은 처음 고를 때만 필요하다(다시 찍기는 아래 버튼) */}
        <div
          className={cx('tabs', { collapsible: (tab === 'camera' && camera.phase === 'result') || step === 2 })}
          role="tablist"
          aria-label="약 추가 방법"
          onKeyDown={handleTabKeyDown}
        >
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
                  <p className={cx('cameraText')}>복약 안내문을 비춰 주세요</p>
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
                    {camera.previous && (
                      <button
                        type="button"
                        className={cx('cameraButton', 'ghost')}
                        onClick={() => camera.previous && setCamera({ phase: 'result', ...camera.previous })}
                      >
                        전에 찍은 결과로
                      </button>
                    )}
                    <button type="button" className={cx('cameraButton', 'ghost')} onClick={() => selectTab('manual')}>
                      직접 쓰기로
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 제목이 먼저(핸드폰에서 한 줄: 제목 ··· 진행). PC는 CSS가 진행 막대를 위로 올려 예전 모양 그대로 */}
          {showForm && (
            <div className={cx('stepHeader')}>
              <h4 ref={stepTitleRef} className={cx('stepTitle')} tabIndex={-1}>
                {STEP_TITLE[step]}
              </h4>
              <div className={cx('progress')}>
                <div className={cx('progressBar')} aria-hidden="true">
                  <span className={cx('progressFill')} />
                  <span className={cx('progressFill', { empty: step === 1 })} />
                </div>
                <span className={cx('progressText')} aria-label={`2단계 중 ${step}단계`}>
                  {step} / 2
                </span>
              </div>
            </div>
          )}

          {/* 결과 문구와 노란 칸 안내를 상자 하나로(핸드폰에서 두 상자가 화면 위쪽을 차지했다, 2026-10-24) */}
          {step === 1 && tab === 'camera' && camera.phase === 'result' && (
            <div
              id={hasLowConfidence ? lowConfidenceHintId : undefined}
              className={cx(hasLowConfidence ? 'checkBox' : 'resultBanner')}
              role="status"
            >
              {/* "찾았어요" 다음에 줄을 바꾼다(2026-10-24 사용자 요청) */}
              <p>✓ 약 {camera.count}개를 찾았어요.</p>
              <p>{hasLowConfidence ? '노란 칸의 약 이름을 한 번 더 확인해 주세요' : '맞는지 확인해 주세요'}</p>
              {camera.truncated && (
                <p className={cx('resultNote')}>
                  한 번에 {MAX_DRUGS}개까지만 가져왔어요. 나머지는 등록 후 다시 추가해 주세요
                </p>
              )}
            </div>
          )}

          {step === 1 && showForm && hasLowConfidence && !(tab === 'camera' && camera.phase === 'result') && (
            <p id={lowConfidenceHintId} className={cx('checkBox')}>
              노란 칸의 약 이름을 한 번 더 확인해 주세요
            </p>
          )}

          {showForm && step === 1 && (
            <MedicationDraftForm
              drugs={drugs}
              lowConfidenceHintId={hasLowConfidence ? lowConfidenceHintId : undefined}
              onChange={changeDrugs}
            />
          )}

          {showForm && step === 2 && (
            <MedicationDoseTimeStep
              selected={selected ?? []}
              disabled={isSubmitting || uncertain}
              onChange={changeSelection}
            />
          )}

          {submitError && (
            <p ref={errorRef} className={cx('error')} role="alert" tabIndex={-1}>
              {submitError}
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
                disabled={isSubmitting || uncertain}
              >
                이전
              </button>
              <button ref={submitRef} type="submit" className={cx('submitButton')} disabled={!canSubmit}>
                {submitLabel}
              </button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
