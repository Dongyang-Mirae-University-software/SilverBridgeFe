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
  /** 보호자가 부르는 어르신 호칭(예: 엄마) - 보호자 화면 응답에만 온다. 기존 연결은 null */
  wardRelation?: string | null;
  status: ConnectionStatus;
  priority?: number;
  connectedAt: string | null;
  createdAt: string;
  requester?: boolean;
  isRequester?: boolean;
}

export interface IGuardianConnectionRequestReq {
  relation: string;
  wardRelation: string;
  targetId: string;
}

export interface IGuardianConnectionPreview {
  targetId: string;
  maskedName: string;
}

export interface IWardPendingConnectionRequest {
  connectionId: number;
  guardianId: string;
  guardianName: string;
  guardianProfileImage?: string | null;
  guardianPhone: string;
  relation: string;
  requestedAt: string;
}
