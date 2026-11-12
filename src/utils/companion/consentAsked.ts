// 대화 내용 공유 동의를 이 기기에서 이미 물었는지(또는 본인이 환경설정에서 정했는지) - 값은 '1'뿐(대화 원문은 남기지 않는다).
// 동의하면 서버에 consentedAt이 남지만, 거절·철회는 서버에 흔적이 없어(철회 = 동의 행 삭제) 여기에만 적는다
const CONSENT_ASKED_KEY = 'sb-companion-consent-asked';

export function readConsentAsked() {
  try {
    return window.localStorage.getItem(CONSENT_ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markConsentAsked() {
  try {
    window.localStorage.setItem(CONSENT_ASKED_KEY, '1');
  } catch {
    // 저장소를 못 쓰면 다음에 다시 묻는다
  }
}
