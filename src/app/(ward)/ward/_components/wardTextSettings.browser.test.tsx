// 피보호자 글자 크기·진한 글자 설정이 본문 CSS에 실제로 반영되는지 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 보호자 화면에는 변수가 없어 같은 공용 컴포넌트가 지금 값 그대로 그려져야 한다.

import { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import PageLayout from '@/components/layout/PageLayout';
import { DEFAULT_WARD_SETTINGS, getWardTextVars } from '@/constants/wardSettings';
import { RemoveCameraDialog } from '../camera/_components/RemoveCameraDialog';

afterEach(() => {
  document.body.innerHTML = '';
});

function WardStage({ fontSize, highContrast, children }: { fontSize: number; highContrast: boolean; children: ReactNode }) {
  return <div style={getWardTextVars({ fontSize, highContrast }) as CSSProperties}>{children}</div>;
}

const style = (el: Element) => getComputedStyle(el);

describe('피보호자 글자 설정', () => {
  it('보통·꺼짐이면 지금 값 그대로(21px·800)', async () => {
    const screen = render(
      <WardStage {...DEFAULT_WARD_SETTINGS}>
        <RemoveCameraDialog label="거실" isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
      </WardStage>,
    );
    const title = screen.getByRole('heading', { name: '거실 카메라 등록을 해제할까요?' }).element();
    expect(style(title).fontSize).toBe('21px');
    expect(style(title).fontWeight).toBe('800');
  });

  it('크게(21)는 1.24배, 아주 크게(25)는 1.47배로 본문 글자가 커진다', async () => {
    for (const [fontSize, expected] of [
      [21, 21 * 1.235],
      [25, 21 * 1.471],
    ]) {
      const screen = render(
        <WardStage fontSize={fontSize} highContrast={false}>
          <RemoveCameraDialog label="거실" isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
        </WardStage>,
      );
      const title = screen.getByRole('heading', { name: '거실 카메라 등록을 해제할까요?' }).element();
      expect(parseFloat(style(title).fontSize)).toBeCloseTo(expected, 0);
      screen.unmount();
    }
  });

  it('진한 글자를 켜면 굵기가 200 늘어난다(취소 버튼 700 → 900)', async () => {
    const off = render(<RemoveCameraDialog label="거실" isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const offWeight = Number(style(off.getByRole('button', { name: '취소' }).element()).fontWeight);
    off.unmount();

    const on = render(
      <WardStage fontSize={17} highContrast>
        <RemoveCameraDialog label="거실" isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
      </WardStage>,
    );
    const onWeight = Number(style(on.getByRole('button', { name: '취소' }).element()).fontWeight);
    expect(onWeight - offWeight).toBe(200);
  });

  it('공용 PageLayout은 변수가 없는 곳(보호자 화면)에서 지금 값 그대로다', async () => {
    const screen = render(<PageLayout title="공지사항">본문</PageLayout>);
    const h1 = screen.getByRole('heading', { name: '공지사항' }).element();
    // 테스트 화면은 375px - 900px 이하 규칙의 기존 값 30px
    expect(style(h1).fontSize).toBe('30px');
    expect(style(h1).fontWeight).toBe('800');
  });

  it('hideTitle이면 제목이 화면에서 숨지만 스크린 리더용 h1은 남는다', async () => {
    const screen = render(
      <PageLayout title="오늘 먹을 약" description="설명" hideTitle>
        본문
      </PageLayout>,
    );
    const h1 = screen.getByRole('heading', { name: '오늘 먹을 약' }).element() as HTMLElement;
    expect(h1.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(screen.getByText('설명').elements()).toHaveLength(0);
  });
});
