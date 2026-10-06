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

// 백엔드 /api/ward/sos-setting의 enum 값과 1:1로 맞춘 값. CALL_119(119 화면만 바로
// 띄우고 끝)는 2026-10-07 프로토타입에서 제거됐다 — 보호자 알림은 항상 켜져 있고
// 끌 수 없으므로, "알림 없이 119만"이라는 선택지 자체가 혼란만 줬다
export type WardSosAction = 'CALL_119_AND_NOTIFY' | 'NOTIFY_GUARDIAN_FIRST';

export interface WardSettings {
  fontSize: number;
  highContrast: boolean;
  sosAction: WardSosAction;
}
