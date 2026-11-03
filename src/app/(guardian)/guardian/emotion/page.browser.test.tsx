// 정서 상태 체크 - 기능 준비 중이라 빈 화면 대신 준비 중 안내를 보인다. 실제 Chrome에서 돈다
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import GuardianEmotionPage from './page';

describe('정서 상태 체크 (Chrome)', () => {
  it('제목과 함께 준비 중 안내를 보인다(설명을 빈 칸에 한 번 더 되풀이하지 않는다)', async () => {
    await render(<GuardianEmotionPage />);

    await expect.element(page.getByRole('heading', { name: '정서 상태 체크', level: 1 })).toBeVisible();
    await expect.element(page.getByText('AI 기분 체크는 준비 중이에요')).toBeVisible();
    expect(page.getByText('피보호자의 정서 흐름과 최근 체크 결과를 확인합니다.').elements()).toHaveLength(1);
  });
});
