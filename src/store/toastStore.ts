import { useSyncExternalStore } from 'react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ShowToastOptions {
  variant?: ToastVariant;
  duration?: number;
}

interface ToastStoreState {
  toasts: ToastItem[];
  showToast: (message: string, options?: ShowToastOptions) => void;
  dismissToast: (id: number) => void;
}

type ToastListener = () => void;

type ToastSelector<T> = (state: ToastStoreState) => T;

const DEFAULT_DURATION_MS = 4000;
const MAX_TOASTS = 3;

const listeners = new Set<ToastListener>();
let toastId = 0;
let storeState: ToastStoreState;

function emitChange() {
  listeners.forEach(listener => listener());
}

function setToasts(toasts: ToastItem[]) {
  storeState = { ...storeState, toasts };
  emitChange();
}

storeState = {
  toasts: [],
  showToast: (message, options = {}) => {
    toastId += 1;
    const id = toastId;
    const variant = options.variant ?? 'info';
    const duration = options.duration ?? DEFAULT_DURATION_MS;

    setToasts([...storeState.toasts, { id, message, variant }].slice(-MAX_TOASTS));

    if (typeof window !== 'undefined') {
      window.setTimeout(() => storeState.dismissToast(id), duration);
    }
  },
  dismissToast: id => {
    setToasts(storeState.toasts.filter(toast => toast.id !== id));
  },
};

function subscribe(listener: ToastListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return storeState;
}

function getServerSnapshot() {
  return storeState;
}

export default function useToastStore<T = ToastStoreState>(selector?: ToastSelector<T>) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return selector ? selector(state) : (state as T);
}

// 컴포넌트 밖(이벤트 핸들러 등)에서도 바로 쓸 수 있도록 훅과 별도로 내보냄
export function showToast(message: string, options?: ShowToastOptions) {
  storeState.showToast(message, options);
}
