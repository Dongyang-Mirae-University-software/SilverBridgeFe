'use client';

import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import { AdminOperationDashboard, AdminSafetyDashboard } from '@/service/interface/admin/dashboard';
import { adminOperationDashboardQueryOptions, adminSafetyDashboardQueryOptions } from '@/service/query/admin';
import { ADMIN_ANOMALY_TYPE_META, formatAdminTrendDate, formatNullableCount, getReviewMetrics } from '@/utils/admin/dashboard';
import styles from './AdminDashboardContent.module.css';

const cx = classNames.bind(styles);
const subscribeNothing = () => () => {};

export function AdminDashboardContent() {
  const [tab, setTab] = useState<'safety' | 'operations'>('safety');
  const dateLabel = useSyncExternalStore(subscribeNothing, () => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()), () => '오늘');
  const safety = useQuery(adminSafetyDashboardQueryOptions(tab === 'safety'));
  const operation = useQuery(adminOperationDashboardQueryOptions(tab === 'operations'));
  return <div className={cx('dashboard')}>
    <header className={cx('heading')}><h1>대시보드</h1><p>{dateLabel}</p></header>
    <div className={cx('tabs')} role="tablist" aria-label="관리자 대시보드 보기">
      <button className={cx('tab', { active: tab === 'safety' })} type="button" role="tab" aria-selected={tab === 'safety'} onClick={() => setTab('safety')}>안전 현황</button>
      <button className={cx('tab', { active: tab === 'operations' })} type="button" role="tab" aria-selected={tab === 'operations'} onClick={() => setTab('operations')}>운영 현황</button>
    </div>
    {tab === 'safety' ? <SafetyDashboard data={safety.data} isLoading={safety.isLoading} isError={safety.isError} onRetry={() => void safety.refetch()} /> : <OperationsDashboard data={operation.data} isLoading={operation.isLoading} isError={operation.isError} onRetry={() => void operation.refetch()} />}
  </div>;
}

