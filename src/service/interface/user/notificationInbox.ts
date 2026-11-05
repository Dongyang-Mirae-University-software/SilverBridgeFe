// 내 알림 기록(웹 상단 종 아이콘) - 보호자·피보호자 공통, 관리자는 403
// Swagger 태그: "공통 - 내 알림 기록" (/api/user/me/notifications/**)
// 최근 90일 동안 실제로 보낸 알림만 온다. 제목·본문은 휴대폰에 뜬 문구와 같다

export type NotificationInboxCategory = 'URGENT' | 'MEDICATION' | 'CONNECTION' | 'OTHER';

export interface INotificationInboxItem {
  id: number;
  type: string; // 새 종류가 생길 수 있어 string - 묶음은 category로만 나눈다
  category: NotificationInboxCategory;
  title: string | null;
  body: string | null; // 줄바꿈(\n)이 들어갈 수 있다
  createdAt: string;
  read: boolean;
  wardId: string | null; // 다른 사람(피보호자)에 관한 알림일 때만
  wardName: string | null;
}

export interface INotificationInboxPage {
  content: INotificationInboxItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
