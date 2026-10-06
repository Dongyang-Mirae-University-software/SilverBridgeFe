// 피보호자(WARD)의 SOS 동작 설정(119 화면을 언제 보여줄지) 타입
// Swagger 그룹: "피보호자 - SOS 설정" (/api/ward/sos-setting)

import { WardSosAction } from '@/components/layout/dashboard/types';

export interface WardSosSetting {
  sosAction: WardSosAction;
}

export type UpdateWardSosSettingReq = WardSosSetting;
