import { getSubjectParticle } from '@/utils/format/korean';

// 이상감지 알림 문구 - BE가 제목·본문을 보내지 않았을 때만 쓰는 예비 문구(BE AnomalyNotificationListener와 같은 내용).
// 단정하지 않는다("감지되었습니다"). 피보호자 본인 안내는 종류별이다 - 넘어진 사람에게 "대피"는 맞지 않는다.
// 신고는 안내 문구일 뿐 앱이 발신하지 않는다.

interface AnomalyAlertInput {
  role?: string | null; // 'WARD'면 본인 문구, 그 밖은 보호자 문구
  detectedType?: string | null;
  detectedTypeLabel?: string | null;
  wardName?: string | null;
  location?: string | null;
}

const TYPE_LABEL: Record<string, string> = { FIRE: '화재', FALL: '낙상', WEAPON: '흉기' };

function selfGuidance(type?: string | null) {
  if (type === 'WEAPON') return '안전한 곳으로 피하고 112에 연락해 주세요.';
  if (type === 'FALL') return '괜찮으시면 보호자에게 연락해 주세요. 도움이 필요하면 SOS 버튼을 눌러 주세요.';
  if (type === 'FIRE') return '안전한 곳으로 대피해 주세요.';
  return '안전을 확인해 주세요.';
}

function guardianGuidance(type?: string | null) {
  if (type === 'WEAPON') return ' 바로 연락해 안전을 확인하고, 위험하면 112에 신고해 주세요.';
  if (type === 'FALL') return ' 바로 연락해 안전을 확인해 주세요.';
  return '';
}

export function getAnomalyAlertText({ role, detectedType, detectedTypeLabel, wardName, location }: AnomalyAlertInput) {
  const label = detectedTypeLabel || (detectedType ? TYPE_LABEL[detectedType] : undefined) || '이상 상황';
  const what = `${label}${getSubjectParticle(label)}`;
  const place = location ? `${location}에서` : '등록된 카메라에서';
  const title = `${label} 감지`;

  if (role === 'WARD') {
    return { title, body: `${place} ${what} 감지되었습니다. ${selfGuidance(detectedType)}` };
  }
  return {
    title,
    body: `${wardName || '피보호자'} 댁 ${place} ${what} 감지되었습니다.${guardianGuidance(detectedType)}`,
  };
}
