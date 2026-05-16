import { RoleType } from './auth';

export interface IUserProfile {
  userId: string;
  email: string;
  name: string;
  role: RoleType;
  phone?: string;
  address?: string;
  addressDetail?: string;
  profileImageUrl?: string;
}
