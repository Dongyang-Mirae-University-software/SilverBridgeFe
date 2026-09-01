import { useSyncExternalStore } from 'react';

import type { CommonModalTone, CommonModalType } from '@/components/CommonModal';

export interface ModalState {
  id: number;
  type?: CommonModalType;
  tone?: CommonModalTone;
  title?: string;
  message: string;
  confirmText?: string;
  secondaryText?: string;
  onConfirm?: () => void;
  onSecondary?: () => void;
}

type ModalInput = Omit<ModalState, 'id'>;
type ModalListener = () => void;

let modalState: ModalState[] = [];
let modalId = 0;
const listeners = new Set<ModalListener>();

function emitChange() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: ModalListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return modalState;
}

function getServerSnapshot() {
  return [];
}

export function openModal(modal: ModalInput) {
  modalId += 1;
  modalState = [...modalState, { ...modal, id: modalId }];
  emitChange();
  return modalId;
}

export function closeModal(id?: number) {
  if (id === undefined) {
    modalState = modalState.slice(0, -1);
  } else {
    modalState = modalState.filter(modal => modal.id !== id);
  }
  emitChange();
}

export function closeAllModals() {
  modalState = [];
  emitChange();
}

export function useModalStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
