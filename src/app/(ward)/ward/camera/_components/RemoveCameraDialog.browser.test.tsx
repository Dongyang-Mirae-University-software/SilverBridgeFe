// 카메라 등록 해제 확인창 - 제목만 보여 주고 버튼 동작은 그대로. 실제 Chrome에서 돈다(`npm run test:browser`)

import { page, userEvent } from '@vitest/browser/context';
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

  it('열리면 취소에 포커스가 가고, Esc는 취소와 같다', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const screen = render(<RemoveCameraDialog label="안방" isPending={false} onCancel={onCancel} onConfirm={onConfirm} />);

    await expect.element(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('해제 중에는 Esc로 닫히지 않는다', async () => {
    const onCancel = vi.fn();
    render(<RemoveCameraDialog label="안방" isPending onCancel={onCancel} onConfirm={vi.fn()} />);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Tab·Shift+Tab은 두 버튼 사이에서만 돈다', async () => {
    const outside = document.createElement('button');
    outside.textContent = '뒤 화면 버튼';
    document.body.appendChild(outside);
    const screen = render(<RemoveCameraDialog label="안방" isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: '등록 해제' });

    await expect.element(cancel).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    await expect.element(confirm).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    await expect.element(cancel).toHaveFocus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await expect.element(confirm).toHaveFocus();
  });

  it('띄어쓰기 없는 긴 방 이름도 375px에서 창 밖으로 넘치지 않는다', async () => {
    await page.viewport(375, 812);
    // 앱의 globals.css와 같은 상자 크기 규칙(테스트에는 전역 CSS가 없다)
    const boxSizing = document.createElement('style');
    boxSizing.textContent = '*, *::before, *::after { box-sizing: border-box; }';
    document.head.appendChild(boxSizing);
    const label = 'LivingRoomCameraNumberOne12345';
    const screen = render(<RemoveCameraDialog label={label} isPending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    const title = screen.getByRole('heading', { name: `${label} 카메라 등록을 해제할까요?` }).element();
    const dialog = screen.getByRole('alertdialog').element();
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(375);
    boxSizing.remove();
  });
});
