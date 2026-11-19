// 지역 필터 값 - BE가 region을 부분 일치로 거르므로 "서울" "경기" 같은 짧은 이름을 보낸다
export const REGION_OPTIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;
// 등록·수정 폼의 지역 = 시·도(위 짧은 이름) + 구·군. 저장 값은 예전처럼 "서울 강남구" 한 문자열이다.
// 예전에 풀어 쓴 이름("서울특별시 강남구")은 짧은 이름으로 읽어 선택칸에 보인다(건드리지 않으면 원래 값 그대로 둔다)
const REGION_ALIASES: Record<string, string> = { 서울특별시: '서울', 서울시: '서울', 부산광역시: '부산', 부산시: '부산', 대구광역시: '대구', 대구시: '대구', 인천광역시: '인천', 인천시: '인천', 광주광역시: '광주', 광주시: '광주', 대전광역시: '대전', 대전시: '대전', 울산광역시: '울산', 울산시: '울산', 세종특별자치시: '세종', 세종시: '세종', 경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주도: '제주', 제주특별자치도: '제주' };
// 입력 중인 띄어쓰기("성남시 ")를 잃지 않도록 여기서는 앞뒤 공백을 자르지 않는다 - 저장할 때 cleanForm이 trim한다
export function splitRegion(value: string) {
  const match = value.trimStart().match(/^(\S+)(?:\s([\s\S]*))?$/);
  const first = match?.[1] ?? '';
  const province = (REGION_OPTIONS as readonly string[]).includes(first) ? first : REGION_ALIASES[first];
  return province ? { province, detail: match?.[2] ?? '' } : { province: '', detail: value.trim() ? value : '' };
}
export function joinRegion(province: string, detail: string) { return province ? (detail ? `${province} ${detail}` : province) : detail; }
