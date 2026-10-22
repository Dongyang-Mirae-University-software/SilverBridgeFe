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
//   누른 버튼이 비활성화되면 Chrome이 포커스를 body로 옮긴다 - 그때도 Esc·Tab이 동작하도록 document에서도 받는다
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

  // 포커스가 body로 빠졌을 때만 처리한다(대화상자 안이면 onDialogKeyDown이 받는다)
  useEffect(() => {
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      const dialog = dialogRef.current;
      const active = document.activeElement;
      if (!dialog || (active && active !== document.body)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      event.preventDefault();
      (event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
    };
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => document.removeEventListener('keydown', onDocumentKeyDown);
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
