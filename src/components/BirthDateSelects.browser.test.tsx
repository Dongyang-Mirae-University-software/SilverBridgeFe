// 생년월일 선택 칸 - 바깥 값과 칸 상태를 맞추는 규칙을 실제 Chrome에서 확인한다(`npm run test:browser`)

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from '@vitest/browser/context';

import { BirthDateSelects } from './BirthDateSelects';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <BirthDateSelects value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue('1950-07-20')}>
        바깥에서 채우기
      </button>
      <button type="button" onClick={() => setValue('')}>
        바깥에서 비우기
      </button>
    </>
  );
}

function selects() {
  return Array.from(document.querySelectorAll('select'));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('BirthDateSelects (Chrome)', () => {
  it('처음 값을 세 칸에 나눠 보이고, 바깥 값이 바뀌면 칸도 따라간다', async () => {
    const screen = render(<Harness initial="1948-03-15" />);
    expect(selects().map(select => select.value)).toEqual(['1948', '03', '15']);

    await screen.getByRole('button', { name: '바깥에서 채우기' }).click();
    await expect.poll(() => selects().map(select => select.value)).toEqual(['1950', '07', '20']);
  });

  it('세 칸을 다 고르기 전에는 바깥 값이 비어 있어도 고른 칸을 지우지 않는다', async () => {
    const screen = render(<Harness />);
    const [year, month] = selects();

    await userEvent.selectOptions(year!, '1948');
    await userEvent.selectOptions(month!, '03');
    expect(screen.getByTestId('value').element().textContent).toBe('');
    expect(selects().map(select => select.value)).toEqual(['1948', '03', '']);
  });

  it('세 칸을 다 고르면 값을 올리고, 바깥에서 비우면 칸도 비운다', async () => {
    const screen = render(<Harness />);
    const [year, month, day] = selects();

    await userEvent.selectOptions(year!, '1948');
    await userEvent.selectOptions(month!, '03');
    await userEvent.selectOptions(day!, '15');
    await expect.element(screen.getByTestId('value')).toHaveTextContent('1948-03-15');

    await screen.getByRole('button', { name: '바깥에서 비우기' }).click();
    await expect.poll(() => selects().map(select => select.value)).toEqual(['', '', '']);
  });
});
