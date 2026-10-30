// 로그인 실패 응답을 화면 문구로 바꾼다
export function getLoginErrorMessage(error: unknown) {
  const status = (error as { response?: { status?: number } }).response?.status;

  switch (status) {
    case 400:
      return '입력값을 확인해주세요.';
    case 401:
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 403:
      return '비활성화된 계정입니다. 관리자에게 문의해주세요.';
    // 잠금 시간은 서버 설정을 따르므로 서버 문구를 우선한다(IP 속도 제한 429도 같은 경로) - 없을 때만 기본 문구
    case 429:
      return (
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        '비밀번호를 5회 이상 틀려 10분 동안 로그인이 제한됩니다.'
      );
    case 500:
      return '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.';
    default:
      return (error as Error).message || '로그인에 실패했습니다.';
  }
}
