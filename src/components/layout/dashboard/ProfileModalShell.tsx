'use client';

import { ReactNode } from 'react';
import classNames from 'classnames/bind';

import { useModalDialog } from '@/hooks/useModalDialog';
import { AuthRole } from '@/lib/auth/tokenStore';
import styles from './ProfileModalShell.module.css';

const cx = classNames.bind(styles);

interface Props {
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  role: AuthRole;
}

export function ProfileModalShell({ children, footer, onClose, role }: Props) {
  const title = role === 'ADMIN' ? '운영자 프로필' : '내 프로필';
  // Esc로 닫기, 열리면 창 안으로 포커스, Tab은 창 안에서만, 닫으면 연 버튼으로 포커스(QA CHAT-N46)
  const { dialogRef, onDialogKeyDown, overlayProps } = useModalDialog<HTMLElement>({ onRequestClose: onClose });

  return (
    <div className={cx('overlay')} role="presentation" {...overlayProps}>
      <section
        ref={dialogRef}
        className={cx('modal', `modal${role}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onKeyDown={onDialogKeyDown}
      >
        <header className={cx('titleBar')}>
          <span id="profile-modal-title">{title}</span>
          <button className={cx('closeButton')} type="button" aria-label="닫기" onClick={onClose}>✕</button>
        </header>
        <div className={cx('body')}>{children}</div>
        <footer className={cx('footer')}>{footer}</footer>
      </section>
    </div>
  );
}
