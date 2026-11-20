// 병원 가는 날 카드 - 피보호자 병원 화면·보호자 예약 현황·챗봇 예약 완료가 함께 쓴다.
// 조작 자리(action)는 넘긴 화면에만 생기고, 좁은 칸에서 "·" / "진료과", "오전" / "9시"가 갈라지지 않는다(#301 점검 M-1·L-1·L-3).
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { addDays, kstToday } from '@/utils/reservation/reservationView';
import { VisitDayCard } from './VisitDayCard';

const TODAY = kstToday();

// 글자 하나가 놓인 줄의 위치(top) - 두 글자가 같은 줄인지 비교한다
function charTop(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.setEnd(node, offset + 1);
  return range.getBoundingClientRect().top;
}

function textNodes(el: Element) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) if ((walker.currentNode as Text).data) nodes.push(walker.currentNode as Text);
  return nodes;
}

// "· 진료과" - 가운뎃점과 진료과 첫 글자가 같은 줄인가
function dotStaysWithDept(span: Element) {
  const nodes = textNodes(span);
  return Math.abs(charTop(nodes[0], 0) - charTop(nodes[nodes.length - 1], 0)) < 2;
}

function renderCard(props: { width: number; scale?: string; action?: boolean; time?: string }) {
  return render(
    <div style={{ width: props.width, ['--ward-font-scale' as string]: props.scale ?? '1' }}>
      <VisitDayCard
        hospitalName="강남종합병원"
        department="소아청소년과"
        date={addDays(TODAY, 7)}
        time={props.time ?? '11:30'}
        today={TODAY}
        address="서울특별시 강남구 강남대로 400"
        action={props.action ? <button type="button">예약 취소</button> : undefined}
      />
    </div>,
  );
}

describe('VisitDayCard', () => {
  afterEach(async () => {
    await page.viewport(375, 812);
  });

  it('action을 넘기지 않으면(피보호자·챗봇) 조작 자리를 두지 않는다', async () => {
    const screen = await renderCard({ width: 360 });
    const card = screen.getByRole('region', { name: '다음 진료' });
    await expect.element(card).toBeVisible();
    expect(card.getByRole('button').elements()).toHaveLength(0);
    expect(card.element().querySelector('[class*="action"]')).toBeNull();
  });

  it('action을 넘기면(보호자) 카드 안에 보인다', async () => {
    const screen = await renderCard({ width: 360, action: true });
    await expect
      .element(screen.getByRole('region', { name: '다음 진료' }).getByRole('button', { name: '예약 취소' }))
      .toBeVisible();
  });

  // 앞 테스트가 그린 카드가 남아 있을 수 있어 이번 렌더 안에서만 찾는다
  for (const scale of ['1', '1.647']) {
    it(`휴대폰 폭에서 진료과가 다음 줄로 가도 가운뎃점이 따라간다(글씨 배율 ${scale})`, async () => {
      await page.viewport(360, 800);
      const { container } = await renderCard({ width: 360, scale });
      const dept = Array.from(container.querySelectorAll('section span')).find(span => span.textContent?.startsWith('·'));
      expect(dept).toBeDefined();
      expect(dotStaysWithDept(dept as Element)).toBe(true);
    });
  }

  it('큰 시각은 "오전"과 "9시"가 한 줄에 있다', async () => {
    await page.viewport(360, 800);
    const { container } = await renderCard({ width: 360, scale: '1.647', time: '09:00' });
    const time = Array.from(container.querySelectorAll('section div')).find(div => /^오[전후]/.test(div.textContent ?? ''));
    const [node] = textNodes(time as Element);
    expect(node.data).toBe('오전 9시');
    expect(Math.abs(charTop(node, 0) - charTop(node, 3))).toBeLessThan(2);
  });
});
