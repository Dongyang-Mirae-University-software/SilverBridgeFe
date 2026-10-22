'use client';

import { ChangeEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import classNames from 'classnames/bind';

import { recognizeMedicationEnvelope } from '@/service/api/guardian/medication';
import { useAddWardMedicationBatchMutation } from '@/service/query/guardian/medication';
import {
  canSubmitDraft,
  createEmptyDraft,
  draftToBatchRequest,
  getSubmitLabel,
  MAX_DRUGS,
  MedicationDraft,
  ocrResultToDraft,
} from '@/utils/medication/medicationDraft';
import { getOcrErrorMessage, OCR_NOT_FOUND_MESSAGE, prepareOcrImage } from '@/utils/medication/ocrImage';
import { MedicationDraftForm } from './MedicationDraftForm';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

type AddTab = 'camera' | 'manual';
const TABS: { value: AddTab; label: string }[] = [
  { value: 'camera', label: '카메라로 찍기' },
  { value: 'manual', label: '직접 쓰기' },
];

type CameraState =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'result'; count: number; truncated: boolean; timingVaries: boolean }
  | { phase: 'error'; message: string };

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

// 보호자 "약 추가" - 약 봉투를 찍어 초안을 채우거나 직접 쓴다. 등록은 일괄 등록 API 1회(전부 성공 또는 전부 실패)
// 사진·인식 결과는 화면 상태로만 다루고 저장하지 않는다. 인식 결과는 언제나 초안이라 자동 등록하지 않는다
export function MedicationAddModal({ wardId, onClose }: MedicationAddModalProps) {
  const [tab, setTab] = useState<AddTab>('camera');
  const [camera, setCamera] = useState<CameraState>({ phase: 'idle' });
  const [draft, setDraft] = useState<MedicationDraft>(createEmptyDraft);
  const [submitError, setSubmitError] = useState<string>();
  const dialogRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const overlayPressRef = useRef(false);
  const batchMutation = useAddWardMedicationBatchMutation();
  const idPrefix = useId();
  const tabId = (value: AddTab) => `${idPrefix}-tab-${value}`;
  const panelId = `${idPrefix}-panel`;

  // 모달을 닫으면 진행 중인 인식 요청을 끊고, 열기 전에 있던 곳으로 포커스를 돌려준다
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    return () => {
      abortRef.current?.abort();
      previousFocus?.focus?.();
    };
  }, []);

  const isReading = camera.phase === 'reading';
  const isSubmitting = batchMutation.isPending;
  const showForm = tab === 'manual' || camera.phase === 'result';
  const canSubmit = showForm && canSubmitDraft(draft) && !isSubmitting;
  // 읽는 중에 탭을 바꾸면 뒤늦게 온 인식 결과가 직접 쓴 내용을 덮는다 - 읽는 동안은 탭을 잠근다
  const isTabLocked = isReading || isSubmitting;

  // 등록 중에 닫으면 결과(실패 안내)를 볼 수 없다 - 등록이 끝날 때까지 닫지 않는다
  const requestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const changeDraft = (next: MedicationDraft) => {
    setDraft(next);
    setSubmitError(undefined);
  };

  const selectTab = (next: AddTab) => {
    if (isTabLocked || next === tab) return;
    setTab(next);
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
      setDraft(recognized.draft);
      setCamera({
        phase: 'result',
        count: recognized.draft.drugs.length,
        truncated: recognized.truncated,
        timingVaries: recognized.timingVaries,
      });
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      setCamera({ phase: 'error', message: getOcrErrorMessage(error) });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitError(undefined);
    batchMutation.mutate(
      { wardId, body: draftToBatchRequest(draft) },
      {
        onSuccess: onClose,
        onError: error => setSubmitError(error.message || '등록에 실패했어요. 다시 시도해 주세요'),
      },
    );
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

  // Esc로 닫기 + Tab 키 포커스를 모달 안에 가둔다
  const handleDialogKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // 바깥 클릭 닫기는 누르기·떼기가 모두 바깥일 때만(입력 칸에서 드래그하다 바깥에서 떼면 닫히지 않게)
  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    overlayPressRef.current = event.target === event.currentTarget;
  };
  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    const pressedOutside = overlayPressRef.current;
    overlayPressRef.current = false;
    if (pressedOutside && event.target === event.currentTarget) requestClose();
  };

  const submitLabel = isSubmitting ? '등록 중…' : getSubmitLabel(draft.drugs.length);

  return (
    <div className={cx('overlay')} role="presentation" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <form
        ref={dialogRef}
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="약 추가"
        onSubmit={handleSubmit}
        onKeyDown={handleDialogKeyDown}
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

          {tab === 'camera' && camera.phase === 'result' && (
            <div className={cx('resultBanner')} role="status">
              <p>✓ 약 {camera.count}개를 찾았어요. 맞는지 확인해 주세요</p>
              {camera.truncated && (
                <p className={cx('resultNote')}>
                  한 번에 {MAX_DRUGS}개까지만 가져왔어요. 나머지는 등록 후 다시 추가해 주세요
                </p>
              )}
              {camera.timingVaries && (
                <p className={cx('resultNote')}>약마다 복용 안내가 달라 비워 두었어요. 필요하면 직접 써 주세요</p>
              )}
            </div>
          )}

          {showForm && <MedicationDraftForm draft={draft} disabled={isSubmitting} onChange={changeDraft} />}

          {submitError && (
            <p className={cx('error')} role="alert">
              {submitError}
            </p>
          )}
        </div>

        <footer className={cx('footer')}>
          {tab === 'camera' && camera.phase === 'result' ? (
            <button type="button" className={cx('cancelButton')} onClick={openCamera} disabled={isSubmitting}>
              다시 찍기
            </button>
          ) : (
            <button type="button" className={cx('cancelButton')} onClick={requestClose} disabled={isSubmitting}>
              취소
            </button>
          )}
          {showForm && (
            <button type="submit" className={cx('submitButton')} disabled={!canSubmit}>
              {submitLabel}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
