// 보호자가 고른 피보호자가 화면을 옮겨도·새로고침해도 이어지는지 - 실제 Chrome에서 돈다(`npm run test:browser`)
import { describe, expect, it } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import useSelectedWardId, { setSelectedWardId } from './selectedWardStore';

function SelectedWard({ label }: { label: string }) {
  const wardId = useSelectedWardId();
  return (
    <p>
      {label}: {wardId ?? '없음'}
    </p>
  );
}

describe('selectedWardStore (Chrome)', () => {
  // 이 파일에서 처음 읽는 테스트여야 한다(모듈이 저장소를 한 번만 읽는다 = 새로고침 직후)
  it('새로고침 직후에는 탭 저장소에 남은 피보호자를 읽는다', async () => {
    sessionStorage.setItem('careai_selected_ward_id', 'ward-2');
    render(<SelectedWard label="새로고침" />);
    await expect.element(page.getByText('새로고침: ward-2')).toBeVisible();
  });

  it('한 화면에서 고르면 화면을 옮겨도(다른 컴포넌트) 같은 피보호자를 본다', async () => {
    const dashboard = render(
      <>
        <SelectedWard label="대시보드" />
        <button type="button" onClick={() => setSelectedWardId('ward-3')}>
          ward-3 고르기
        </button>
      </>,
    );
    await userEvent.click(page.getByRole('button', { name: 'ward-3 고르기' }));
    await expect.element(page.getByText('대시보드: ward-3')).toBeVisible();
    dashboard.unmount();

    render(<SelectedWard label="SOS 이력" />);
    await expect.element(page.getByText('SOS 이력: ward-3')).toBeVisible();
    expect(sessionStorage.getItem('careai_selected_ward_id')).toBe('ward-3');
  });
});
