// 카메라 등록용 deviceId를 브라우저에 보관. 서버가 발급한 값을 그대로 저장해 두고
// 다음 등록 때 같이 보내면, 같은 기기로 인식되어 카메라가 중복 생성되지 않는다.

const DEVICE_ID_STORAGE_KEY = 'silverbridge_ward_device_id';

export function getStoredDeviceId(): string | undefined {
  try {
    return window.localStorage.getItem(DEVICE_ID_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setStoredDeviceId(deviceId: string) {
  try {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 조용히 무시, 다음 등록 시 새 기기로 취급됨
  }
}
