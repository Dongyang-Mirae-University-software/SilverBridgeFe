export type AdminUserRole = 'WARD' | 'GUARDIAN' | 'ADMIN';
export type AdminUserStatus = 'ACTIVE' | 'RESTRICTED';
export type AdminUserConnectionState = 'CONNECTED' | 'PENDING' | 'NONE';
export type AdminUserProvider = 'LOCAL' | 'KAKAO';

export interface AdminUserConnection {
  connectionId: number;
  counterpartId: string;
  counterpartName: string;
  counterpartRole: Exclude<AdminUserRole, 'ADMIN'>;
  relation: string | null;
  status: 'ACTIVE' | 'PENDING';
}

export interface AdminUserListItem {
  userId: string;
  provider: AdminUserProvider;
  email: string;
  name: string;
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  statusReason: string | null;
  connectionState: AdminUserConnectionState | null;
  connectionCount: number;
  firstConnection: AdminUserConnection | null;
  createdAt: string;
}

export interface AdminUserPage {
  content: AdminUserListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminUserDetail extends Omit<AdminUserListItem, 'connectionCount' | 'firstConnection'> {
  connections: AdminUserConnection[];
  lastLoginAt: string | null;
}

export interface AdminUserCounts {
  total: number;
  guardian: number;
  ward: number;
  admin: number;
}

export interface AdminUserListParams {
  keyword?: string;
  role?: AdminUserRole;
  status?: 'ALL' | AdminUserStatus;
  connection?: 'ALL' | AdminUserConnectionState;
  page: number;
  size: number;
}

export interface AdminUserUpdateRequest {
  name?: string | null;
  role?: Exclude<AdminUserRole, 'ADMIN'> | null;
  status?: AdminUserStatus | null;
  statusReason?: string | null;
}
