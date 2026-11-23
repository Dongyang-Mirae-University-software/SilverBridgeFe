// 챗봇 병원 검색 결과를 휴대폰에서도 한눈에 보이게 줄이는 규칙(2026-11-23 사용자 결정 A안)
// - 진료과: AI는 병원마다 진료과 전체를 "내과 / 외과 / …"로 준다. 검색은 고른 진료과로 걸러 오므로
//   모든 병원에 공통인 진료과가 곧 고른 진료과다 - 그 하나만 보여 준다. 공통이 없으면 개수만.
// - 주소: "서울특별시 구로구 경인로 445 2층" → "구로구 경인로" (구·군 + 다음 낱말). 못 찾으면 앞 두 낱말.

export const HOSPITAL_PREVIEW_COUNT = 3;

const SEPARATOR = /\s*[/,·]\s*/;

export function splitDepartments(department?: string | null): string[] {
  if (!department) return [];
  return department
    .split(SEPARATOR)
    .map(part => part.trim())
    .filter(part => part && part !== '—' && part !== '-');
}

/** 모든 병원에 공통으로 있는 첫 진료과(첫 병원의 순서 기준). 하나라도 진료과를 모르면 null. */
export function commonDepartment(departments: (string | null | undefined)[]): string | null {
  const lists = departments.map(splitDepartments);
  if (lists.length === 0 || lists.some(list => list.length === 0)) return null;
  const [first, ...rest] = lists;
  return first.find(dept => rest.every(list => list.includes(dept))) ?? null;
}

export function shortAddress(address?: string | null): string {
  const words = (address ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const district = words.findIndex(word => /[구군]$/.test(word));
  if (district >= 0) return words.slice(district, district + 2).join(' ');
  return words.slice(0, 2).join(' ');
}
