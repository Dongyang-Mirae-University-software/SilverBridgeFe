export type FcmPlatform = 'WEB';

export interface IFcmTokenReq {
  token: string;
  platform: FcmPlatform;
}
