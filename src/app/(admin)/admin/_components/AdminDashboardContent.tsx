'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import Link from 'next/link';

import { Icon, type IconName } from '@/components/Icon';
import { AdminAiServiceStatus, AdminOperationDashboard, AdminSafetyDashboard } from '@/service/interface/admin/dashboard';
import { adminAiServiceStatusQueryOptions, adminCompanionStatsQueryOptions, adminOperationDashboardQueryOptions, adminSafetyDashboardQueryOptions } from '@/service/query/admin';
import { COMPANION_MOOD_ROWS } from '@/utils/admin/companion';
import { ADMIN_ANOMALY_TYPE_META, formatNullableCount, getAiServiceState, getReviewMetrics } from '@/utils/admin/dashboard';
import styles from './AdminDashboardContent.module.css';

const cx = classNames.bind(styles);
const subscribeNothing = () => () => {};

function formatCount(value: number | null | undefined, unit: string) { return value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}${unit}`; }
function formatElapsed(value: string | undefined) { if (!value) return '방금'; const time = new Date(value).getTime(); if (Number.isNaN(time)) return '방금'; const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000)); return minutes < 1 ? '방금' : `${minutes}분 전`; }

export function AdminDashboardContent() {
  const dateLabel = useSyncExternalStore(subscribeNothing, () => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date()), () => '오늘');
  const safety = useQuery(adminSafetyDashboardQueryOptions(true));
  const operation = useQuery(adminOperationDashboardQueryOptions(true));
  const aiStatus = useQuery(adminAiServiceStatusQueryOptions(true));
  if (safety.isLoading || operation.isLoading) return <DashboardNotice>대시보드를 불러오는 중입니다.</DashboardNotice>;
  if (safety.isError || operation.isError || !safety.data || !operation.data) return <DashboardNotice retry={() => { void safety.refetch(); void operation.refetch(); void aiStatus.refetch(); }}>대시보드를 불러오지 못했습니다.</DashboardNotice>;
  return <DashboardOverview safety={safety.data} operation={operation.data} aiStatus={aiStatus.data} aiStatusLoading={aiStatus.isLoading} aiStatusError={aiStatus.isError} dateLabel={dateLabel} />;
}

function DashboardOverview({ safety, operation, aiStatus, aiStatusLoading, aiStatusError, dateLabel }: { safety: AdminSafetyDashboard; operation: AdminOperationDashboard; aiStatus: AdminAiServiceStatus | null | undefined; aiStatusLoading: boolean; aiStatusError: boolean; dateLabel: string }) {
  const anomalyService = getAiServiceState(aiStatus, 'anomaly', aiStatusLoading, aiStatusError);
  const chatbotService = getAiServiceState(aiStatus, 'chat', aiStatusLoading, aiStatusError);
  const companionService = getAiServiceState(aiStatus, 'companion', aiStatusLoading, aiStatusError);
  const review = getReviewMetrics(safety.todayAnomaly.review, safety.todayAnomaly.total);
  const falseAlarmRate = review.answered === 0 ? '-' : `${review.falseAlarmRate}%`;
  const typeTotal = safety.todayAnomaly.total || 1;
  // 대시보드에 들어올 때만 부른다 - 안전·운영 현황과 달리 자동으로 다시 부르지 않는다
  const companion = useQuery(adminCompanionStatsQueryOptions);
  const talk = companion.data;
  const continuingCount = talk ? talk.continuingWards.length : null;
  const moodTotal = talk ? COMPANION_MOOD_ROWS.reduce((sum, row) => sum + talk.moodDistribution[row.key], 0) : 0;
  return <main className={cx('dashboard')}>
    <header className={cx('heading')}><div><h1>대시보드</h1><p>{dateLabel}</p></div></header>
    <section className={cx('aiBar', { warning: anomalyService.tone === 'warn' || chatbotService.tone === 'warn' || companionService.tone === 'warn' })} aria-label="AI 서비스 상태"><div className={cx('aiBarHead')}><span><Icon name="activity" size={16} decorative />AI 서비스</span><time>{formatElapsed(aiStatus?.generatedAt)} 확인</time></div><div className={cx('aiServices')}><AiServiceCard label="AI 이상감지" state={anomalyService} /><AiServiceCard label="안부 말벗 · 기분 분석" state={companionService} /><AiServiceCard label="AI 의료 챗봇" state={chatbotService} /></div></section>
    <div className={cx('sectionGrid')}>
      <DashboardSection wide icon="activity" title="AI 통계" tone="danger" href="/admin/ai-stats" pill={safety.todayAnomaly.review.real > 0 ? `위험 ${safety.todayAnomaly.review.real}건` : undefined}>
        <div className={cx('aiStatsGrid')}>
          <AiSummaryCard title="AI 이상감지" marker="danger" items={[['오늘 감지', formatCount(safety.todayAnomaly.total, '건')], ['위험', formatCount(safety.todayAnomaly.review.real, '건'), 'danger'], ['AI 오탐률', falseAlarmRate, 'brand']]}>
            <TypeStack total={typeTotal} items={safety.todayAnomaly.byType.map(item => ({ label: ADMIN_ANOMALY_TYPE_META[item.detectedType].label, value: item.count, tone: ADMIN_ANOMALY_TYPE_META[item.detectedType].color }))} />
            {/* 오탐률 분모는 판정에 응답한 상황 수 - 응답률과 함께 보여야 숫자가 거짓이 되지 않는다 */}
            <p className={cx('summaryNotice')}>{safety.todayAnomaly.total === 0 ? '오늘 감지된 상황이 없습니다.' : `판정 응답 ${review.answered} / ${safety.todayAnomaly.total}건 (응답률 ${review.responseRate}%) 기준`}</p>
          </AiSummaryCard>
          <AiSummaryCard title="AI 의료 챗봇" marker="chat" items={[['서비스 상태', chatbotService.label], ['오늘 응답', '-'], ['통계 보기', 'AI 통계']]}><p className={cx('summaryNotice')}>상담 집계는 AI 의료 챗봇 통계 탭에서 확인할 수 있습니다.</p></AiSummaryCard>
          <AiSummaryCard title="AI 안부 말벗 · 정서 분석" marker="sun" items={[['응답률', talk?.responseRate == null ? '-' : `${talk.responseRate}%`, 'brand'], ['대화 없는 어르신', formatCount(talk?.noDialogueWardCount, '명'), talk && talk.noDialogueWardCount > 0 ? 'care' : undefined], ['걱정·우울 이어짐', formatCount(continuingCount, '명'), continuingCount ? 'care' : undefined]]}>{talk ? <TypeStack unit="명" total={moodTotal || 1} items={COMPANION_MOOD_ROWS.map(row => ({ label: row.label, value: talk.moodDistribution[row.key], tone: row.tone }))} /> : <p className={cx('summaryNotice')}>{companion.isLoading ? '오늘 안부 대화 집계를 불러오는 중입니다.' : '오늘 안부 대화 집계를 불러오지 못했습니다.'}</p>}</AiSummaryCard>
        </div>
      </DashboardSection>
      <DashboardSection icon="users" title="회원 관리" tone="brand" href="/admin/members" pill={safety.safetyEvents.wardsWithoutGuardian > 0 ? '살펴보기' : '정상'}>
        <NumberGrid items={[['피보호자', formatCount(operation.memberComposition.wards, '명')], ['보호자', formatCount(operation.memberComposition.guardians, '명')], ['가족 없는 어르신', formatCount(safety.safetyEvents.wardsWithoutGuardian, '명'), safety.safetyEvents.wardsWithoutGuardian > 0 ? 'care' : undefined]]} /><SimpleRows rows={[['전체 회원', formatCount(operation.totalUsers, '명')], ['오늘 가입', formatCount(operation.newUsersToday, '명')], ['연결 대기', formatCount(operation.pendingConnections, '건')]]} />
      </DashboardSection>
      <DashboardSection icon="bell" title="알림 이력" tone="danger" href="/admin/notifications" pill={safety.safetyEvents.todayFailedNotifications > 0 ? '확인 필요' : '정상'}>
        <NumberGrid items={[['전달 실패', formatCount(safety.safetyEvents.todayFailedNotifications, '건'), safety.safetyEvents.todayFailedNotifications > 0 ? 'care' : undefined]]} /><SimpleRows rows={[['안내', '발송 안 함은 실패에 포함되지 않습니다']]} />
      </DashboardSection>
      <DashboardSection icon="eye" title="디바이스 관리" tone="sun" href="/admin/devices">
        <NumberGrid items={[['꺼진 카메라', formatNullableCount(safety.safetyEvents.disconnectedCameras, '대'), safety.safetyEvents.disconnectedCameras !== null && safety.safetyEvents.disconnectedCameras > 0 ? 'care' : undefined], ['카메라 없는 어르신', formatCount(safety.safetyEvents.wardsWithoutCamera, '명')], ['등록 카메라', operation.cameras.maxTotal === null ? formatCount(operation.cameras.registered, '대') : `${operation.cameras.registered} / ${operation.cameras.maxTotal}대`]]} />{/* AI 수신기가 끊기면 켜짐·꺼짐 대수는 null(알 수 없음) - 0대로 그리지 않는다 */}
        {safety.streamingCameras === null || safety.safetyEvents.disconnectedCameras === null ? <p className={cx('summaryNotice')}>{safety.aiConnected ? 'AI와 다시 연결하는 중이라 켜짐·꺼짐 대수를 확인하고 있습니다.' : 'AI 수신기 연결이 끊겨 켜짐·꺼짐 대수를 알 수 없습니다.'}</p> : <TypeStack total={Math.max(1, safety.streamingCameras + safety.safetyEvents.disconnectedCameras)} unit="대" items={[{ label: '켜짐', value: safety.streamingCameras, tone: 'safe' }, { label: '꺼짐', value: safety.safetyEvents.disconnectedCameras, tone: 'warn' }]} />}
      </DashboardSection>
      <DashboardSection icon="messageCircle" title="고객센터" tone="accent" href="/admin/inquiries" pill={operation.unansweredInquiries.count > 0 ? '답변 필요' : '정상'}>
        <NumberGrid items={[['답변 기다림', formatCount(operation.unansweredInquiries.count, '건'), operation.unansweredInquiries.count > 0 ? 'care' : undefined], ['최장 대기', operation.unansweredInquiries.longestWaitingHours === null ? '-' : `${operation.unansweredInquiries.longestWaitingHours}시간`]]} /><SimpleRows rows={[['오늘 접수된 문의', formatCount(operation.pendingItems.todayInquiries, '건')]]} />
      </DashboardSection>
    </div>
    <p className={cx('generatedAt')}>안전 현황 {formatElapsed(safety.generatedAt)} · 운영 현황 {formatElapsed(operation.generatedAt)} 확인</p>
  </main>;
}

function AiServiceCard({ label, state }: { label: string; state: { label: string; tone: string } }) { return <span className={cx('aiServiceCard', state.tone)}><span className={cx('aiServiceName')}>{label}</span><span className={cx('aiServiceResult')}><i />{state.label}</span></span>; }
function DashboardSection({ icon, title, tone, href, pill, wide = false, children }: { icon: IconName; title: string; tone: string; href?: string; pill?: string; wide?: boolean; children: ReactNode }) {
  const content = <><header><span className={cx('sectionIcon', tone)}><Icon name={icon} size={17} decorative /></span><h2>{title}</h2>{pill && <em className={cx('pill', tone)}>{pill}</em>}{href && <Icon name="chevronRight" className={cx('cardArrow')} size={16} decorative />}</header>{children}</>;
  return href ? <Link className={cx('section', 'linked', { wide })} href={href} aria-label={`${title} 페이지로 이동`}>{content}</Link> : <section className={cx('section', { wide })}>{content}</section>;
}
function NumberGrid({ items }: { items: Array<[string, string, ('care' | 'danger' | 'brand')?]> }) { return <div className={cx('numberGrid')}>{items.map(([label, value, tone]) => <div key={label} className={cx(tone)}><span>{label}</span><b>{value}</b></div>)}</div>; }
function SimpleRows({ rows }: { rows: Array<[string, string]> }) { return <div className={cx('simpleRows')}>{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>; }
function AiSummaryCard({ title, marker, items, children }: { title: string; marker: string; items: Array<[string, string, ('care' | 'danger' | 'brand')?]>; children: ReactNode }) { return <article className={cx('aiSummaryCard')}><h3><i className={cx(marker)} />{title}</h3><NumberGrid items={items} />{children}</article>; }
function TypeStack({ total, items, unit = '건' }: { total: number; items: Array<{ label: string; value: number; tone: string }>; unit?: string }) { return <div className={cx('typeStack')}><div>{items.filter(item => item.value > 0).map(item => <i key={item.label} className={cx(item.tone)} style={{ width: `${item.value / total * 100}%` }} />)}</div><p>{items.map(item => <span key={item.label}><i className={cx(item.tone)} />{item.label} {item.value}{unit}</span>)}</p></div>; }
function DashboardNotice({ children, retry }: { children: string; retry?: () => void }) { return <section className={cx('notice')} aria-live="polite"><p>{children}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</section>; }
