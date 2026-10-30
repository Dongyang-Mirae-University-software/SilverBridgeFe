// 카메라 등록 해제 확인창 - 제목만 보여 주고 버튼 동작은 그대로. 실제 Chrome에서 돈다(`npm run test:browser`)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { RemoveCameraDialog } from './RemoveCameraDialog';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RemoveCameraDialog', () => {
  it('"<방 이름> 카메라 등록을 해제할까요?" 제목만 보이고 설명 문구는 없다', async () => {
    const screen = render(<RemoveCameraDialog label="거실" isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog', { name: '거실 카메라 등록을 해제할까요?' });
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().hasAttribute('aria-describedby')).toBe(false);
    expect(dialog.element().querySelector('p')).toBeNull();
    expect(screen.getByText(/알림이 오지 않고|영상도 지워져요|촬영도 꺼져요/).elements()).toHaveLength(0);
  });

  it('취소·등록 해제 버튼은 그대로 동작한다', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const screen = render(<RemoveCameraDialog label="안방" isPending={false} onCancel={onCancel} onConfirm={onConfirm} />);

    await screen.getByRole('button', { name: '등록 해제' }).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await screen.getByRole('button', { name: '취소' }).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('해제 중에는 두 버튼을 막는다', async () => {
    const screen = render(<RemoveCameraDialog label="안방" isPending onCancel={vi.fn()} onConfirm={vi.fn()} />);
    await expect.element(screen.getByRole('button', { name: '해제하는 중...' })).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });
});
