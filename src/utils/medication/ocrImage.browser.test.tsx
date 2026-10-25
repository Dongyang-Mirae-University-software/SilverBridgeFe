// 사진 전처리 - 실제 Chrome의 createImageBitmap·canvas로 확인한다(`npm run test:browser`)

import { describe, expect, it } from 'vitest';

import { OCR_MAX_LONG_EDGE, OcrImageError, prepareOcrImage } from './ocrImage';

async function makeFile(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void, type = 'image/png') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), type));
  return new File([blob], 'photo', { type });
}

async function decode(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  return { width: bitmap.width, height: bitmap.height, pixel: (x: number, y: number) => context.getImageData(x, y, 1, 1).data };
}

describe('prepareOcrImage (Chrome)', () => {
  it('큰 사진은 긴 변 1568px JPEG로 줄인다(비율 유지)', async () => {
    const file = await makeFile(4032, 3024, context => {
      context.fillStyle = '#336';
      context.fillRect(0, 0, 4032, 3024);
    });
    const blob = await prepareOcrImage(file);
    expect(blob.type).toBe('image/jpeg');
    const image = await decode(blob);
    expect(image.width).toBe(OCR_MAX_LONG_EDGE);
    expect(image.height).toBe(1176);
  });

  it('작은 사진은 키우지 않는다', async () => {
    const file = await makeFile(800, 600, context => context.fillRect(0, 0, 800, 600));
    const image = await decode(await prepareOcrImage(file));
    expect([image.width, image.height]).toEqual([800, 600]);
  });

  it('투명 배경은 흰색이 된다(검게 바뀌지 않음, 점검 L-3)', async () => {
    const file = await makeFile(200, 200, context => {
      context.fillStyle = '#000';
      context.fillRect(150, 150, 50, 50); // 오른쪽 아래만 칠하고 나머지는 투명
    });
    const image = await decode(await prepareOcrImage(file));
    const [r, g, b] = image.pixel(10, 10);
    expect(Math.min(r, g, b)).toBeGreaterThan(240);
  });

  it('사진이 아니면 OcrImageError', async () => {
    const file = new File(['not an image'], 'note.txt', { type: 'text/plain' });
    await expect(prepareOcrImage(file)).rejects.toBeInstanceOf(OcrImageError);
  });
});
