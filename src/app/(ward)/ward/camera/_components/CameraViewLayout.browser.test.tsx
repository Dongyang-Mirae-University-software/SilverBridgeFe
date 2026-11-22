// 송출 중 '카메라 화면 보기'(wideView) 영상 상자 - 낮은 화면에서도 창 폭을 다 채우는지. 실제 Chrome에서 돈다
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import styles from './CameraRegisterModal.module.css';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('카메라 화면 보기 영상 상자 (Chrome, 2026-11-22)', () => {
  it.each([
    [1405, 817],
    [1280, 720],
    [1920, 1080],
  ])('%ix%i: 높이 상한이 걸려도 상자는 창 폭을 다 채운다(닫기 버튼 위 오른쪽 공백 없음)', async (width, height) => {
    await page.viewport(width, height);
    await render(
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.wideView}`} data-testid="modal">
          <div style={{ padding: '0 28px' }} data-testid="body">
            <div className={styles.previewBox} data-testid="preview">
              <canvas className={styles.canvas} width={1280} height={720} />
            </div>
          </div>
        </div>
      </div>,
    );

    const body = document.querySelector('[data-testid="body"]')!;
    const preview = document.querySelector('[data-testid="preview"]')!.getBoundingClientRect();
    const inner = body.getBoundingClientRect().width - 56;

    expect(Math.abs(preview.width - inner)).toBeLessThanOrEqual(1);
    // 높이 상한은 그대로 지킨다(창이 화면 밖으로 넘치지 않게)
    expect(preview.height).toBeLessThanOrEqual(Math.max(260, height - 300) + 1);
  });
});
