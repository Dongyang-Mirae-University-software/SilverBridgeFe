'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import classNames from 'classnames/bind';

import { recognizeMedicationEnvelope } from '@/service/api/guardian/medication';
import { useAddWardMedicationBatchMutation } from '@/service/query/guardian/medication';
import {
  canSubmitDraft,
  createEmptyDraft,
  draftToBatchRequest,
  getSubmitLabel,
  MedicationDraft,
  ocrResultToDraft,
} from '@/utils/medication/medicationDraft';
import { getOcrErrorMessage, OCR_NOT_FOUND_MESSAGE, prepareOcrImage } from '@/utils/medication/ocrImage';
import { MedicationDraftForm } from './MedicationDraftForm';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

type AddTab = 'camera' | 'manual';

type CameraState =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'result'; count: number }
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

// 보호자 "약 추가" - 약 봉투를 찍어 초안을 채우거나 직접 쓴다. 등록은 일괄 등록 API 1회(전부 성공 또는 전부 실패)
// 사진·인식 결과는 화면 상태로만 다루고 저장하지 않는다. 인식 결과는 언제나 초안이라 자동 등록하지 않는다
export function MedicationAddModal({ wardId, onClose }: MedicationAddModalProps) {
  const [tab, setTab] = useState<AddTab>('camera');
  const [camera, setCamera] = useState<CameraState>({ phase: 'idle' });
  const [draft, setDraft] = useState<MedicationDraft>(createEmptyDraft);
  const [submitError, setSubmitError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const batchMutation = useAddWardMedicationBatchMutation();

  // 모달을 닫으면 진행 중인 인식 요청을 끊는다
  useEffect(() => () => abortRef.current?.abort(), []);

  const isReading = camera.phase === 'reading';
  const isSubmitting = batchMutation.isPending;
  const showForm = tab === 'manual' || camera.phase === 'result';
  const canSubmit = showForm && canSubmitDraft(draft) && !isSubmitting;

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
      setDraft(recognized);
      setCamera({ phase: 'result', count: recognized.drugs.length });
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      setCamera({ phase: 'error', message: getOcrErrorMessage(error) });
    }
  };

  const switchToManual = () => {
    setTab('manual');
    setSubmitError(undefined);
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

  const submitLabel = isSubmitting ? '등록 중…' : getSubmitLabel(draft.drugs.length);

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <form
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="약 추가"
        onClick={event => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className={cx('header')}>
          <h3>약 추가</h3>
          <button type="button" className={cx('close')} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('tabs')} role="tablist" aria-label="약 추가 방법">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'camera'}
            className={cx('tab', { active: tab === 'camera' })}
            onClick={() => setTab('camera')}
            disabled={isSubmitting}
          >
            카메라로 찍기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'manual'}
            className={cx('tab', { active: tab === 'manual' })}
            onClick={switchToManual}
            disabled={isSubmitting}
          >
            직접 쓰기
          </button>
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

        <div className={cx('body')}>
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
                    <button type="button" className={cx('cameraButton', 'ghost')} onClick={switchToManual}>
                      직접 쓰기로
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'camera' && camera.phase === 'result' && (
            <p className={cx('resultBanner')} role="status">
              ✓ 약 {camera.count}개를 찾았어요. 맞는지 확인해 주세요
            </p>
          )}

          {showForm && <MedicationDraftForm draft={draft} disabled={isSubmitting} onChange={setDraft} />}

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
            <button type="button" className={cx('cancelButton')} onClick={onClose} disabled={isSubmitting}>
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
