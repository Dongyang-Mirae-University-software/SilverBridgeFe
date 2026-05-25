const KAKAO_POSTCODE_SCRIPT_ID = 'kakao-postcode-script';
const KAKAO_POSTCODE_SCRIPT_SRC = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

interface KakaoPostcodeData {
  address: string;
  jibunAddress: string;
  roadAddress: string;
  userSelectedType: 'R' | 'J';
  zonecode: string;
}

interface KakaoPostcodeResult {
  address: string;
  postcode: string;
}

interface KakaoPostcodeInstance {
  open: () => void;
}

interface KakaoPostcodeOptions {
  oncomplete: (data: KakaoPostcodeData) => void;
}

type KakaoPostcodeConstructor = new (options: KakaoPostcodeOptions) => KakaoPostcodeInstance;

interface KakaoPostcodeNamespace {
  Postcode?: KakaoPostcodeConstructor;
}

declare global {
  interface Window {
    daum?: KakaoPostcodeNamespace;
    kakao?: KakaoPostcodeNamespace;
  }
}

let postcodeScriptPromise: Promise<void> | null = null;

export async function openKakaoPostcode(): Promise<KakaoPostcodeResult> {
  await loadKakaoPostcodeScript();

  const Postcode = getPostcodeConstructor();
  if (!Postcode) throw new Error('카카오 우편번호 서비스를 불러오지 못했습니다.');

  return new Promise(resolve => {
    new Postcode({
      oncomplete: data => {
        resolve({
          address: getSelectedAddress(data),
          postcode: data.zonecode,
        });
      },
    }).open();
  });
}

function loadKakaoPostcodeScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저 환경에서만 주소 검색을 사용할 수 있습니다.'));
  if (getPostcodeConstructor()) return Promise.resolve();
  if (postcodeScriptPromise) return postcodeScriptPromise;

  postcodeScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(KAKAO_POSTCODE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');

    script.id = KAKAO_POSTCODE_SCRIPT_ID;
    script.src = KAKAO_POSTCODE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      postcodeScriptPromise = null;
      reject(new Error('카카오 우편번호 스크립트 로딩에 실패했습니다.'));
    };

    if (!existingScript) document.head.appendChild(script);
  });

  return postcodeScriptPromise;
}

function getPostcodeConstructor() {
  return window.kakao?.Postcode ?? window.daum?.Postcode;
}

function getSelectedAddress(data: KakaoPostcodeData) {
  if (data.userSelectedType === 'R') return data.roadAddress || data.address;
  return data.jibunAddress || data.address;
}
