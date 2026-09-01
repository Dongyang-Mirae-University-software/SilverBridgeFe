import { type ReactElement, useSyncExternalStore } from 'react';

export type ModalRootId = 'modal-root' | 'demo-fullscreen-modal-root';

interface ModalItem {
  id: number;
  Component: ReactElement;
  rootId: ModalRootId;
}

interface ModalStoreState {
  modals: ModalItem[];
  openModal: (Component: ReactElement, rootId?: ModalRootId) => void;
  onCloseModal: () => void;
  resetModal: () => void;
}

type ModalListener = () => void;

type ModalSelector<T> = (state: ModalStoreState) => T;

const listeners = new Set<ModalListener>();
let modalId = 0;
let storeState: ModalStoreState;

function emitChange() {
  listeners.forEach(listener => listener());
}

function setModals(modals: ModalItem[]) {
  storeState = { ...storeState, modals };
  emitChange();
}

storeState = {
  modals: [],
  openModal: (Component, rootId = 'modal-root') => {
    modalId += 1;
    setModals([...storeState.modals, { id: modalId, Component, rootId }]);
  },
  onCloseModal: () => {
    setModals(storeState.modals.slice(0, -1));
  },
  resetModal: () => {
    setModals([]);
  },
};

function subscribe(listener: ModalListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return storeState;
}

function getServerSnapshot() {
  return storeState;
}

export default function useModalStore<T = ModalStoreState>(selector?: ModalSelector<T>) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return selector ? selector(state) : (state as T);
}
