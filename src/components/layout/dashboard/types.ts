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
  | 'inquiries';

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
  | 'inquiry';

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

export type WardSosAction = 'call119' | 'call119AndNotify' | 'notifyGuardianFirst';

export interface WardSettings {
  fontSize: number;
  highContrast: boolean;
  sosAction: WardSosAction;
}
