// 히트맵 처음 스크롤 위치 - 좁은 화면에서 가장 최근 주(오른쪽 끝)가 먼저 보인다(FE #293 점검 R-1). 실제 Chrome에서 돈다
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { ActivityHeatmap } from './ActivityHeatmap';

describe('ActivityHeatmap', () => {
  it('좁은 폭에서는 처음부터 오른쪽 끝(최근 주)으로 스크롤돼 있다', async () => {
    await render(
      <div style={{ width: 200 }}>
        <ActivityHeatmap activity={[]} />
      </div>,
    );
    const el = page.getByTestId('activity-heatmap-scroll').element() as HTMLElement;

    await expect.poll(() => el.scrollWidth - el.clientWidth).toBeGreaterThan(0);
    await expect.poll(() => el.scrollWidth - el.clientWidth - el.scrollLeft).toBeLessThanOrEqual(1);
  });
});
