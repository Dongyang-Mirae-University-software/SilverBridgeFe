'use client';

import { Fragment, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import useModalStore, { type ModalRootId } from '@/store/modalStore';

export function ModalHost({ rootId = 'modal-root' }: { rootId?: ModalRootId }) {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const modals = useModalStore(state => state.modals.filter(modal => modal.rootId === rootId));
  const resetModal = useModalStore(state => state.resetModal);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    resetModal();
  }, [pathname, resetModal]);

  return (
    <>
      {modals.map(modal => (
        <Fragment key={modal.id}>{modal.Component}</Fragment>
      ))}
    </>
  );
}
