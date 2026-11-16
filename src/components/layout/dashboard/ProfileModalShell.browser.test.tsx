// 내 프로필 창 틀 - 대화상자 키보드 동작(QA CHAT-N46). 실제 Chrome에서 돈다
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { ProfileModalShell } from './ProfileModalShell';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>프로필 열기</button>
      {open && (
        <ProfileModalShell role="GUARDIAN" onClose={() => setOpen(false)} footer={<button type="button">로그아웃</button>}>
          <button type="button">정보 수정</button>
        </ProfileModalShell>
      )}
    </>
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('내 프로필 창 키보드 (Chrome)', () => {
  it('열면 창 안으로 포커스가 가고, Tab은 창 안에서만 돌고, Esc로 닫으면 연 버튼으로 돌아간다', async () => {
    await render(<Harness />);
    const opener = page.getByRole('button', { name: '프로필 열기' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: '내 프로필' });
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().contains(document.activeElement)).toBe(true);

    for (let i = 0; i < 4; i += 1) {
      await userEvent.keyboard('{Tab}');
      expect(dialog.element().contains(document.activeElement)).toBe(true);
    }

    await userEvent.keyboard('{Escape}');
    expect(page.getByRole('dialog').query()).toBeNull();
    expect(document.activeElement).toBe(opener.element());
  });
});
