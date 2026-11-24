// 보호자 화면 상단 어르신 탭의 호칭 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 이름 옆에는 보호자가 부르는 호칭(wardRelation, 예: 엄마)을 둔다. relation(아들·딸)을 두면
// "김영희 딸"이 "내 딸"로 거꾸로 읽힌다(2026-11-24). 비었거나 "기타"면 "어르신".

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { type WardOption, WardSelectorTabs } from './WardSelectorTabs';

function callNames(container: HTMLElement) {
  return [...container.querySelectorAll('[role="tab"] em')].map(em => em.textContent);
}

async function renderTabs(wards: WardOption[]) {
  const screen = await render(<WardSelectorTabs wards={wards} selectedWardId={wards[0]?.wardId} onSelect={vi.fn()} />);
  return screen.container;
}

describe('WardSelectorTabs 어르신 호칭', () => {
  it('고른 호칭을 이름 옆에 보여 준다', async () => {
    const container = await renderTabs([{ wardId: 'w1', wardName: '김영희', wardRelation: '엄마' }]);

    expect(callNames(container)).toEqual(['엄마']);
    expect(container.textContent).not.toContain('어르신');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['빈 글자', ''],
    ['공백', '  '],
    ['기타', '기타'],
  ])('호칭이 %s이면 "어르신"으로 보인다', async (_label, wardRelation) => {
    const container = await renderTabs([{ wardId: 'w1', wardName: '김영희', wardRelation }]);

    expect(callNames(container)).toEqual(['어르신']);
  });

  it('어르신마다 자기 호칭을 보여 준다', async () => {
    const container = await renderTabs([
      { wardId: 'w1', wardName: '김영희', wardRelation: '할머니' },
      { wardId: 'w2', wardName: '박철수', wardRelation: null },
    ]);

    expect(callNames(container)).toEqual(['할머니', '어르신']);
  });
});
