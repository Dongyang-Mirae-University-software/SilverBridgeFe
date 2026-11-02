'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import {
  AdminNotificationCategory,
  AdminNotificationLogItem,
  AdminNotificationPeriod,
  AdminNotificationResult,
} from '@/service/interface/admin/notification';
import { adminNotificationListQueryOptions, adminNotificationSummaryQueryOptions } from '@/service/query/admin';
import styles from './AdminNotificationHistoryContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 20;

type CategoryTab = 'ALL' | AdminNotificationCategory | 'FAILED';

const CATEGORY_TABS: Array<{ value: CategoryTab; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'SOS', label: 'SOS' },
  { value: 'ANOMALY', label: '이상감지' },
  { value: 'MEDICATION', label: '복약' },
  { value: 'OTHER', label: '기타' },
  { value: 'FAILED', label: '전송 실패' },
];

const PERIOD_LABEL: Record<AdminNotificationPeriod, string> = {
  TODAY: '오늘',
  LAST_7_DAYS: '최근 7일',
  LAST_30_DAYS: '최근 30일',
};

const CATEGORY_LABEL: Record<AdminNotificationCategory, string> = {
  SOS: 'SOS',
  ANOMALY: '이상감지',
  MEDICATION: '복약',
  OTHER: '기타',
};

const RESULT_LABEL: Record<AdminNotificationResult, string> = {
  DELIVERED: '전송 완료',
  SMS_FALLBACK: '문자로 대체 발송',
  FAILED: '전송 실패',
  NOT_SENT: '발송 안 함',
};

function getCategoryFromTab(tab: CategoryTab): AdminNotificationCategory | undefined {
  return tab === 'ALL' || tab === 'FAILED' ? undefined : tab;
}

function getResultFromTab(tab: CategoryTab): AdminNotificationResult | undefined {
  return tab === 'FAILED' ? 'FAILED' : undefined;
}

function formatSentAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date).replace(/\. /g, '/').replace('.', '');
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = { FCM: '앱 푸시', SMS: '문자', KAKAO_ALIMTALK: '카카오 알림톡', EMAIL: '이메일' };
  return labels[channel] ?? channel;
}

function recipientLabel(log: AdminNotificationLogItem) {
  return log.relation ? `${log.recipientName} (${log.relation})` : log.recipientName;
}

export function AdminNotificationHistoryContent() {
  const [tab, setTab] = useState<CategoryTab>('ALL');
  const [period, setPeriod] = useState<AdminNotificationPeriod>('LAST_7_DAYS');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AdminNotificationLogItem | null>(null);
  const category = getCategoryFromTab(tab);
  const result = getResultFromTab(tab);
  const normalizedKeyword = keyword.trim() || undefined;

  const list = useQuery(adminNotificationListQueryOptions({ category, result, period, keyword: normalizedKeyword, page, size: PAGE_SIZE }));
  const summary = useQuery(adminNotificationSummaryQueryOptions({ category, period, keyword: normalizedKeyword }));
  const data = list.data;
  const summaryData = summary.data;

  const updateTab = (next: CategoryTab) => {
    setTab(next);
    setPage(0);
    setSelectedLog(null);
  };

  const updatePeriod = (next: AdminNotificationPeriod) => {
    setPeriod(next);
    setPage(0);
    setSelectedLog(null);
  };

  const updateKeyword = (next: string) => {
    setKeyword(next);
    setPage(0);
    setSelectedLog(null);
  };

  return (
    <section className={cx('page')}>
      <header className={cx('heading')}>
        <h1>알림 이력</h1>
      </header>

      <div className={cx('summaryGrid')} aria-label={`${PERIOD_LABEL[period]} 알림 요약`}>
        <SummaryCard icon="bell" label="전체 알림" value={summaryData?.total} tone="brand" />
        <SummaryCard icon="check" label="전송 완료" value={summaryData?.delivered} tone="safe" detail={summaryData?.smsFallback ? `문자 대체 발송 ${summaryData.smsFallback}건 포함` : undefined} />
        <SummaryCard icon="warning" label="전송 실패" value={summaryData?.failed} tone="danger" interactive onClick={() => updateTab('FAILED')} />
        <SummaryCard icon="bell" label="발송 안 함" value={summaryData?.notSent} tone="mute" detail="실패가 아닙니다" />
      </div>

      <section className={cx('card')}>
        <div className={cx('filterBar')}>
          <div className={cx('tabs')} aria-label="알림 종류 필터">
            {CATEGORY_TABS.map(item => <button key={item.value} type="button" className={cx('tab', { active: tab === item.value })} onClick={() => updateTab(item.value)}>{item.label}</button>)}
          </div>
          <label className={cx('search')}>
            <Icon name="search" size={16} decorative />
            <span className={cx('srOnly')}>피보호자 또는 수신자 이름 검색</span>
            <input value={keyword} onChange={event => updateKeyword(event.target.value)} placeholder="피보호자·수신자 이름 검색" />
          </label>
          <select aria-label="조회 기간" className={cx('periodSelect')} value={period} onChange={event => updatePeriod(event.target.value as AdminNotificationPeriod)}>
            {(Object.keys(PERIOD_LABEL) as AdminNotificationPeriod[]).map(value => <option key={value} value={value}>{PERIOD_LABEL[value]}</option>)}
          </select>
        </div>

        <div className={cx('tableScroll')}>
          <table className={cx('table')}>
            <thead><tr><th>발송 시각</th><th>알림 종류</th><th>피보호자</th><th>알림 내용</th><th>수신자</th><th>채널</th><th>전송 결과</th></tr></thead>
            <tbody>
              {list.isLoading && <StateRow>알림 이력을 불러오는 중입니다.</StateRow>}
              {list.isError && <StateRow>알림 이력을 불러오지 못했습니다. <button type="button" onClick={() => void list.refetch()}>다시 시도</button></StateRow>}
              {!list.isLoading && !list.isError && data?.content.length === 0 && <StateRow>조건에 맞는 알림 이력이 없습니다.</StateRow>}
              {data?.content.map(log => <NotificationRow key={log.id} log={log} onSelect={setSelectedLog} />)}
            </tbody>
          </table>
        </div>

        {data && <footer className={cx('pager')}>
          <span>{data.totalElements === 0 ? '0건' : `${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / 전체 ${data.totalElements}건`} · 실시간 화면 알림과 인증번호 문자는 포함되지 않으며, 이력은 90일간 보관됩니다.</span>
          <Pagination page={data.page} totalPages={data.totalPages} variant="numbered" disabled={list.isFetching} hasPrevPage={data.page > 0} hasNextPage={!data.last} onChange={setPage} />
        </footer>}
      </section>

      {selectedLog && <NotificationDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </section>
  );
}

function SummaryCard({ icon, label, value, tone, detail, interactive = false, onClick }: { icon: 'bell' | 'check' | 'warning'; label: string; value: number | undefined; tone: 'brand' | 'safe' | 'danger' | 'mute'; detail?: string; interactive?: boolean; onClick?: () => void }) {
  const content = <><span className={cx('summaryLabel')}><span className={cx('summaryIcon', tone)}><Icon name={icon} size={16} decorative /></span>{label}</span><strong className={cx('summaryValue', tone)}>{value === undefined ? '—' : `${value}건`}</strong>{detail && <small>{detail}</small>}</>;
  return interactive ? <button type="button" className={cx('summaryCard', 'interactive')} onClick={onClick}>{content}</button> : <div className={cx('summaryCard')}>{content}</div>;
}

function StateRow({ children }: { children: React.ReactNode }) {
  return <tr><td className={cx('stateCell')} colSpan={7}>{children}</td></tr>;
}

function NotificationRow({ log, onSelect }: { log: AdminNotificationLogItem; onSelect: (log: AdminNotificationLogItem) => void }) {
  return <tr className={cx('selectableRow')} tabIndex={0} onClick={() => onSelect(log)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(log); } }}>
    <td>{formatSentAt(log.sentAt)}</td>
    <td><span className={cx('categoryBadge', log.category)}>{CATEGORY_LABEL[log.category]}</span></td>
    <td className={cx('wardName')}>{log.wardName ?? '—'}</td>
    <td className={cx('message')}>{log.body}</td>
    <td><div className={cx('recipient')}><span>{recipientLabel(log)}</span><span className={cx('recipientBadge', { ward: log.recipientIsWard })}>{log.recipientIsWard ? '본인' : '보호자'}</span></div></td>
    <td>{log.deliveredChannels.length > 0 ? <div className={cx('channels')}>{log.deliveredChannels.map(channel => <span key={channel}>{channelLabel(channel)}</span>)}</div> : <span className={cx('dash')}>-</span>}</td>
    <td><button type="button" className={cx('resultBadge', log.result)} onClick={event => { event.stopPropagation(); onSelect(log); }}>{RESULT_LABEL[log.result]}</button></td>
  </tr>;
}

