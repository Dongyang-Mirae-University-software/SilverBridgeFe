'use client';

import { Fragment } from 'react';

import useModalStore, { ModalRootId } from '@/store/modalStore';

export function ModalHost({ rootId = 'modal-root' }: { rootId?: ModalRootId }) {
  const modals = useModalStore(state => state.modals.filter(modal => modal.rootId === rootId));

  return (
    <>
      {modals.map(modal => (
        <Fragment key={modal.id}>{modal.Component}</Fragment>
      ))}
    </>
  );
}