function SafetyDashboard({ data, isLoading, isError, onRetry }: DashboardState<AdminSafetyDashboard>) {
  if (isLoading) return <DashboardNotice>안전 현황을 불러오는 중입니다.</DashboardNotice>;
  if (isError || !data) return <DashboardNotice retry={onRetry}>안전 현황을 불러오지 못했습니다.</DashboardNotice>;
  const { safetyEvents, todayAnomaly } = data;
  const events = [
    { label: '연결이 끊긴 카메라', value: formatNullableCount(safetyEvents.disconnectedCameras, '대'), description: safetyEvents.disconnectedCameras === null ? 'AI 수신기 상태를 확인할 수 없습니다' : '스트리밍이 잡히지 않는 등록 카메라입니다', alert: safetyEvents.disconnectedCameras !== null && safetyEvents.disconnectedCameras > 0 },
    { label: '보호자 미연결 피보호자', value: `${safetyEvents.wardsWithoutGuardian}명`, description: 'ACTIVE 연결 보호자가 한 명도 없습니다', alert: safetyEvents.wardsWithoutGuardian > 0 },
    { label: '연락 가능한 보호자 없음', value: `${safetyEvents.wardsWithoutReachableGuardian}명`, description: '연결은 있지만 연락 가능한 보호자가 없습니다', alert: safetyEvents.wardsWithoutReachableGuardian > 0 },
    { label: '카메라 미등록 피보호자', value: `${safetyEvents.wardsWithoutCamera}명`, description: '이상감지 대상 카메라가 없습니다', alert: safetyEvents.wardsWithoutCamera > 0 },
    { label: '7일 이상 방치된 연결 요청', value: `${safetyEvents.stalePendingConnections}건`, description: '수락 또는 거절 확인이 필요합니다', alert: safetyEvents.stalePendingConnections > 0 },
  ];
  const reviewMetrics = getReviewMetrics(todayAnomaly.review, todayAnomaly.total);
  return <div className={cx('stack')}>
    <section className={cx('serviceCard', { offline: !data.aiConnected })} aria-label="AI 서비스 상태">
      <div className={cx('sectionTitleRow')}><span className={cx('serviceIcon')}><Icon name={data.aiConnected ? 'activity' : 'alert'} size={18} /></span><h2>AI 서비스 상태</h2><time>30초마다 갱신</time></div>
      <div className={cx('serviceGrid')}><Metric label="AI 수신기" value={data.aiConnected ? '정상' : '연결 끊김'} tone={data.aiConnected ? 'safe' : 'warn'} /><Metric label="구독 중 세션" value={`${data.subscribedSessions}개`} /><Metric label="카메라 상태" value={data.streamingCameras === null ? `등록 ${data.totalCameras}대 · 스트리밍 확인 불가` : `${data.streamingCameras} / ${data.totalCameras}대`} tone={data.streamingCameras === null ? 'warn' : undefined} /></div>
    </section>
    <div className={cx('primaryGrid')}>
      <section className={cx('card')}><div className={cx('cardHeading')}><h2>안전 이벤트</h2><span>확인이 필요한 항목</span></div><div className={cx('eventList')}>{events.map(event => <article className={cx('event', { alert: event.alert })} key={event.label}><div><strong>{event.label}</strong><p>{event.description}</p></div><b>{event.value}</b><Icon name="chevronRight" size={16} /></article>)}</div></section>
      <section className={cx('card', 'anomalyCard')}><div className={cx('cardHeading')}><h2>오늘 이상감지 현황</h2><span className={cx('metricNote')}>상황(incident) 기준</span></div>
        {todayAnomaly.total === 0 ? <div className={cx('emptyState')}><Icon name="check" size={24} /><strong>오늘 감지된 이상 상황이 없습니다</strong><span>유형별 수치는 감지된 유형이 있을 때만 표시됩니다.</span></div> : <>
          <div className={cx('anomalySummary')}><Donut items={todayAnomaly.byType} total={todayAnomaly.total} /><div className={cx('legend')}>{todayAnomaly.byType.map(item => <div key={item.detectedType}><i className={cx(ADMIN_ANOMALY_TYPE_META[item.detectedType].color)} /><span>{ADMIN_ANOMALY_TYPE_META[item.detectedType].label}</span><b>{item.count}건</b></div>)}</div></div>
          <div className={cx('reviewNotice')}><strong>응답 {reviewMetrics.answered}건 ({reviewMetrics.responseRate}%)</strong><span>응답한 보호자의 판정만 오탐률 계산에 사용합니다.</span></div>
          <div className={cx('reviewGrid')}><ReviewItem label="확인 필요" value={todayAnomaly.review.pending} /><ReviewItem label="실제 위험" value={todayAnomaly.review.real} tone="danger" /><ReviewItem label="오탐" value={todayAnomaly.review.falseAlarm} detail={reviewMetrics.answered ? `응답 기준 ${reviewMetrics.falseAlarmRate}%` : '응답 없음'} /><ReviewItem label="보호자 재확인 대기" value={todayAnomaly.review.conflicted} tone="warn" /></div>
        </>}
      </section>
    </div>
  </div>;
}

function OperationsDashboard({ data, isLoading, isError, onRetry }: DashboardState<AdminOperationDashboard>) {
  if (isLoading) return <DashboardNotice>운영 현황을 불러오는 중입니다.</DashboardNotice>;
  if (isError || !data) return <DashboardNotice retry={onRetry}>운영 현황을 불러오지 못했습니다.</DashboardNotice>;
  const stats: Array<{ label: string; value: string; icon: IconName; note?: string; tone: 'brand' | 'sun' }> = [
    { label: '전체 회원', value: `${data.totalUsers}명`, icon: 'users', note: `오늘 신규 ${data.newUsersToday}명`, tone: 'brand' }, { label: '연결 대기', value: `${data.pendingConnections}건`, icon: 'users', tone: 'sun' },
    { label: '미답변 문의', value: `${data.unansweredInquiries.count}건`, icon: 'messageCircle', note: data.unansweredInquiries.longestWaitingHours === null ? '대기 문의 없음' : `최장 ${data.unansweredInquiries.longestWaitingHours}시간`, tone: 'sun' }, { label: '카메라 등록', value: `${data.cameras.registered}대`, icon: 'eye', note: `${data.cameras.wards}명 사용`, tone: 'brand' },
  ];
  return <div className={cx('stack')}><div className={cx('statGrid')}>{stats.map(stat => <section className={cx('stat')} key={stat.label}><span className={cx('statLabel')}><i className={cx('statIcon', stat.tone)}><Icon name={stat.icon} size={16} /></i>{stat.label}</span><b>{stat.value}</b>{stat.note && <small>{stat.note}</small>}</section>)}</div>
    <div className={cx('operationsGrid')}><section className={cx('card')}><div className={cx('cardHeading')}><h2>회원 구성</h2></div><div className={cx('memberTypes')}><div><span>피보호자</span><b>{data.memberComposition.wards}명</b></div><div><span>보호자</span><b>{data.memberComposition.guardians}명</b></div></div><p className={cx('recentTitle')}>최근 7일 신규 가입</p><SignupTrendChart trend={data.signupTrend} /></section>
      <section className={cx('card')}><div className={cx('cardHeading')}><h2>처리 대기 항목</h2></div><div className={cx('pendingList')}><Pending icon="users" label="피보호자 연결 요청" value={data.pendingItems.connectionRequests} /><Pending icon="messageCircle" label="오늘 접수된 문의" value={data.pendingItems.todayInquiries} /><Pending icon="fileText" label="공지사항 임시저장" value={data.pendingItems.announcementDrafts} /></div></section></div>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'safe' | 'warn' }) { return <div className={cx('serviceItem', tone)}><i /><strong>{label}</strong><span>{value}</span></div>; }
