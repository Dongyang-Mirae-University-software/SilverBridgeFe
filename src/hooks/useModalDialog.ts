'use client';

import { KeyboardEvent, MouseEvent, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseModalDialogOptions {
  // 닫기 요청(Esc·바깥 클릭). 등록 중처럼 닫으면 안 될 때는 호출자가 무시한다
  onRequestClose: () => void;
  // 열릴 때 포커스를 줄 요소(대화상자 안 CSS 선택자). 없으면 첫 포커스 가능 요소
  initialFocusSelector?: string;
}

// 모달 대화상자 공통 동작
// - 열리면 안쪽으로 포커스를 옮기고, 닫히면 열기 전 요소로 돌려준다
// - Esc로 닫기, Tab 키 포커스를 대화상자 안에 가두기
// - 바깥 클릭 닫기는 누르기·떼기가 모두 바깥일 때만(입력 칸에서 드래그하다 바깥에서 떼면 닫히지 않게)
export function useModalDialog<T extends HTMLElement>({ onRequestClose, initialFocusSelector }: UseModalDialogOptions) {
  const dialogRef = useRef<T>(null);
  const overlayPressRef = useRef(false);
  const requestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    requestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const target =
      (initialFocusSelector && dialog?.querySelector<HTMLElement>(initialFocusSelector)) ||
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();
    return () => previousFocus?.focus?.();
    // 열릴 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDialogKeyDown = (event: KeyboardEvent<T>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestCloseRef.current();
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

  const overlayProps = {
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      overlayPressRef.current = event.target === event.currentTarget;
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      const pressedOutside = overlayPressRef.current;
      overlayPressRef.current = false;
      if (pressedOutside && event.target === event.currentTarget) requestCloseRef.current();
    },
  };

  return { dialogRef, onDialogKeyDown, overlayProps };
}
