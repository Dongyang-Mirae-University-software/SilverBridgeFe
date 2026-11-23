import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import ChatToolCard from './ChatToolCard';

const HOSPITALS = [
  { id: 1, name: '튼튼정형외과의원', department: '정형외과 / 내과 / 재활의학과 / 마취통증의학과 / 영상의학과', address: '서울특별시 구로구 경인로 445 2층' },
  { id: 2, name: '구로연세병원', department: '내과 / 외과 / 정형외과 / 신경과 / 피부과 / 비뇨의학과', address: '서울특별시 구로구 구로중앙로 12' },
  { id: 3, name: '새봄의원', department: '가정의학과 / 정형외과', address: '서울특별시 구로구 디지털로 300' },
  { id: 4, name: '한빛병원', department: '정형외과 / 신경외과', address: '서울특별시 금천구 시흥대로 1' },
  { id: 5, name: '푸른의원', department: '정형외과', address: '서울특별시 영등포구 경인로 2' },
];

function renderCard(data: unknown, variant: 'guardian' | 'ward' = 'guardian') {
  const onUiSelect = vi.fn();
  render(<ChatToolCard tool="search_hospital" data={data} onUiSelect={onUiSelect} onShowList={vi.fn()} variant={variant} />);
  return onUiSelect;
}

describe('병원 검색 결과 줄이기 (Chrome, 2026-11-23 A안)', () => {
  it('고른 진료과 하나와 짧은 주소만, 처음엔 3곳 - [병원 더 보기]로 나머지를 편다', async () => {
    const onUiSelect = renderCard(HOSPITALS);

    await expect.element(page.getByText('정형외과 병원 5곳')).toBeVisible();
    expect(document.body.textContent).not.toContain('재활의학과');
    expect(document.body.textContent).not.toContain('445');
    await expect.element(page.getByText('구로구 경인로')).toBeVisible();
    expect(page.getByRole('button', { name: /예약하기$/ }).elements()).toHaveLength(3);
    expect(document.body.textContent).not.toContain('한빛병원');

    await userEvent.click(page.getByRole('button', { name: '병원 더 보기 (2곳)' }));
    expect(page.getByRole('button', { name: /예약하기$/ }).elements()).toHaveLength(5);
    expect(page.getByRole('button', { name: /병원 더 보기/ }).elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: '한빛병원 예약하기' }));
    expect(onUiSelect).toHaveBeenCalledWith('hospital_confirm', '한빛병원', '한빛병원 예약하기');
  });

  it('공통 진료과가 없으면 병원마다 진료과 개수만 보인다', async () => {
    renderCard([
      { id: 1, name: 'A의원', department: '내과 / 가정의학과', address: '서울특별시 구로구 경인로 1' },
      { id: 2, name: 'B의원', department: '외과', address: '서울특별시 구로구 경인로 2' },
    ]);

    await expect.element(page.getByText('병원 2곳', { exact: true })).toBeVisible();
    await expect.element(page.getByText('진료과 2개')).toBeVisible();
    await expect.element(page.getByText('진료과 1개')).toBeVisible();
    expect(page.getByRole('button', { name: /병원 더 보기/ }).elements()).toHaveLength(0);
  });

  it('폰(375px) 어르신 화면에서도 카드가 가로로 넘치지 않는다', async () => {
    await page.viewport(375, 812);
    renderCard(HOSPITALS, 'ward');

    await expect.element(page.getByText('정형외과 병원 5곳')).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
  });
});