function ReviewItem({ label, value, detail, tone }: { label: string; value: number; detail?: string; tone?: 'danger' | 'warn' }) { return <div className={cx('reviewItem', tone)}><span>{label}</span><b>{value}건</b>{detail && <small>{detail}</small>}</div>; }
function Pending({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  return <div>
    <span className={cx('pendingIcon')}><Icon name={icon} size={17} /></span>
    <span className={cx('pendingLabel')}>{label}</span>
    <b>{value}건</b>
  </div>;
}
function SignupTrendChart({ trend }: { trend: AdminOperationDashboard['signupTrend'] }) {
  const width = 380;
  const height = 46;
  const pad = 8;
  const max = Math.max(1, ...trend.map(item => item.count));
  const x = (index: number) => pad + index * (width - pad * 2) / Math.max(1, trend.length - 1);
  const y = (value: number) => height - value / max * (height - 10) - 4;
  const points = trend.map((item, index) => `${x(index)},${y(item.count)}`).join(' ');
  const lastIndex = trend.length - 1;
  return <svg className={cx('trendChart')} viewBox={`0 0 ${width} ${height + 16}`} role="img" aria-label="최근 7일 신규 가입 추이">
    <polyline points={points} fill="none" stroke="var(--sb-brand-soft)" strokeWidth="2.5" />
    {trend.map((item, index) => <g key={item.date}><circle cx={x(index)} cy={y(item.count)} r={index === lastIndex ? 4 : 2.5} fill={index === lastIndex ? 'var(--sb-brand)' : 'var(--sb-brand-soft)'} />{index === lastIndex && <text x={x(index)} y={y(item.count) - 8} textAnchor="middle">{item.count}명</text>}<text className={cx({ today: index === lastIndex })} x={x(index)} y={height + 14} textAnchor="middle">{formatAdminTrendDate(item.date)}</text></g>)}
  </svg>;
}
function DashboardNotice({ children, retry }: { children: string; retry?: () => void }) { return <section className={cx('notice')} aria-live="polite"><p>{children}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</section>; }
function Donut({ items, total }: { items: AdminSafetyDashboard['todayAnomaly']['byType']; total: number }) {
  const segments = items.reduce<Array<{ item: typeof items[number]; percent: number; offset: number }>>((result, item) => {
    const offset = result.at(-1) ? result.at(-1)!.offset + result.at(-1)!.percent : 0;
    result.push({ item, percent: item.count / total * 100, offset });
    return result;
  }, []);
  return <div className={cx('donut')} aria-label={`오늘 이상감지 ${total}건`}><svg viewBox="0 0 36 36" aria-hidden="true"><circle className={cx('track')} cx="18" cy="18" r="15.5" />{segments.map(({ item, percent, offset }) => <circle className={cx(ADMIN_ANOMALY_TYPE_META[item.detectedType].color)} cx="18" cy="18" r="15.5" pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-offset} key={item.detectedType} />)}</svg><div><b>{total}건</b><span>오늘 감지</span></div></div>;
}
type DashboardState<T> = { data: T | null | undefined; isLoading: boolean; isError: boolean; onRetry: () => void };
