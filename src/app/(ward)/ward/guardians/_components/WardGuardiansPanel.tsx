'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { Tabs } from '@/components/Tabs';
import { WardGuardianActiveSection } from './WardGuardianActiveSection';
import { WardGuardianPendingSection } from './WardGuardianPendingSection';
import styles from './WardGuardiansPanel.module.css';

const cx = classNames.bind(styles);
type WardGuardiansTab = 'active' | 'pending';

export function WardGuardiansPanel() {
  const [activeTab, setActiveTab] = useState<WardGuardiansTab>('active');

  return (
    <section className={cx('connectionPage')}>
      <Tabs
        ariaLabel="보호자 목록 탭"
        items={[
          { value: 'active', label: '내 보호자 리스트' },
          { value: 'pending', label: '요청온 목록' },
        ]}
        onChange={setActiveTab}
        size="sm"
        stretch
        value={activeTab}
      />

      {activeTab === 'active' ? <WardGuardianActiveSection /> : <WardGuardianPendingSection />}
    </section>
  );
}
