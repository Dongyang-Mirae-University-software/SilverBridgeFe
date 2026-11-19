// 공용 탭 키보드 동작 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Tabs, type TabItem } from './Tabs';

type Key = 'a' | 'b' | 'c' | 'd' | 'none';

function Harness({ initial = 'a', items }: { initial?: Key; items?: TabItem<Key>[] }) {
  const [value, setValue] = useState<Key>(initial);
  return (
    <>
      <button type="button">앞</button>
      <Tabs<Key>
        ariaLabel="시험 탭"
        value={value}
        onChange={setValue}
        items={
          items ?? [
            { value: 'a', label: '가' },
            { value: 'b', label: '나' },
            { value: 'c', label: '다' },
          ]
        }
      />
      <button type="button">뒤</button>
    </>
  );
}

const tab = (name: string) => [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(t => t.textContent === name)!;

describe('Tabs 키보드 (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('선택된 탭만 Tab 순서에 있다 - Tab 한 번에 탭 묶음을 지나간다', async () => {
    const screen = await render(<Harness initial="b" />);
    await expect.element(screen.getByRole('tab', { name: '나' })).toHaveAttribute('tabindex', '0');
    await expect.element(screen.getByRole('tab', { name: '가' })).toHaveAttribute('tabindex', '-1');

    (screen.getByRole('button', { name: '앞' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(tab('나'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement?.textContent).toBe('뒤');
  });

  it('←/→로 옮기며 바로 고르고, 끝에서는 처음으로 돈다', async () => {
    const screen = await render(<Harness />);
    tab('가').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tab('나'));
    await expect.element(screen.getByRole('tab', { name: '나' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(tab('가'));
    await expect.element(screen.getByRole('tab', { name: '가' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tab('다'));
    await expect.element(screen.getByRole('tab', { name: '다' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Home/End는 처음·끝 탭으로 간다', async () => {
    const screen = await render(<Harness initial="b" />);
    tab('나').focus();
    await userEvent.keyboard('{End}');
    await expect.element(screen.getByRole('tab', { name: '다' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(tab('가'));
    await expect.element(screen.getByRole('tab', { name: '가' })).toHaveAttribute('aria-selected', 'true');
  });

  it('비활성 탭은 건너뛴다', async () => {
    const screen = await render(
      <Harness
        items={[
          { value: 'a', label: '가' },
          { value: 'b', label: '나', disabled: true },
          { value: 'c', label: '다' },
        ]}
      />,
    );
    tab('가').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tab('다'));
    await expect.element(screen.getByRole('tab', { name: '나' })).toHaveAttribute('aria-selected', 'false');
  });

  it('어느 탭도 선택되지 않았으면(예: 이상감지 삭제된 카메라 보기) 첫 탭이 Tab 순서를 받는다', async () => {
    const screen = await render(<Harness initial="none" />);
    await expect.element(screen.getByRole('tab', { name: '가' })).toHaveAttribute('tabindex', '0');
    await expect.element(screen.getByRole('tab', { name: '나' })).toHaveAttribute('tabindex', '-1');
    (screen.getByRole('button', { name: '앞' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(tab('가'));
    // 포커스만으로는 고르지 않는다 - 화살표·누르기로 고른다
    await expect.element(screen.getByRole('tab', { name: '가' })).toHaveAttribute('aria-selected', 'false');
  });
});