function NotificationDetailModal({ log, onClose }: { log: AdminNotificationLogItem; onClose: () => void }) {
  const channelResults = log.channelResults ?? [];
  return <div className={cx('modalOverlay')} role="presentation" onMouseDown={onClose}>
    <section className={cx('modal')} role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" onMouseDown={event => event.stopPropagation()}>
      <header className={cx('modalHead')}><div><p>{RESULT_LABEL[log.result]}</p><h2 id="notification-detail-title">알림 전송 상세</h2></div><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={20} decorative /></button></header>
      <div className={cx('modalBody')}>
        <dl className={cx('detailInfo')}><div><dt>발송 시각</dt><dd>{formatSentAt(log.sentAt)}</dd></div><div><dt>알림 종류</dt><dd>{log.typeLabel || CATEGORY_LABEL[log.category]}</dd></div><div><dt>피보호자</dt><dd>{log.wardName ?? '—'}</dd></div><div><dt>수신자</dt><dd>{recipientLabel(log)} · {log.recipientIsWard ? '본인' : '보호자'}</dd></div></dl>
        <section className={cx('messageBox')}><strong>{log.title}</strong><p>{log.body}</p></section>
        {log.result === 'NOT_SENT' && <section className={cx('notSentBox')}><strong>{log.notSentReasonLabel ?? '발송하지 않았습니다.'}</strong><p>실패가 아닙니다. 계정 상태 또는 수신자의 알림 설정에 따라 보내지 않은 알림입니다.</p></section>}
        <section className={cx('channelSection')}><h3>채널별 전송 결과</h3>{channelResults.length > 0 ? <ul>{channelResults.map((item, index) => <li key={`${item.channel}-${index}`} className={cx({ failed: item.status === 'FAILED' })}><strong>{channelLabel(item.channel)}</strong><span>{item.status === 'FAILED' ? item.reasonLabel ?? '전송 실패' : '전송 완료'}</span></li>)}</ul> : <p>시도한 채널이 없습니다.</p>}</section>
        {log.result === 'SMS_FALLBACK' && <p className={cx('fallbackNotice')}>푸시 전송이 실패해 문자로 대체 발송했습니다.</p>}
        {log.deliveredChannels.length > 0 && <p className={cx('deliveryNotice')}>전송 완료는 발송 서버가 접수한 기준이며, 기기 표시 여부는 확인할 수 없습니다.</p>}
      </div>
    </section>
  </div>;
}
