import { RoleType } from './auth';

export type UserProvider = 'LOCAL' | 'KAKAO';

export interface IUserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  provider: UserProvider;
  role: RoleType;
  profileImage?: string | null;
  address?: string;
  addressDetail?: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface IUserUpdateReq {
  name: string;
  phone?: string;
  address?: string;
  addressDetail?: string;
}

export interface IUserPasswordChangeReq {
  currentPassword: string;
  newPassword: string;
}

export interface IUserDeleteReq {
  password: string | null;
}
