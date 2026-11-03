// 관리자 제휴 병원 - 진료 시간·진료과 입력칸에 이름이 있어 화면 읽기 프로그램·자동 점검이 찾을 수 있는지. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { AdminHospitalItem } from '@/service/interface/admin/hospital';
import { AdminHospitalsContent } from './AdminHospitalsContent';

const HOSPITAL: AdminHospitalItem = {
  id: 1,
  name: '강남내과',
  region: '서울 강남구',
  address: '서울 강남구 테헤란로 1',
  phone: '02-0000-0000',
  description: '',
  openTime: '09:00',
  closeTime: '18:00',
  bookingAvailable: true,
  departments: [{ id: 11, name: '내과' }],
  status: null,
  registeredAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
};

vi.mock('@/service/query/admin', () => ({
  adminHospitalQueryKey: ['test-admin-hospital'],
  adminHospitalListQueryOptions: () =>
    queryOptions({
      queryKey: ['test-admin-hospital', 'list'],
      queryFn: async () => ({ content: [HOSPITAL], page: 0, size: 10, totalElements: 1, totalPages: 1 }),
    }),
  adminHospitalSummaryQueryOptions: queryOptions({ queryKey: ['test-admin-hospital', 'summary'], queryFn: async () => ({ total: 1, bookingAvailable: 1, latestRegisteredAt: null }) }),
}));

function renderHospitals() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminHospitalsContent />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AdminHospitalsContent 입력칸 이름 (Chrome)', () => {
  it('병원 추가 창의 진료 시간·진료과 입력칸을 이름으로 찾을 수 있다', async () => {
    await renderHospitals();
    await page.getByRole('button', { name: '병원 추가' }).click();

    for (const name of ['기본 진료 시작 시간', '기본 진료 종료 시간', '휴게 시작 시간', '휴게 종료 시간', '토요일 진료 시작 시간', '토요일 진료 종료 시간']) {
      await expect.element(page.getByLabelText(name, { exact: true })).toBeInTheDocument();
    }
    await expect.element(page.getByRole('textbox', { name: '진료과 직접 입력' })).toBeInTheDocument();
  });

  it('병원 수정 창의 등록된 진료과·새 진료과 입력칸을 이름으로 찾을 수 있다', async () => {
    await renderHospitals();
    await page.getByRole('button', { name: '수정' }).click();

    await expect.element(page.getByRole('textbox', { name: '내과 이름' })).toHaveValue('내과');
    await expect.element(page.getByRole('textbox', { name: '새 진료과' })).toBeInTheDocument();
  });
});
