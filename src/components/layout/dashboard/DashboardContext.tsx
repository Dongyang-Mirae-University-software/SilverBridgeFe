'use client';

import { createContext, ReactNode, useContext } from 'react';

import { WardSettings } from './types';

interface DashboardContextValue {
  updateWardSettings: (settings: Partial<WardSettings>) => void;
  wardSettings: WardSettings;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children, value }: { children: ReactNode; value: DashboardContextValue }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard는 DashboardProvider 내부에서만 사용할 수 있습니다.');

  return context;
}
