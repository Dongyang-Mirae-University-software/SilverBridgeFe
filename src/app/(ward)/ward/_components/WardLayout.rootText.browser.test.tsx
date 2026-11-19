// 피보호자 글자 배율·진한 글자 변수를 루트에도 둔다 - 119 키패드·공용 모달은 화면 영역 밖(루트 ModalHost)에 그려진다(2026-11-19 점검 M-1)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { useWardRootTextSettings } from './WardLayout';

// WardLayout 모듈이 끌어오는 next/navigation 은 이 훅과 무관하다
vi.mock('next/navigation', () => ({ usePathname: () => '/ward', useRouter: () => ({ replace: () => {}, push: () => {} }) }));

function Probe({ fontSize, highContrast }: { fontSize: number; highContrast: boolean }) {
  useWardRootTextSettings({ fontSize, highContrast });
  return null;
}

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe('useWardRootTextSettings', () => {
  afterEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('루트에 글자 크기·배율·진한 글자 변수를 두고, 설정이 바뀌면 따라간다', async () => {
    const screen = await render(<Probe fontSize={28} highContrast />);
    expect(document.documentElement.style.fontSize).toBe('28px');
    expect(rootVar('--ward-font-scale')).toBe('1.647');
    expect(rootVar('--ward-weight-boost')).toBe('200');

    await screen.rerender(<Probe fontSize={17} highContrast={false} />);
    expect(rootVar('--ward-font-scale')).toBe('1');
    expect(rootVar('--ward-weight-boost')).toBe('0');
  });

  it('피보호자 화면을 벗어나면(언마운트) 루트 값을 지운다 - 보호자 화면에 남지 않게', async () => {
    const screen = await render(<Probe fontSize={21} highContrast />);
    await screen.unmount();
    expect(document.documentElement.style.fontSize).toBe('');
    expect(rootVar('--ward-font-scale')).toBe('');
    expect(rootVar('--ward-weight-boost')).toBe('');
  });
});
