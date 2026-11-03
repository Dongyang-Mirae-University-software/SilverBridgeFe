import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user/user';

export interface RoleProfileModalProps {
  onClose: () => void;
  profile: IUserProfile | null;
  role: AuthRole;
  userId: string;
  userEmail: string;
  userName: string;
}
