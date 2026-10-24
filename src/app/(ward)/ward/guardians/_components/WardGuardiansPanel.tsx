'use client';

import { useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { wardConnectionsQueryKey } from '@/service/query/ward';
import { WardGuardianActiveSection } from './WardGuardianActiveSection';
import { WardGuardianPendingSection } from './WardGuardianPendingSection';
import styles from './WardGuardiansPanel.module.css';

const cx = classNames.bind(styles);

// 받은 요청(수락·거절)을 맨 위에, 연결된 보호자 카드를 그 아래에 둔다
export function WardGuardiansPanel() {
  const queryClient = useQueryClient();

  return (
    <section className={cx('connectionPage')}>
      <WardGuardianPendingSection />
      <WardGuardianActiveSection />
      <RefreshButton ariaLabel="내 가족 새로고침" onRefresh={() => queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey })} />
    </section>
  );
}
