import type { AdminAnomalySummary, AdminAnomalyType } from '@/service/interface/admin/anomaly';

// 관리자 이상감지 유형 탭 숫자. 유형 칸 이름은 type(실제 응답)·detectedType(Swagger) 둘 다 받는다.
// byType은 유형 필터를 무시하므로 '전체'는 그 합계로 센다 - total은 고른 유형으로 좁혀져 '전체' 숫자가 바뀌었다(QA ADM-A13·ADM-N29)
export function getAnomalyTypeCount(summary: Pick<AdminAnomalySummary, 'byType'>, value: AdminAnomalyType | 'ALL') {
  if (value === 'ALL') return summary.byType.reduce((sum, item) => sum + item.count, 0);
  return summary.byType.find(item => (item.type ?? item.detectedType) === value)?.count;
}
