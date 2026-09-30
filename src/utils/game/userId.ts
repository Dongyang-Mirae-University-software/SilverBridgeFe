// ponytail: AI 서버 games API가 userId를 int로만 받아 UUID를 31bit 해시로 접는다.
// 피보호자 화면(본인)과 보호자 화면(피보호자 조회)이 같은 값을 써야 하므로 여기서만 계산한다.
// AI 서버 user_id 컬럼을 문자열로 바꾸면 이 함수를 지우고 id를 그대로 넘길 것.
export function toGameUserId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
}
