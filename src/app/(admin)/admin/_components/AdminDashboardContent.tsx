'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';
import Link from 'next/link';

import { Icon, type IconName } from '@/components/Icon';
import { AdminAiServiceStatus, AdminOperationDashboard, AdminSafetyDashboard } from '@/service/interface/admin/dashboard';
import { adminAiServiceStatusQueryOptions, adminOperationDashboardQueryOptions, adminSafetyDashboardQueryOptions } from '@/service/query/admin';
import { ADMIN_ANOMALY_TYPE_META, formatNullableCount, getReviewMetrics } from '@/utils/admin/dashboard';
import styles from './AdminDashboardContent.module.css';

const cx = classNames.bind(styles);
const subscribeNothing = () => () => {};

function formatCount(value: number | null | undefined, unit: string) { return value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}${unit}`; }
function formatElapsed(value: string | undefined) { if (!value) return '방금'; const time = new Date(value).getTime(); if (Number.isNaN(time)) return '방금'; const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000)); return minutes < 1 ? '방금' : `${minutes}분 전`; }
function confidence(value: number | null) { return value === null ? '-' : `${Math.round(value * 100)}%`; }
function serviceState(status: AdminAiServiceStatus | null | undefined, kind: 'anomaly' | 'chat', loading: boolean, error: boolean) { if (loading) return { label: '확인 중', tone: 'mute' }; if (error || !status) return { label: '확인 불가', tone: 'mute' }; const value: unknown = kind === 'anomaly' ? status.anomalyDetection : status.chatbot; if (value === null) return { label: kind === 'anomaly' ? '확인 중' : '확인 불가', tone: 'mute' }; if (value === 'OK') return { label: '정상', tone: 'safe' }; if (kind === 'anomaly' && value === 'DISCONNECTED') return { label: '연결 끊김', tone: 'warn' }; if (kind === 'chat' && value === 'DISABLED') return { label: '일시 중단', tone: 'warn' }; return { label: '확인 불가', tone: 'mute' }; }

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
  const anomalyService = serviceState(aiStatus, 'anomaly', aiStatusLoading, aiStatusError);
  const chatbotService = serviceState(aiStatus, 'chat', aiStatusLoading, aiStatusError);
  const review = getReviewMetrics(safety.todayAnomaly.review, safety.todayAnomaly.total);
  const falseAlarmRate = review.answered === 0 ? '-' : `${review.falseAlarmRate}%`;
  const typeTotal = safety.todayAnomaly.total || 1;
  const eventRows = [
    ['연결이 끊긴 카메라', formatNullableCount(safety.safetyEvents.disconnectedCameras, '대'), '꺼져 있어 감지가 되지 않습니다', safety.safetyEvents.disconnectedCameras !== null && safety.safetyEvents.disconnectedCameras > 0],
    ['보호자 미연결 피보호자', formatCount(safety.safetyEvents.wardsWithoutGuardian, '명'), 'SOS를 받을 보호자가 없습니다', safety.safetyEvents.wardsWithoutGuardian > 0],
    ['카메라 미등록 피보호자', formatCount(safety.safetyEvents.wardsWithoutCamera, '명'), '이상감지 대상 카메라가 없습니다', safety.safetyEvents.wardsWithoutCamera > 0],
    ['전달 실패한 알림', formatCount(safety.safetyEvents.todayFailedNotifications, '건'), 'SOS·복약 알림 전달 실패만 집계합니다', safety.safetyEvents.todayFailedNotifications > 0],
    ['7일 이상 방치된 연결 요청', formatCount(safety.safetyEvents.stalePendingConnections, '건'), '수락 또는 거절 확인이 필요합니다', safety.safetyEvents.stalePendingConnections > 0],
  ] as const;
  return <main className={cx('dashboard')}>
    <header className={cx('heading')}><div><h1>대시보드</h1><p>{dateLabel}</p></div></header>
    <section className={cx('aiBar', { warning: anomalyService.tone === 'warn' || chatbotService.tone === 'warn' })} aria-label="AI 서비스 상태"><div className={cx('aiBarHead')}><span><Icon name="activity" size={16} decorative />AI 서비스</span><time>{formatElapsed(aiStatus?.generatedAt)} 확인</time></div><div className={cx('aiServices')}><AiServiceCard label="AI 이상감지" state={anomalyService} /><AiServiceCard label="안부 말벗 · 기분 분석" state={{ label: '준비 중', tone: 'mute' }} /><AiServiceCard label="AI 의료 챗봇" state={chatbotService} /></div></section>
    <div className={cx('sectionGrid')}>
      <DashboardSection wide icon="activity" title="AI 통계" tone="danger" href="/admin/ai-stats" pill={safety.todayAnomaly.review.real > 0 ? `위험 ${safety.todayAnomaly.review.real}건` : undefined}>
        <div className={cx('aiStatsGrid')}>
          <AiSummaryCard title="AI 이상감지" marker="danger" items={[['오늘 감지', formatCount(safety.todayAnomaly.total, '건')], ['위험', formatCount(safety.todayAnomaly.review.real, '건'), 'danger'], ['AI 오탐률', falseAlarmRate, 'brand']]}>
            <TypeStack total={typeTotal} items={safety.todayAnomaly.byType.map(item => ({ label: ADMIN_ANOMALY_TYPE_META[item.detectedType].label, value: item.count, tone: ADMIN_ANOMALY_TYPE_META[item.detectedType].color }))} />
          </AiSummaryCard>
          <AiSummaryCard title="AI 의료 챗봇" marker="chat" items={[['서비스 상태', chatbotService.label], ['오늘 응답', '-'], ['통계 보기', 'AI 통계']]}><p className={cx('summaryNotice')}>상담 집계는 AI 의료 챗봇 통계 탭에서 확인할 수 있습니다.</p></AiSummaryCard>
          <AiSummaryCard title="AI 안부 말벗 · 정서 분석" marker="sun" items={[['서비스 상태', '준비 중'], ['응답률', '-'], ['대화 없는 어르신', '-']]}><p className={cx('summaryNotice')}>집계 API가 준비되면 이 영역에 표시됩니다.</p></AiSummaryCard>
        </div>
      </DashboardSection>
      <DashboardSection icon="users" title="회원 관리" tone="brand" href="/admin/members" pill={safety.safetyEvents.wardsWithoutGuardian > 0 ? '살펴보기' : '정상'}>
        <NumberGrid items={[['피보호자', formatCount(operation.memberComposition.wards, '명')], ['보호자', formatCount(operation.memberComposition.guardians, '명')], ['가족 없는 어르신', formatCount(safety.safetyEvents.wardsWithoutGuardian, '명'), safety.safetyEvents.wardsWithoutGuardian > 0 ? 'care' : undefined]]} /><SimpleRows rows={[['전체 회원', formatCount(operation.totalUsers, '명')], ['연결 대기', formatCount(operation.pendingConnections, '건')]]} />
      </DashboardSection>
      <DashboardSection icon="bell" title="알림 이력" tone="danger" href="/admin/notifications" pill={safety.safetyEvents.todayFailedNotifications > 0 ? '확인 필요' : '정상'}>
        <NumberGrid items={[['전달 실패', formatCount(safety.safetyEvents.todayFailedNotifications, '건'), safety.safetyEvents.todayFailedNotifications > 0 ? 'care' : undefined]]} /><SimpleRows rows={[['안내', '발송 안 함은 실패에 포함되지 않습니다']]} />
      </DashboardSection>
      <DashboardSection icon="eye" title="디바이스 관리" tone="sun">
        <NumberGrid items={[['꺼진 카메라', formatNullableCount(safety.safetyEvents.disconnectedCameras, '대'), safety.safetyEvents.disconnectedCameras !== null && safety.safetyEvents.disconnectedCameras > 0 ? 'care' : undefined], ['카메라 없는 어르신', formatCount(safety.safetyEvents.wardsWithoutCamera, '명')], ['등록 카메라', operation.cameras.maxTotal === null ? formatCount(operation.cameras.registered, '대') : `${operation.cameras.registered} / ${operation.cameras.maxTotal}대`]]} /><TypeStack total={Math.max(1, operation.cameras.registered)} items={[{ label: '켜짐', value: safety.streamingCameras ?? 0, tone: 'safe' }, { label: '꺼짐', value: safety.safetyEvents.disconnectedCameras ?? 0, tone: 'warn' }]} />
      </DashboardSection>
      <DashboardSection icon="messageCircle" title="고객센터" tone="accent" href="/admin/inquiries" pill={operation.unansweredInquiries.count > 0 ? '답변 필요' : '정상'}>
        <NumberGrid items={[['답변 기다림', formatCount(operation.unansweredInquiries.count, '건'), operation.unansweredInquiries.count > 0 ? 'care' : undefined], ['최장 대기', operation.unansweredInquiries.longestWaitingHours === null ? '-' : `${operation.unansweredInquiries.longestWaitingHours}시간`]]} /><SimpleRows rows={[['오늘 접수된 문의', formatCount(operation.pendingItems.todayInquiries, '건')]]} />
      </DashboardSection>
      <DashboardSection icon="fileText" title="공지사항" tone="mute"><NumberGrid items={[['임시저장', formatCount(operation.pendingItems.announcementDrafts, '건')]]} /><SimpleRows rows={[['안내', '공지 관리 기능은 준비 중입니다']]} /></DashboardSection>
      <DashboardSection wide icon="alert" title="오늘 이상감지 현황" tone="danger" href="/admin/ai-stats">
        <div className={cx('anomalyDetail')}><div className={cx('anomalyNumbers')}><NumberGrid items={[['감지', formatCount(safety.todayAnomaly.total, '건')], ['위험', formatCount(safety.todayAnomaly.review.real, '건'), 'danger'], ['오탐', formatCount(safety.todayAnomaly.review.falseAlarm, '건')], ['미판정', formatCount(safety.todayAnomaly.review.pending, '건')]]} /><div className={cx('detailLine')}><span>보호자 응답률 <b>{review.responseRate}%</b></span><span>AI 신뢰도 <b>{confidence(safety.todayAnomaly.aiConfidence.average)}</b> · 판정 {safety.todayAnomaly.aiConfidence.basis}건</span></div></div><div className={cx('eventRows')}>{eventRows.map(([label, value, note, hot]) => <div key={label} className={cx({ hot })}><div><b>{label}</b><small>{note}</small></div><strong>{value}</strong><Icon name="chevronRight" size={16} decorative /></div>)}</div></div>
      </DashboardSection>
    </div>
    <p className={cx('generatedAt')}>안전 현황 {formatElapsed(safety.generatedAt)} · 운영 현황 {formatElapsed(operation.generatedAt)} 확인</p>
  </main>;
}

function AiServiceCard({ label, state }: { label: string; state: { label: string; tone: string } }) { return <span className={cx('aiServiceCard', state.tone)}><span className={cx('aiServiceName')}>{label}</span><span className={cx('aiServiceResult')}><i />{state.label}</span></span>; }
function DashboardSection({ icon, title, tone, href, pill, wide = false, children }: { icon: IconName; title: string; tone: string; href?: string; pill?: string; wide?: boolean; children: ReactNode }) { const body = <section className={cx('section', { wide })}><header><span className={cx('sectionIcon', tone)}><Icon name={icon} size={17} decorative /></span><h2>{title}</h2>{pill && <em className={cx('pill', tone)}>{pill}</em>}{href && <span className={cx('allLink')}>전체 보기<Icon name="chevronRight" size={14} decorative /></span>}</header>{children}</section>; return href ? <Link className={cx('sectionLink', { wide })} href={href}>{body}</Link> : body; }
function NumberGrid({ items }: { items: Array<[string, string, ('care' | 'danger' | 'brand')?]> }) { return <div className={cx('numberGrid')}>{items.map(([label, value, tone]) => <div key={label} className={cx(tone)}><span>{label}</span><b>{value}</b></div>)}</div>; }
function SimpleRows({ rows }: { rows: Array<[string, string]> }) { return <div className={cx('simpleRows')}>{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>; }
function AiSummaryCard({ title, marker, items, children }: { title: string; marker: string; items: Array<[string, string, ('danger' | 'brand')?]>; children: ReactNode }) { return <article className={cx('aiSummaryCard')}><h3><i className={cx(marker)} />{title}</h3><NumberGrid items={items} />{children}</article>; }
function TypeStack({ total, items }: { total: number; items: Array<{ label: string; value: number; tone: string }> }) { return <div className={cx('typeStack')}><div>{items.filter(item => item.value > 0).map(item => <i key={item.label} className={cx(item.tone)} style={{ width: `${item.value / total * 100}%` }} />)}</div><p>{items.map(item => <span key={item.label}><i className={cx(item.tone)} />{item.label} {item.value}건</span>)}</p></div>; }
function DashboardNotice({ children, retry }: { children: string; retry?: () => void }) { return <section className={cx('notice')} aria-live="polite"><p>{children}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</section>; }
