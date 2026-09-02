import { GenderType, RoleType } from '../auth/auth';

export type UserProvider = 'LOCAL' | 'KAKAO';
export type NotificationChannelType = 'FCM' | 'SMS' | 'KAKAO_ALIMTALK' | 'EMAIL';

export interface IUserNotificationSetting {
  channelType: NotificationChannelType;
  enabled: boolean;
}

export interface IUserNotificationSettingsResponse {
  settings: IUserNotificationSetting[];
}

export interface IUserNotificationSettingsUpdateReq {
  settings: IUserNotificationSetting[];
}

export interface IUserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  provider: UserProvider;
  role: RoleType;
  profileImage?: string | null;
  gender: GenderType | null;
  birthDate: string | null;
  postcode: string | null;
  address: string;
  addressDetail: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface IUserUpdateReq {
  name: string;
  phone: string;
  verificationNonce?: string | null;
  gender: GenderType | '';
  birthDate: string;
  postcode: string;
  address: string;
  addressDetail: string;
}

export interface IUserPasswordChangeReq {
  currentPassword: string;
  newPassword: string;
}

export interface IUserDeleteReq {
  password?: string | null;
  confirmation?: string;
}
