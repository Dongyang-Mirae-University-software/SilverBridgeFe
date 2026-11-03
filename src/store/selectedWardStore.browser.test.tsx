// 보호자가 고른 피보호자가 화면을 옮겨도·새로고침해도 이어지는지 - 실제 Chrome에서 돈다(`npm run test:browser`)
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import useSelectedWardId, { clearSelectedWardId, setSelectedWardId, useSelectedWard } from './selectedWardStore';

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

  // 대시보드는 최근 연결 순, 다른 화면은 API 순이라 "첫 번째"가 다르다 - 아무도 고르지 않았을 때 어긋나던 문제
  function WardPage({ label, order, replaceMissing }: { label: string; order: string[]; replaceMissing?: boolean }) {
    const ward = useSelectedWard(order, id => id, { replaceMissing });
    return (
      <p>
        {label}: {ward ?? '없음'}
      </p>
    );
  }

  it('아무도 고르지 않았으면 처음 들른 화면의 피보호자를 다른 순서의 화면에서도 그대로 보인다', async () => {
    clearSelectedWardId();
    const dashboard = render(<WardPage label="대시보드" order={['ward-b', 'ward-a']} />);
    await expect.element(page.getByText('대시보드: ward-b')).toBeVisible();
    dashboard.unmount();

    render(<WardPage label="SOS 이력" order={['ward-a', 'ward-b']} />);
    await expect.element(page.getByText('SOS 이력: ward-b')).toBeVisible();
  });

  it('고른 피보호자가 연결 목록에 없으면(연결 해제) 보이는 사람으로 전역 선택을 바꾼다', async () => {
    setSelectedWardId('ward-gone');
    render(<WardPage label="이상감지" order={['ward-a', 'ward-b']} />);
    await expect.element(page.getByText('이상감지: ward-a')).toBeVisible();
    await vi.waitFor(() => expect(sessionStorage.getItem('careai_selected_ward_id')).toBe('ward-a'));
  });

  it('일부만 담긴 목록(replaceMissing: false)은 다른 화면에서 고른 사람을 덮어쓰지 않는다', async () => {
    setSelectedWardId('ward-c');
    render(<WardPage label="복약" order={['ward-a']} replaceMissing={false} />);
    await expect.element(page.getByText('복약: ward-a')).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sessionStorage.getItem('careai_selected_ward_id')).toBe('ward-c');
  });
});
