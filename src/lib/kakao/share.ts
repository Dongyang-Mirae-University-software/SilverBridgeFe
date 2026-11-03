const KAKAO_SDK_ID = 'silverbridge-kakao-sdk';
const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';

type KakaoShare = {
  sendDefault: (payload: {
    objectType: 'text';
    text: string;
    link: { mobileWebUrl: string; webUrl: string };
    buttonTitle: string;
  }) => void;
};

export type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: KakaoShare;
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

function getKakaoSdk() {
  const sdk = window.Kakao;
  if (!sdk?.Share?.sendDefault || !sdk.isInitialized || !sdk.init) {
    throw new Error('카카오 공유 기능을 불러오지 못했습니다.');
  }
  return sdk;
}

export async function loadKakaoSdk() {
  if (typeof window === 'undefined') throw new Error('브라우저에서만 카카오 공유를 사용할 수 있습니다.');
  if (window.Kakao) return getKakaoSdk();

  const existing = document.getElementById(KAKAO_SDK_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<KakaoSdk>((resolve, reject) => {
      existing.addEventListener('load', () => {
        try {
          resolve(getKakaoSdk());
        } catch (error) {
          reject(error);
        }
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('카카오 공유 기능을 불러오지 못했습니다.')), { once: true });
    });
  }

  return new Promise<KakaoSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = KAKAO_SDK_ID;
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.onload = () => {
      try {
        resolve(getKakaoSdk());
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () => reject(new Error('카카오 공유 기능을 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
}

export async function shareToKakao(text: string, url: string) {
  const javascriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY;
  if (!javascriptKey) throw new Error('카카오 공유 설정이 없습니다.');

  const kakao = await loadKakaoSdk();
  if (!kakao.isInitialized()) kakao.init(javascriptKey);

  kakao.Share.sendDefault({
    objectType: 'text',
    text,
    link: { mobileWebUrl: url, webUrl: url },
    buttonTitle: '가족 등록하기',
  });
}
