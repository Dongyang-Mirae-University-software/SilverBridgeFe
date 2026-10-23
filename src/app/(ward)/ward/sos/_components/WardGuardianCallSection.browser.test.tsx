// 피보호자 SOS 화면 보호자 카드 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 디자인 SOS 화면(2026-10-23): "이름 (관계)" + 초록 원 전화 버튼, 카드 전체가 실제 가족 전화(tel:)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';

import type { IConnectionItem } from '@/service/interface/connection';
import { WardGuardianCallSection } from './WardGuardianCallSection';

// next/link 는 테스트 브라우저에서 Next 런타임(process)을 찾아 깨지므로 일반 링크로 바꾼다(빈 화면 "보호자 연결하기")
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function guardian(id: number, name: string, relation: string | null, phone: string | null): IConnectionItem {
  return {
    id,
    partnerUserId: `g${id}`,
    partnerName: name,
    partnerProfileImage: null,
    partnerPhone: phone,
    relation,
    status: 'ACTIVE',
    connectedAt: `2026-10-0${id}T00:00:00Z`,
    createdAt: `2026-10-0${id}T00:00:00Z`,
  };
}

function renderSection(activeGuardians: IConnectionItem[], onGuardianCall = vi.fn()) {
  return render(
    <WardGuardianCallSection
      activeGuardians={activeGuardians}
      isGuardiansError={false}
      isLoadingGuardians={false}
      onGuardianCall={onGuardianCall}
    />,
  );
}

describe('WardGuardianCallSection (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('보호자 카드는 "이름 (관계)"를 보이고, 카드를 누르면 그 번호로 전화하며 GUARDIAN_CALL 기록을 부른다', async () => {
    const onGuardianCall = vi.fn();
    const screen = renderSection(
      [guardian(1, '박민수', '아들', '010-1234-5678'), guardian(2, '박지영', '며느리', '01023456789')],
      onGuardianCall,
    );

    await expect.element(screen.getByText('박민수')).toBeVisible();
    await expect.element(screen.getByText('(아들)')).toBeVisible();
    const call = screen.getByRole('link', { name: '박민수(아들)에게 전화하기' });
    await expect.element(call).toHaveAttribute('href', 'tel:01012345678');
    await expect
      .element(screen.getByRole('link', { name: '박지영(며느리)에게 전화하기' }))
      .toHaveAttribute('href', 'tel:01023456789');

    // 테스트 브라우저에서 실제 다이얼러로 이동하지 않게 기본 동작만 막고 클릭 처리는 확인한다
    call.element().addEventListener('click', event => event.preventDefault());
    await call.click();
    expect(onGuardianCall).toHaveBeenCalledTimes(1);
  });

  it('관계가 없으면 이름만, 전화번호가 없으면 링크 없이 "전화번호가 없어요"', async () => {
    const screen = renderSection([guardian(1, '김보호', null, null)]);

    await expect.element(screen.getByText('김보호')).toBeVisible();
    expect(screen.getByText(/\(/).query()).toBeNull();
    await expect.element(screen.getByText('전화번호가 없어요')).toBeVisible();
    expect(screen.getByRole('link').query()).toBeNull();
  });

  it('375px에서는 카드가 한 줄에 하나씩, 가로로 넘치지 않는다', async () => {
    await page.viewport(375, 812);
    const screen = renderSection([
      guardian(1, '박민수', '아들', '01012345678'),
      guardian(2, '박지영', '며느리', '01023456789'),
    ]);
    const first = screen
      .getByRole('link', { name: /박민수/ })
      .element()
      .getBoundingClientRect();
    const second = screen
      .getByRole('link', { name: /박지영/ })
      .element()
      .getBoundingClientRect();

    // 목록은 연결 최신순이라 순서와 무관하게 위아래로 겹치지 않는지만 본다
    const [upper, lower] = [first, second].sort((a, b) => a.top - b.top);
    expect(lower.top).toBeGreaterThanOrEqual(upper.bottom);
    expect(Math.min(first.height, second.height)).toBeGreaterThanOrEqual(96);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
