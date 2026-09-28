'use client';

import classNames from 'classnames/bind';

import { GuardianConnectionRequestForm } from './GuardianConnectionRequestForm';
import { GuardianConnectionRequestHistory } from './GuardianConnectionRequestHistory';
import styles from './GuardianWardRegisterPanel.module.css';

const cx = classNames.bind(styles);

export function GuardianWardRegisterPanel({ embedded = false }: { embedded?: boolean }) {
  return (
    <section className={cx('page', { embedded })}>
      <GuardianConnectionRequestForm />
      <GuardianConnectionRequestHistory />
    </section>
  );
}
