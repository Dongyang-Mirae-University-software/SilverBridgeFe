// 서버가 실패 응답 본문에 준 안내 문구(message). 없으면 null - 화면은 그때만 고정 문구를 쓴다(QA CONN-A38)
export function getServerMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}
