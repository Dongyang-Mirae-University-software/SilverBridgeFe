'use client';

import classNames from 'classnames/bind';

import type { IConnectionItem } from '@/service/interface/connection';
import { ConnectionCard } from './ConnectionCard';
import styles from './ConnectionList.module.css';

const cx = classNames.bind(styles);

interface Props {
  connections: IConnectionItem[];
  getPrimaryAction?: (connection: IConnectionItem) => (() => void) | undefined;
  getPrimaryLabel?: (connection: IConnectionItem) => string | undefined;
  getSecondaryAction?: (connection: IConnectionItem) => (() => void) | undefined;
  getSecondaryLabel?: (connection: IConnectionItem) => string | undefined;
  isPending: boolean;
  role: 'guardian' | 'ward';
}

export function ConnectionList({
  connections,
  getPrimaryAction,
  getPrimaryLabel,
  getSecondaryAction,
  getSecondaryLabel,
  isPending,
  role,
}: Props) {
  return (
    <ul className={cx('connectionList')}>
      {connections.map(connection => (
        <ConnectionCard
          key={connection.id}
          connection={connection}
          isPending={isPending}
          role={role}
          primaryAction={getPrimaryAction?.(connection)}
          primaryLabel={getPrimaryLabel?.(connection)}
          secondaryAction={getSecondaryAction?.(connection)}
          secondaryLabel={getSecondaryLabel?.(connection)}
        />
      ))}
    </ul>
  );
}
