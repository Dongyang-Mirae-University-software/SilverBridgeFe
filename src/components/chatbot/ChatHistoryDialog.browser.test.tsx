import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { ChatLogItem } from '@/service/interface/chat';

import ChatHistoryDialog from './ChatHistoryDialog';

// 피보호자 "내 상담 기록" 카드가 목록 안에서 줄어들어 두 줄 제목이 잘리던 문제(2026-11-17 사용자 폰 실측).
// 카드가 목록을 넘칠 만큼 많아야 flex 축소가 일어나므로 8개를 둔다.
const TITLES = [
  '당뇨약 먹는데 술 한 잔 정도는 마셔도 돼요',
  '요즘 너무 외롭고 힘들어서 죽고 싶다는 생각이 들어요',
  '아침에 가슴이 답답하고 식은땀이 나',
  '무릎',
  '혈압약을 아침에 깜빡하고 안 먹었는데 지금 먹어도 되나요 저녁이 다 됐어요',
  '잠이 안 와요',
  '병원 예약하고 싶어요 내일 오전에 정형외과로요 가까운 곳이면 좋겠어요',
  '어지러워요',
];

function logs(): ChatLogItem[] {
  return TITLES.map((message, index) => ({
    id: String(index + 1),
    sessionId: `s${index}`,
    message,
    reply: '답',
    createdAt: `2026-11-1${index % 7}T0${index}:00:00Z`,
  }));
}

const WIDTHS = [320, 375, 390, 768, 800];
const SCALES = ['1', '1.3', '1.65'];

afterEach(async () => {
  await page.viewport(375, 812);
});

describe('ChatHistoryDialog 피보호자 목록 카드', () => {
  for (const width of WIDTHS) {
    for (const scale of SCALES) {
      it(`${width}px × 글자 ${scale}배: 카드가 내용보다 작아지지 않고 제목은 두 줄까지 보인다`, async () => {
        await page.viewport(width, 812);
        const screen = await render(
          <div style={{ ['--ward-font-scale' as string]: scale } as React.CSSProperties}>
            <ChatHistoryDialog variant="ward" logs={logs()} loading={false} error={null} onClose={() => {}} />
          </div>,
        );
        await expect.element(screen.getByText('어지러워요')).toBeInTheDocument();

        const cards = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].filter(button =>
          button.querySelector('strong'),
        );
        expect(cards).toHaveLength(TITLES.length);
        const rows = cards.map(card => {
          const title = card.querySelector('strong')!;
          const more = [...card.querySelectorAll('span')].find(span => span.textContent?.startsWith('보기'))!;
          const box = card.getBoundingClientRect();
          const titleBox = title.getBoundingClientRect();
          const moreBox = more.getBoundingClientRect();
          const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
          return {
            text: title.textContent,
            cardH: Math.round(box.height),
            // 보기 가운데와 제목 첫 줄 가운데의 차이
            moreOffset: Math.abs((moreBox.top + moreBox.bottom) / 2 - (titleBox.top + lineHeight / 2)),
            contentH: card.scrollHeight,
            clientH: card.clientHeight,
            titleBottomOver: Math.round(titleBox.bottom - (box.bottom - 1.5)),
            titleLines: Math.round(titleBox.height / lineHeight),
          };
        });
        for (const row of rows) {
          // 카드 테두리 안에 내용이 다 들어간다(넘친 높이 0)
          expect(row.contentH, `${row.text} 카드 내용 넘침`).toBeLessThanOrEqual(row.clientH);
          // 제목 아래 끝이 카드 아래 테두리 안쪽
          expect(row.titleBottomOver, `${row.text} 제목이 카드 밖으로`).toBeLessThanOrEqual(0);
          expect(row.titleLines).toBeLessThanOrEqual(2);
        }
        // 제목이 한 줄이든 두 줄이든 카드 높이가 같다(제목 칸 두 줄 확보)
        expect(new Set(rows.map(row => row.cardH)).size).toBe(1);
        // 휴대폰 배치: 보기는 제목 첫 줄에 맞춘다(제목 줄 수와 무관)
        if (width <= 760) {
          for (const row of rows) expect(row.moreOffset, `${row.text} 보기 위치`).toBeLessThanOrEqual(2);
        }
      });
    }
  }

  // #275 점검 M-1·L-2·L-3: 긴 날짜 + 앱 최대 배율(28/17) + 진한 글자. 날짜 칸이 단어 중간("12월 31 / 일")에서 끊기지 않는다
  for (const width of [320, 375, 761, 900]) {
    it(`${width}px × 최대 배율·진한 글자: 긴 날짜도 단어 단위로 두 줄 이하, 잘림 없음`, async () => {
      await page.viewport(width, 812);
      const long: ChatLogItem[] = [
        { id: '1', sessionId: 'a', message: TITLES[4], reply: '답', createdAt: '2026-12-31T03:00:00Z' },
        { id: '2', sessionId: 'b', message: TITLES[3], reply: '답', createdAt: '2026-11-10T01:00:00Z' },
      ];
      const screen = await render(
        <div style={{ ['--ward-font-scale' as string]: '1.647', ['--ward-weight-boost' as string]: '200' } as React.CSSProperties}>
          <ChatHistoryDialog variant="ward" logs={long} loading={false} error={null} onClose={() => {}} />
        </div>,
      );
      await expect.element(screen.getByText('무릎')).toBeInTheDocument();

      const card = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button =>
        button.textContent?.includes('12월 31일'),
      )!;
      const time = card.querySelector('time')!;
      const lineHeight = parseFloat(getComputedStyle(time).lineHeight);
      expect(Math.round(time.getBoundingClientRect().height / lineHeight)).toBeLessThanOrEqual(2);
      expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight);
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);

      // "12월 31일"이 한 줄 안에 있다(줄마다 사각형이 하나씩 나오므로 top 이 모두 같아야 한다)
      const text = time.firstChild as Text;
      const range = document.createRange();
      const start = text.data.indexOf('12월 31일');
      range.setStart(text, start);
      range.setEnd(text, start + '12월 31일'.length);
      const tops = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
      expect(tops.size).toBe(1);
    });
  }
});
