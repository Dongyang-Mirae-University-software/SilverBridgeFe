import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { fitWithin, getOcrErrorMessage, OcrImageError } from './ocrImage';

function axiosError(status: number | undefined, message = '', code?: string) {
  const error = new AxiosError(message, status ? undefined : 'ECONNABORTED');
  if (status) {
    error.response = { status, data: { code }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  }
  return error;
}

describe('fitWithin', () => {
  it('긴 변을 1568px로 줄이고 비율을 지킨다', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1568, height: 1176 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1176, height: 1568 });
  });

  it('작은 사진은 키우지 않는다', () => {
    expect(fitWithin(1280, 720)).toEqual({ width: 1280, height: 720 });
  });
});

describe('getOcrErrorMessage', () => {
  it('상태 코드별 안내', () => {
    expect(getOcrErrorMessage(axiosError(413))).toBe('사진이 너무 커요. 다시 찍어 주세요');
    expect(getOcrErrorMessage(axiosError(429, '', 'TOO_MANY_REQUESTS'))).toBe('잠시 후 다시 시도해 주세요');
    expect(getOcrErrorMessage(axiosError(400, '', 'MEDICATION_OCR_INVALID_IMAGE'))).toBe('사진을 읽을 수 없어요. 다시 찍어 주세요');
    expect(getOcrErrorMessage(axiosError(503))).toBe('지금은 인식할 수 없어요. 직접 써 주세요');
    expect(getOcrErrorMessage(axiosError(504))).toBe('지금은 인식할 수 없어요. 직접 써 주세요');
    expect(getOcrErrorMessage(axiosError(undefined))).toBe('지금은 인식할 수 없어요. 직접 써 주세요');
    expect(getOcrErrorMessage(new OcrImageError('x'))).toBe('사진을 열 수 없어요. 다시 찍어 주세요');
  });

  it('앞서 보낸 사진을 아직 읽는 중(1인 동시 1건)이면 그렇게 알린다 (점검 M-2)', () => {
    expect(getOcrErrorMessage(axiosError(429, '', 'MEDICATION_OCR_LIMIT_EXCEEDED'))).toBe(
      '앞서 보낸 사진을 아직 읽고 있어요. 잠시 후 다시 찍어 주세요',
    );
  });

  it('403은 서버 문구를 그대로', () => {
    expect(getOcrErrorMessage(axiosError(403, '연결된 피보호자의 복약 정보만 관리할 수 있습니다.'))).toBe(
      '연결된 피보호자의 복약 정보만 관리할 수 있습니다.',
    );
  });
});
