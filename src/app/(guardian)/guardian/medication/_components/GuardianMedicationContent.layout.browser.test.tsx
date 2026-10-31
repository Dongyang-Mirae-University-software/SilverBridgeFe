// 보호자 복약 화면 줄 배치 - 피보호자가 많아 탭이 화면보다 넓어도 [약 추가]·카드가 화면 안에 있어야 한다.
// 실제 Chrome에서 돈다(`npm run test:browser`). 데이터 조회 없이 같은 CSS 모듈·탭 컴포넌트로 줄 구조만 그린다.

import { page } from '@vitest/browser/context';
import classNames from 'classnames/bind';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import PageLayout from '@/components/layout/PageLayout';
import styles from './GuardianMedicationContent.module.css';

const cx = classNames.bind(styles);

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-test-box-sizing]').forEach(el => el.remove());
});

const WARDS = ['남궁', '김철수', '알렉산더', '이영희', '박민수'].map((wardName, index) => ({
  wardId: `ward-${index}`,
  wardName,
  relation: index === 1 ? '손자녀' : undefined,
}));

describe('보호자 복약 화면 줄 배치', () => {
  it.each([375, 768])('%ipx: 탭이 넘쳐도 탭 안에서만 스크롤되고 [약 추가]·카드는 화면 안에 있다', async width => {
    await page.viewport(width, 812);
    // 앱의 globals.css와 같은 상자 크기 규칙(테스트에는 전역 CSS가 없다)
    const boxSizing = document.createElement('style');
    boxSizing.dataset.testBoxSizing = '';
    boxSizing.textContent = '*, *::before, *::after { box-sizing: border-box; } body { margin: 0; }';
    document.head.appendChild(boxSizing);

    const screen = render(
      // GuardianLayout의 main처럼 flex 줄 안에 둔다(.main > * { flex: 1 })
      <main style={{ display: 'flex', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <PageLayout title="복약 관리">
            <section className={cx('page')}>
              <div className={cx('wardRow')}>
                <div className={cx('wardTabs')}>
                  <WardSelectorTabs wards={WARDS} selectedWardId="ward-0" onSelect={vi.fn()} />
                </div>
                <button type="button" className={cx('addButton')}>
                  약 추가
                </button>
              </div>
              <div data-testid="card">카드</div>
            </section>
          </PageLayout>
        </div>
      </main>,
    );

    const add = screen.getByRole('button', { name: '약 추가' }).element();
    const card = screen.getByTestId('card').element();
    expect(add.getBoundingClientRect().right).toBeLessThanOrEqual(width);
    expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(width);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });
});
