export type ConnectionStatus = 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'REFUSED' | 'DISCONNECTED';
export type ConnectionPartnerGender = 'FEMALE' | 'MALE';

export interface IConnectionItem {
  id: number;
  partnerUserId: string;
  partnerName: string;
  partnerProfileImage: string | null;
  partnerPhone?: string | null;
  partnerAddress?: string | null;
  partnerAddressDetail?: string | null;
  partnerPostcode?: string | null;
  partnerGender?: ConnectionPartnerGender | null;
  partnerBirthDate?: string | null;
  partnerEmail?: string | null;
  relation?: string | null;
  status: ConnectionStatus;
  priority?: number;
  connectedAt: string | null;
  createdAt: string;
  requester?: boolean;
  isRequester?: boolean;
}

export interface IGuardianConnectionRequestReq {
  relation: string;
  targetId: string;
}

export interface IWardPendingConnectionRequest {
  connectionId: number;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  relation: string;
  requestedAt: string;
}
