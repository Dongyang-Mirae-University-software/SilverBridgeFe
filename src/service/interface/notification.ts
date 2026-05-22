export type FcmPlatform = 'WEB' | 'ANDROID' | 'IOS';

export interface IFcmTokenReq {
  token: string;
  platform: FcmPlatform;
}
