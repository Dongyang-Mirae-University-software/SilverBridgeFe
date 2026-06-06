'use client';

import Link from 'next/link';

import { WARD_ACTIONS } from '@/constants/dashboard';
import classNames from 'classnames/bind';
import styles from './WardHomeContent.module.css';

const cx = classNames.bind(styles);

export function WardHomeContent() {
  return (
    <div className={cx('contentGrid')}>
      <section className={cx('quickGrid', 'wardHomeActionGrid')}>
        {WARD_ACTIONS.map(action => (
          <Link key={action.href} className={cx('actionCard')} href={action.href}>
            <strong>{action.label}</strong>
          </Link>
        ))}
      </section>
    </div>
  );
}
