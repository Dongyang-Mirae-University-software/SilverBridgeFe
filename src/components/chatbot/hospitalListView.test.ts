import { describe, expect, it } from 'vitest';

import { commonDepartment, shortAddress, splitDepartments } from './hospitalListView';

describe('병원 목록 줄이기 (2026-11-23 A안)', () => {
  it('진료과 문자열을 " / "·쉼표로 나누고 빈 값·"—"는 뺀다', () => {
    expect(splitDepartments('정형외과 / 내과 / 재활의학과')).toEqual(['정형외과', '내과', '재활의학과']);
    expect(splitDepartments('내과, 외과')).toEqual(['내과', '외과']);
    expect(splitDepartments('—')).toEqual([]);
    expect(splitDepartments(undefined)).toEqual([]);
  });

  it('모든 병원에 공통인 진료과(= 고른 진료과)를 하나 고른다', () => {
    expect(commonDepartment(['내과 / 정형외과 / 재활의학과', '정형외과 / 신경과', '가정의학과 / 정형외과'])).toBe('정형외과');
  });

  it('공통 진료과가 없거나 진료과를 모르는 병원이 있으면 null', () => {
    expect(commonDepartment(['내과', '외과'])).toBeNull();
    expect(commonDepartment(['내과', '—'])).toBeNull();
    expect(commonDepartment([])).toBeNull();
  });

  it('주소는 구·군과 다음 낱말까지만', () => {
    expect(shortAddress('서울특별시 구로구 경인로 445 2층')).toBe('구로구 경인로');
    expect(shortAddress('경기도 양평군 양평읍 시민로 1')).toBe('양평군 양평읍');
    expect(shortAddress('세종특별자치시 한누리대로 2130')).toBe('세종특별자치시 한누리대로');
    expect(shortAddress('')).toBe('');
  });
});
