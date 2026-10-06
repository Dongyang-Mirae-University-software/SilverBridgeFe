// 보호자(GUARDIAN)의 고객센터 문의 작성·조회 타입
// Swagger 그룹: "보호자 - 문의" (/api/guardian/inquiry/**)

export type InquiryCategory = 'ANOMALY' | 'HOSPITAL' | 'ACCOUNT' | 'SERVICE' | 'ETC';
export type InquiryStatus = 'WAITING' | 'ANSWERED';

export interface GuardianInquiry {
  id: number;
  category: InquiryCategory;
  title: string;
  content: string; // 목록 조회 시엔 앞 100자로 축약된 미리보기
  status: InquiryStatus;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface GetGuardianInquiriesParams {
  page?: number;
  size?: number;
}

export interface CreateGuardianInquiryReq {
  category: InquiryCategory;
  title: string;
  content: string;
}
