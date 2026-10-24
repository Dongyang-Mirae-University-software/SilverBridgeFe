// 피보호자 환경설정(SOS 동작·글자 크기·진한 글자) 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import type { WardSettings } from '@/components/layout/dashboard/types';
import { DEFAULT_WARD_SETTINGS } from '@/constants/wardSettings';
import { WardDisplaySettingsSection, WardSosSettingsSection } from './WardBasicSettingsSection';

const api = vi.hoisted(() => ({ updateWardSosSetting: vi.fn() }));
vi.mock('@/service/api/ward/sosSetting', () => ({
  getWardSosSetting: vi.fn(),
  updateWardSosSetting: api.updateWardSosSetting,
}));

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('@/store/toastStore', () => ({ showToast: toast.showToast }));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

function withClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

// WardLayout의 설정 상태를 흉내 낸다
function Harness({ section }: { section: 'sos' | 'display' }) {
  const [settings, setSettings] = useState<WardSettings>({ ...DEFAULT_WARD_SETTINGS, sosAction: 'CALL_119_AND_NOTIFY' });
  const update = (next: Partial<WardSettings>) => setSettings(prev => ({ ...prev, ...next }));
  return section === 'sos' ? (
    <WardSosSettingsSection updateWardSettings={update} wardSettings={settings} />
  ) : (
    <WardDisplaySettingsSection updateWardSettings={update} wardSettings={settings} />
  );
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('SOS 동작 (피보호자)', () => {
  it('두 값만 고를 수 있고, 보호자 알림은 항상 간다고 안내한다', async () => {
    const screen = render(withClient(<Harness section="sos" />));

    const radios = screen.getByRole('radio').elements() as HTMLInputElement[];
    expect(radios.map(r => r.value)).toEqual(['CALL_119_AND_NOTIFY', 'NOTIFY_GUARDIAN_FIRST']);
    await expect.element(screen.getByText('항상 켜짐')).toBeInTheDocument();
    expect(document.body.textContent).toContain('연결된 보호자 모두에게 항상 알림이 가요');
    expect(document.body.textContent).not.toContain('알림 없이');
  });

  it('고르면 저장하고, 실패하면 이전 값으로 되돌리고 안내한다', async () => {
    let rejectSave!: (error: unknown) => void;
    api.updateWardSosSetting.mockReturnValue(new Promise((_, reject) => (rejectSave = reject)));
    const screen = render(withClient(<Harness section="sos" />));
    const first = screen.getByRole('radio', { name: /119 화면 바로 열기/ });
    const second = screen.getByRole('radio', { name: /보호자 알림 먼저/ });
    await expect.element(first).toBeChecked();

    await second.click();
    await expect.element(second).toBeChecked();
    expect(api.updateWardSosSetting).toHaveBeenCalledWith({ sosAction: 'NOTIFY_GUARDIAN_FIRST' });
    // 저장 중에는 다시 고르지 못한다
    await expect.element(first).toBeDisabled();

    rejectSave(Object.assign(new Error('서버 오류'), { status: 500 }));

    await expect.element(first).toBeChecked();
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), { variant: 'error' });
  });
});

describe('글자 크기·진한 글자 (피보호자)', () => {
  it('진한 글자 스위치는 켜짐/꺼짐 글자로 상태를 보여 주고, 이 기기에서만 적용된다고 안내한다', async () => {
    const screen = render(<Harness section="display" />);
    const toggle = screen.getByRole('switch', { name: '진한 글자로 보기' });
    await expect.element(toggle).not.toBeChecked();
    await expect.element(screen.getByText('꺼짐')).toBeInTheDocument();
    await expect.element(screen.getByText(/이 기기에서만 적용돼요/)).toBeInTheDocument();

    await toggle.click();
    await expect.element(toggle).toBeChecked();
    await expect.element(screen.getByText('켜짐')).toBeInTheDocument();
  });

  it('375px에서 가로로 넘치지 않고 바깥 문서 스크롤을 만들지 않는다', async () => {
    await page.viewport(375, 812);
    const scroller = document.createElement('div');
    scroller.style.cssText = 'position:fixed;inset:0;overflow:auto;padding:16px;box-sizing:border-box;';
    document.body.style.margin = '0';
    document.body.appendChild(scroller);
    const screen = render(
      withClient(
        <>
          <Harness section="display" />
          <Harness section="sos" />
        </>,
      ),
      { container: scroller },
    );
    await expect.element(screen.getByRole('switch', { name: '진한 글자로 보기' })).toBeInTheDocument();

    expect(window.innerWidth).toBe(375);
    expect(document.documentElement.scrollHeight).toBe(window.innerHeight);
    expect(document.documentElement.scrollWidth).toBe(window.innerWidth);
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
  });
});
