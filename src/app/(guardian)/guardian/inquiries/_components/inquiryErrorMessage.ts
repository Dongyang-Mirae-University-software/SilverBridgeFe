import { ApiErrorShape } from '@/lib/api/errorHandler';

// 문의 화면 오류 문구 - 상태 코드별로 할 일을 알려 준다(서버 문구 파싱 금지)
const STATUS_MESSAGES: Record<number, string> = {
  400: '입력한 내용을 다시 확인해 주세요.',
  401: '로그인이 필요해요. 다시 로그인해 주세요.',
  403: '본인이 남긴 문의만 볼 수 있어요.',
  404: '문의를 찾을 수 없어요.',
  429: '문의를 너무 자주 보냈어요. 잠시 후 다시 보내 주세요.',
};

export function inquiryErrorMessage(error: unknown, fallback: string) {
  const status = (error as Partial<ApiErrorShape> | null)?.status;
  return (status != null && STATUS_MESSAGES[status]) || fallback;
}
