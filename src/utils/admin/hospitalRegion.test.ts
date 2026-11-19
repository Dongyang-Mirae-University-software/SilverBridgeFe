import { describe, expect, it } from 'vitest';

import { joinRegion, splitRegion } from './hospitalRegion';

describe('제휴 병원 지역(시·도 + 구·군)', () => {
  it('짧은 시·도 이름과 구·군을 나눈다', () => {
    expect(splitRegion('서울 강남구')).toEqual({ province: '서울', detail: '강남구' });
    expect(splitRegion('경기 성남시 분당구')).toEqual({ province: '경기', detail: '성남시 분당구' });
    expect(splitRegion('세종')).toEqual({ province: '세종', detail: '' });
  });

  it('풀어 쓴 옛 이름도 짧은 이름으로 읽는다', () => {
    expect(splitRegion('서울특별시 강남구')).toEqual({ province: '서울', detail: '강남구' });
    expect(splitRegion('충청북도 청주시')).toEqual({ province: '충북', detail: '청주시' });
    expect(splitRegion('강원특별자치도 춘천시')).toEqual({ province: '강원', detail: '춘천시' });
  });

  it('시·도를 알 수 없으면 전체를 구·군 칸에 남겨 값을 잃지 않는다', () => {
    expect(splitRegion('강남구')).toEqual({ province: '', detail: '강남구' });
    expect(splitRegion('  ')).toEqual({ province: '', detail: '' });
  });

  it('시·도와 구·군을 한 칸 띄워 합친다', () => {
    expect(joinRegion('서울', '강남구')).toBe('서울 강남구');
    expect(joinRegion('제주', '')).toBe('제주');
    expect(joinRegion('', '강남구')).toBe('강남구');
  });

  it('구·군 칸에 띄어쓰기를 치는 중에도 공백이 사라지지 않는다', () => {
    const typing = joinRegion('경기', '성남시 ');
    expect(splitRegion(typing)).toEqual({ province: '경기', detail: '성남시 ' });
    expect(splitRegion(joinRegion('경기', '성남시 분당구')).detail).toBe('성남시 분당구');
  });
});
