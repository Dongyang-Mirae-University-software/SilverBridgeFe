export type ConnectionStatus = 'PENDING' | 'ACTIVE';

export interface IConnectionItem {
  id: number;
  partnerUserId: string;
  partnerName: string;
  partnerProfileImage: string | null;
  status: ConnectionStatus;
  priority: number;
  connectedAt: string | null;
  createdAt: string;
  requester: boolean;
}

export interface IGuardianConnectionRequestReq {
  relation: string;
  targetId: string;
}
