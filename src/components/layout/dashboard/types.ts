import { ReactNode } from 'react';

import { AuthRole } from '@/lib/auth/tokenStore';

export type PageKey =
  | 'home'
  | 'sos'
  | 'chatbot'
  | 'game'
  | 'hospital'
  | 'medication'
  | 'notices'
  | 'guardians'
  | 'settings'
  | 'dashboard'
  | 'detection'
  | 'emotion'
  | 'wards'
  | 'ward-register'
  | 'inquiries'
  | 'sos-history'
  | 'medication-management'
  | 'game-management'
  | 'camera-register';

export type NavIconName =
  | 'home'
  | 'phone'
  | 'message'
  | 'game'
  | 'hospital'
  | 'heart'
  | 'users'
  | 'bell'
  | 'settings'
  | 'dashboard'
  | 'alert'
  | 'plus'
  | 'inquiry'
  | 'camera'
  | 'brain';

export interface NavItem {
  href: string;
  icon: NavIconName;
  label: string;
  key: PageKey;
}

export interface DashboardLayoutProps {
  children?: ReactNode;
  pageKey: PageKey;
  role: AuthRole;
}

// 백엔드 /api/ward/sos-setting의 enum 값과 1:1로 맞춘 값 — CALL_119는 "전화를 건다"가
// 아니라 "119 화면을 띄운다"는 뜻. 세 값 모두 보호자 알림은 항상 나간다(2026-08-26 확정)
export type WardSosAction = 'CALL_119' | 'CALL_119_AND_NOTIFY' | 'NOTIFY_GUARDIAN_FIRST';

export interface WardSettings {
  fontSize: number;
  highContrast: boolean;
  sosAction: WardSosAction;
}
