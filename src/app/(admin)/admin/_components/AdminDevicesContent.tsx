'use client';

import { useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { AdminCameraItem, AdminCameraStatusFilter } from '@/service/interface/admin/camera';
import { adminCameraListQueryOptions, adminCameraSummaryQueryOptions } from '@/service/query/admin';
import styles from './AdminDevicesContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 10;

const TABS: Array<{ value: AdminCameraStatusFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'LIVE', label: '정상' },
  { value: 'OFFLINE', label: '오프라인' },
];

function formatCount(value: number | null | undefined, suffix = '대') {
  return value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(date);
}

function isLiveStatusUnknown(error: unknown) {
  return isAxiosError(error) && (error.response?.status === 503 || error.response?.data?.code === 'CAMERA_LIVE_STATUS_UNKNOWN');
}

export function AdminDevicesContent() {
  const [status, setStatus] = useState<AdminCameraStatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const summary = useQuery(adminCameraSummaryQueryOptions);
  const list = useQuery(adminCameraListQueryOptions({ status, q: query.trim() || undefined, page, size: PAGE_SIZE }));
  const data = list.data;
  const liveStatusUnknown = isLiveStatusUnknown(list.error);

  const changeStatus = (next: AdminCameraStatusFilter) => {
    if (next !== 'ALL' && summary.data?.aiConnected === false) return;
    setStatus(next);
    setPage(0);
  };

  return <section className={cx('page')}>
    <header className={cx('heading')}><div><h1>디바이스 관리</h1><p>어르신 집의 태블릿·휴대폰을 방마다 1대씩 카메라로 써요</p></div></header>

    <div className={cx('summaryGrid')} aria-label="카메라 요약">
      <SummaryCard icon="eye" label="등록 카메라" value={formatCount(summary.data?.registered)} detail={`카메라 있는 어르신 ${summary.data ? `${summary.data.totalWards - summary.data.wardsWithoutCamera} / ${summary.data.totalWards}` : '-'}명`} tone="brand" />
      <SummaryCard icon="check" label="정상 작동" value={formatCount(summary.data?.live)} tone="safe" interactive disabled={summary.data?.aiConnected === false} onClick={() => changeStatus('LIVE')} />
      <SummaryCard icon="warning" label="연결이 끊긴 카메라" value={formatCount(summary.data?.offline)} tone="danger" interactive disabled={summary.data?.aiConnected === false} onClick={() => changeStatus('OFFLINE')} />
    </div>

    {summary.data?.aiConnected === false && <p className={cx('unknownNotice')}><Icon name="warning" size={16} decorative />AI 수신기 연결 상태를 확인할 수 없습니다. 전체 목록은 계속 조회할 수 있습니다.</p>}

    <section className={cx('card')}>
      <div className={cx('filterBar')}>
        <nav className={cx('tabs')} aria-label="카메라 상태 필터">
          {TABS.map(tab => <button key={tab.value} type="button" className={cx('tab', { active: status === tab.value })} disabled={tab.value !== 'ALL' && summary.data?.aiConnected === false} onClick={() => changeStatus(tab.value)}>{tab.label}</button>)}
        </nav>
        <label className={cx('search')}><Icon name="search" size={16} decorative /><span className={cx('srOnly')}>이름, 회원 ID, 주소 또는 방 검색</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="이름·회원 ID·방 검색" />{query && <button type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); setPage(0); }}><Icon name="close" size={14} decorative /></button>}</label>
      </div>

      {liveStatusUnknown ? <StatusNotice onAll={() => changeStatus('ALL')} onRetry={() => void list.refetch()} /> : <>
        <div className={cx('tableScroll')}><table className={cx('table')}><thead><tr><th>어르신</th><th>방</th><th>주소</th><th>등록일</th><th>사용 여부</th><th>상태</th></tr></thead><tbody>
          {list.isLoading && <StateRow>카메라 목록을 불러오는 중입니다.</StateRow>}
          {list.isError && <StateRow>카메라 목록을 불러오지 못했습니다. <button type="button" onClick={() => void list.refetch()}>다시 시도</button></StateRow>}
          {!list.isLoading && !list.isError && data?.content.length === 0 && <StateRow>조건에 맞는 카메라가 없습니다.</StateRow>}
          {data?.content.map(camera => <CameraRow key={camera.cameraId} camera={camera} />)}
        </tbody></table></div>
        {data && <footer className={cx('pager')}><span>{data.totalElements === 0 ? '0대' : `${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / 전체 ${data.totalElements}대`}</span><Pagination page={data.page} totalPages={data.totalPages} variant="numbered" disabled={list.isFetching} hasPrevPage={data.page > 0} hasNextPage={!data.last} onChange={setPage} /></footer>}
      </>}
    </section>
  </section>;
}

function SummaryCard({ icon, label, value, detail, tone, interactive = false, disabled = false, onClick }: { icon: 'eye' | 'check' | 'warning'; label: string; value: string; detail?: string; tone: 'brand' | 'safe' | 'danger'; interactive?: boolean; disabled?: boolean; onClick?: () => void }) {
  const content = <><span className={cx('summaryLabel')}><i className={cx('summaryIcon', tone)}><Icon name={icon} size={16} decorative /></i>{label}</span><strong className={cx('summaryValue', tone)}>{value}</strong>{detail && <small>{detail}</small>}</>;
  return interactive ? <button type="button" className={cx('summaryCard', 'interactive')} disabled={disabled} onClick={onClick}>{content}</button> : <div className={cx('summaryCard')}>{content}</div>;
}

function CameraRow({ camera }: { camera: AdminCameraItem }) {
  return <tr><td><div className={cx('ward')}><b>{camera.wardName ?? '알 수 없음'}</b><code>{camera.wardId}</code></div></td><td className={cx('room')}>{camera.room}</td><td className={cx('address')} title={camera.wardAddress ?? undefined}>{camera.wardAddress ?? '-'}</td><td>{formatDate(camera.registeredAt)}</td><td>{camera.isActive ? <span className={cx('activeBadge')}>사용 중</span> : <span className={cx('hiddenBadge')}>숨김</span>}</td><td><LiveStatusBadge value={camera.liveStatus} /></td></tr>;
}

function LiveStatusBadge({ value }: { value: AdminCameraItem['liveStatus'] }) {
  const label = value === 'LIVE' ? '정상' : value === 'OFFLINE' ? '오프라인' : '확인 중';
  return <span className={cx('statusBadge', value?.toLowerCase() ?? 'unknown')}><i />{label}</span>;
}

function StateRow({ children }: { children: ReactNode }) { return <tr><td className={cx('stateCell')} colSpan={6}>{children}</td></tr>; }

function StatusNotice({ onAll, onRetry }: { onAll: () => void; onRetry: () => void }) { return <div className={cx('statusNotice')}><Icon name="warning" size={20} decorative /><div><strong>지금 연결 상태를 확인할 수 없습니다.</strong><p>AI 수신기가 다시 연결되면 정상·오프라인 카메라를 확인할 수 있습니다.</p></div><div><button type="button" onClick={onAll}>전체 보기</button><button type="button" onClick={onRetry}>다시 시도</button></div></div>; }
