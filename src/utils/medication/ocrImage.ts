// 약 봉투 사진 업로드 전처리(브라우저 전용)
// - 휴대폰 기본 카메라 사진(고해상도·자동초점)을 받아 방향을 반영하고 긴 변 1568px 이하 JPEG로 줄인다
//   (측정: 이 크기에서 인식이 가장 안정적. 1024px까지 줄이면 정확도가 떨어진다 - BE docs result-medication-ocr-measure)
// - 사진은 메모리에서만 다루고 어디에도 저장하지 않는다

import axios from 'axios';

export const OCR_MAX_LONG_EDGE = 1568;
const OCR_JPEG_QUALITY = 0.88;

// 긴 변이 maxLongEdge를 넘을 때만 비율대로 줄인다(확대하지 않음)
export function fitWithin(width: number, height: number, maxLongEdge = OCR_MAX_LONG_EDGE) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

type DrawableImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeImage(file: File): Promise<DrawableImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // createImageBitmap 옵션을 지원하지 않는 브라우저 - <img>는 EXIF 방향을 기본으로 반영한다
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export class OcrImageError extends Error {}

export async function prepareOcrImage(file: File): Promise<Blob> {
  const image = await decodeImage(file).catch(() => {
    throw new OcrImageError('사진을 열 수 없습니다.');
  });

  try {
    const size = fitWithin(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new OcrImageError('사진을 처리할 수 없습니다.');
    context.drawImage(image.source, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', OCR_JPEG_QUALITY));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new OcrImageError('사진을 처리할 수 없습니다.');
    return blob;
  } finally {
    image.release();
  }
}

export const OCR_NOT_FOUND_MESSAGE = '약 봉투를 찾지 못했어요. 글자가 잘 보이게 다시 찍어 주세요';
const OCR_UNAVAILABLE_MESSAGE = '지금은 인식할 수 없어요. 직접 써 주세요';

// 인식 실패 → 화면 안내 문구. 403(연결되지 않은 피보호자)은 서버 문구를 그대로 쓴다
export function getOcrErrorMessage(error: unknown) {
  if (error instanceof OcrImageError) return '사진을 열 수 없어요. 다시 찍어 주세요';
  if (!axios.isAxiosError(error)) return OCR_UNAVAILABLE_MESSAGE;

  const status = error.response?.status;
  if (status === 403) return error.message || '연결된 피보호자의 약만 등록할 수 있어요';
  if (status === 413) return '사진이 너무 커요. 다시 찍어 주세요';
  if (status === 400) return '사진을 읽을 수 없어요. 다시 찍어 주세요';
  if (status === 429) return '잠시 후 다시 시도해 주세요';
  return OCR_UNAVAILABLE_MESSAGE; // 503·504·시간 초과(45초)·네트워크 오류
}
