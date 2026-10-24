import { describe, expect, it } from 'vitest';

import { getAnomalyAlertText } from './alertText';

describe('getAnomalyAlertText', () => {
  it('피보호자 본인 안내는 종류별이다 - 낙상에 "대피"를 붙이지 않는다', () => {
    const fall = getAnomalyAlertText({ role: 'WARD', detectedType: 'FALL', detectedTypeLabel: '낙상', location: '거실' });
    expect(fall.title).toBe('낙상 감지');
    expect(fall.body).toBe('거실에서 낙상이 감지되었습니다. 괜찮으시면 보호자에게 연락해 주세요. 도움이 필요하면 SOS 버튼을 눌러 주세요.');
    expect(fall.body).not.toContain('대피');

    expect(getAnomalyAlertText({ role: 'WARD', detectedType: 'FIRE', detectedTypeLabel: '화재', location: '주방' }).body).toBe(
      '주방에서 화재가 감지되었습니다. 안전한 곳으로 대피해 주세요.',
    );
    expect(getAnomalyAlertText({ role: 'WARD', detectedType: 'WEAPON', detectedTypeLabel: '흉기', location: '현관' }).body).toBe(
      '현관에서 흉기가 감지되었습니다. 안전한 곳으로 피하고 112에 연락해 주세요.',
    );
  });

  it('보호자 문구는 BE와 같은 종류별 안내(화재는 안내 없음), 이름 뒤 "님"은 붙이지 않는다', () => {
    expect(
      getAnomalyAlertText({ role: 'GUARDIAN', detectedType: 'WEAPON', detectedTypeLabel: '흉기', wardName: '김순자', location: '거실' }),
    ).toEqual({
      title: '흉기 감지',
      body: '김순자 댁 거실에서 흉기가 감지되었습니다. 바로 연락해 안전을 확인하고, 위험하면 112에 신고해 주세요.',
    });
    expect(
      getAnomalyAlertText({ role: 'GUARDIAN', detectedType: 'FIRE', detectedTypeLabel: '화재', wardName: '김순자', location: '거실' }).body,
    ).toBe('김순자 댁 거실에서 화재가 감지되었습니다.');
  });

  it('값이 비면 대체한다 - 라벨은 유형에서, 장소는 "등록된 카메라에서", 이름은 "피보호자"', () => {
    expect(getAnomalyAlertText({ role: 'GUARDIAN', detectedType: 'FALL' })).toEqual({
      title: '낙상 감지',
      body: '피보호자 댁 등록된 카메라에서 낙상이 감지되었습니다. 바로 연락해 안전을 확인해 주세요.',
    });
    expect(getAnomalyAlertText({ role: 'WARD' })).toEqual({
      title: '이상 상황 감지',
      body: '등록된 카메라에서 이상 상황이 감지되었습니다. 안전을 확인해 주세요.',
    });
  });
});
