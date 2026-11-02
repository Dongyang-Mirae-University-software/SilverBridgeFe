'use client';

import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Pagination } from '@/components/Pagination';
import { AdminAnomalyItem, AdminAnomalyPage, AdminAnomalyPeriod, AdminAnomalyReviewStatus, AdminAnomalySummary, AdminAnomalyType } from '@/service/interface/admin/anomaly';
import { adminAnomalyListQueryOptions, adminAnomalySummaryQueryOptions } from '@/service/query/admin';
import styles from './AdminAiStatsContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 20;
type TypeTab = 'ALL' | AdminAnomalyType;
type StatusTab = 'ALL' | AdminAnomalyReviewStatus;
const TYPE_TABS: Array<{ value: TypeTab; label: string }> = [{ value: 'ALL', label: '전체' }, { value: 'FALL', label: '낙상' }, { value: 'FIRE', label: '화재' }, { value: 'WEAPON', label: '흉기' }];
const STATUS_TABS: Array<{ value: StatusTab; label: string }> = [{ value: 'ALL', label: '판정 전체' }, { value: 'REAL', label: '위험' }, { value: 'FALSE_ALARM', label: '오탐' }, { value: 'PENDING', label: '미판정' }, { value: 'CONFLICTED', label: '의견 충돌' }];
const PERIOD_TABS: Array<{ value: AdminAnomalyPeriod; label: string }> = [{ value: 'TODAY', label: '오늘' }, { value: 'THIS_WEEK', label: '이번 주' }, { value: 'THIS_MONTH', label: '이번 달' }];
const RATE_TYPES: AdminAnomalyType[] = ['FALL', 'FIRE', 'WEAPON'];

function formatCount(value: number | null | undefined) { return value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}건`; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(date).replace(/\. /g, '/').replace('.', ''); }
function formatDuration(minutes: number) { if (minutes <= 0) return '순간'; return minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60 ? `${minutes % 60}분` : ''}`.trim(); }
function percent(value: number | null) { return value === null ? '-' : `${Math.round(value * 100)}%`; }
function statusLabel(status: AdminAnomalyReviewStatus) { return ({ PENDING: '미판정', REAL: '위험', FALSE_ALARM: '오탐', CONFLICTED: '의견 충돌' })[status]; }

export function AdminAiStatsContent() {
  const [tab, setTab] = useState<'detect' | 'chat'>('detect');
  const [period, setPeriod] = useState<AdminAnomalyPeriod>('TODAY');
  const [type, setType] = useState<TypeTab>('ALL');
  const [status, setStatus] = useState<StatusTab>('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminAnomalyItem | null>(null);
  const normalizedKeyword = keyword.trim() || undefined;
  const apiType = type === 'ALL' ? undefined : type;
  const summary = useQuery(adminAnomalySummaryQueryOptions({ period, type: apiType, keyword: normalizedKeyword }));
  const records = useQuery(adminAnomalyListQueryOptions({ period, type: apiType, status: status === 'ALL' ? undefined : status, keyword: normalizedKeyword, page, size: PAGE_SIZE }));
  const typeSummaries = useQueries({ queries: RATE_TYPES.map(rateType => adminAnomalySummaryQueryOptions({ period, type: rateType, keyword: normalizedKeyword })) });
  const reset = () => { setPage(0); setSelected(null); };

  return <section className={cx('page')}>
    <header className={cx('pageHead')}><h1>AI 통계</h1><div className={cx('aiTabs')} role="tablist" aria-label="AI 통계 종류"><button className={cx({ active: tab === 'detect' })} type="button" role="tab" aria-selected={tab === 'detect'} onClick={() => setTab('detect')}>AI 이상감지</button><button className={cx({ active: tab === 'chat' })} type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>AI 의료 챗봇</button><button type="button" disabled role="tab" aria-selected={false}>AI 안부 말벗 · 정서 분석</button></div></header>
    {tab === 'detect' ? <DetectionStats summary={summary.data} records={records.data} typeSummaries={typeSummaries.map(query => query.data)} isLoading={summary.isLoading || records.isLoading} isError={summary.isError || records.isError} isFetching={records.isFetching} period={period} type={type} status={status} keyword={keyword} onPeriod={value => { setPeriod(value); reset(); }} onType={value => { setType(value); reset(); }} onStatus={value => { setStatus(value); reset(); }} onKeyword={value => { setKeyword(value); reset(); }} onPage={setPage} onSelect={setSelected} onRetry={() => { void summary.refetch(); void records.refetch(); typeSummaries.forEach(query => { void query.refetch(); }); }} /> : <Notice>AI 의료 챗봇 통계는 준비 중입니다.</Notice>}
    {selected && <AnomalyDetailModal item={selected} onClose={() => setSelected(null)} />}
  </section>;
}

function DetectionStats({ summary, records, typeSummaries, isLoading, isError, isFetching, period, type, status, keyword, onPeriod, onType, onStatus, onKeyword, onPage, onSelect, onRetry }: { summary: AdminAnomalySummary | null | undefined; records: AdminAnomalyPage | null | undefined; typeSummaries: Array<AdminAnomalySummary | null | undefined>; isLoading: boolean; isError: boolean; isFetching: boolean; period: AdminAnomalyPeriod; type: TypeTab; status: StatusTab; keyword: string; onPeriod: (value: AdminAnomalyPeriod) => void; onType: (value: TypeTab) => void; onStatus: (value: StatusTab) => void; onKeyword: (value: string) => void; onPage: (value: number) => void; onSelect: (value: AdminAnomalyItem) => void; onRetry: () => void; }) {
  if (isLoading) return <Notice>AI 이상감지 통계를 불러오는 중입니다.</Notice>;
  if (isError || !summary || !records) return <Notice retry={onRetry}>AI 이상감지 통계를 불러오지 못했습니다.</Notice>;
  const answered = summary.total - summary.review.pending;
  const falseAlarmRate = summary.aiConfidence.basis > 0 ? summary.review.falseAlarm / summary.aiConfidence.basis : null;
  const count = (value: TypeTab) => value === 'ALL' ? summary.total : summary.byType.find(item => item.type === value)?.count;
  const cards: Array<{ label: string; value: string; tone?: 'warn' | 'care' | 'brand' }> = [{ label: '감지', value: formatCount(summary.total) }, { label: '위험', value: formatCount(summary.review.real), tone: 'warn' }, { label: '오탐', value: formatCount(summary.review.falseAlarm) }, { label: '미판정', value: formatCount(summary.review.pending), tone: 'care' }, { label: 'AI 오탐률', value: percent(falseAlarmRate), tone: 'brand' }];
  return <>
    <div className={cx('filterTop')}><p className={cx('description')}>보호자가 ‘실제 위험 / 괜찮아요’로 판정한 결과로 오탐률을 계산해요</p><Segment label="이상감지 조회 기간" items={PERIOD_TABS} selected={period} onSelect={onPeriod} /></div>
    <section className={cx('statNums')} aria-label="이상감지 집계">{cards.map(card => <div key={card.label}><span>{card.label}</span><strong className={cx(card.tone)}>{card.value}</strong></div>)}</section>
    <section className={cx('insightGrid')}><section className={cx('insightCard')}><h2>유형별 오탐률</h2><div className={cx('typeRates')}>{RATE_TYPES.map((rateType, index) => <TypeRate key={rateType} type={rateType} data={typeSummaries[index]} />)}</div></section><section className={cx('insightCard', 'responseCard')}><h2>보호자 응답 · AI 신뢰도</h2><div className={cx('qualityGrid')}><div><span>응답률</span><strong>{percent(summary.responseRate)}</strong><small>응답 {formatCount(answered)} · 미판정 {formatCount(summary.review.pending)}</small></div><div><span>AI 신뢰도</span><strong>{percent(summary.aiConfidence.average)}</strong><small>판정 {formatCount(summary.aiConfidence.basis)} 기준 평균</small></div></div><p>AI 신뢰도는 상황별 최고 confidence의 평균이며, 정확도와는 다를 수 있습니다.</p></section></section>
    <section className={cx('recordsCard')}><div className={cx('recordTools')}><Segment label="감지 유형 필터" items={TYPE_TABS} selected={type} onSelect={onType} count={count} /><Segment label="판정 상태 필터" items={STATUS_TABS} selected={status} onSelect={onStatus} /><label className={cx('search')}><span className={cx('srOnly')}>이름 또는 방 검색</span><input value={keyword} placeholder="이름·방 검색" onChange={event => onKeyword(event.target.value)} /></label></div><div className={cx('tableScroll')}><table className={cx('table')}><thead><tr><th>시각</th><th>유형</th><th>어르신</th><th>방</th><th>판정</th></tr></thead><tbody>{records.content.length === 0 ? <tr><td colSpan={5} className={cx('emptyCell')}>검색 결과가 없습니다.</td></tr> : records.content.map(item => <AnomalyRow key={item.incidentId} item={item} onSelect={onSelect} />)}</tbody></table></div><footer className={cx('pager')}><span>{records.totalElements === 0 ? '0건' : `${records.page * records.size + 1}–${Math.min((records.page + 1) * records.size, records.totalElements)} / 전체 ${records.totalElements}건`}</span><Pagination page={records.page} totalPages={records.totalPages} variant="numbered" disabled={isFetching} hasPrevPage={records.page > 0} hasNextPage={!records.last} onChange={onPage} /></footer></section>
  </>;
}

function Segment<T extends string>({ label, items, selected, onSelect, count }: { label: string; items: Array<{ value: T; label: string }>; selected: T; onSelect: (value: T) => void; count?: (value: T) => number | undefined }) { return <div className={cx('segment')} role="tablist" aria-label={label}>{items.map(item => <button key={item.value} className={cx({ active: selected === item.value })} type="button" onClick={() => onSelect(item.value)}>{item.label}{count && <b>{count(item.value) ?? '-'}</b>}</button>)}</div>; }
function TypeRate({ type, data }: { type: AdminAnomalyType; data: AdminAnomalySummary | null | undefined }) { const label = type === 'FALL' ? '낙상' : type === 'FIRE' ? '화재' : '흉기'; const basis = data?.aiConfidence.basis; const falseAlarm = data?.review.falseAlarm; const rate = basis && falseAlarm !== undefined ? falseAlarm / basis : null; return <div className={cx('typeRate', type.toLowerCase())}><div><span>{label}</span><strong>{percent(rate)}</strong></div><div className={cx('meter')}><i style={{ width: rate === null ? '0%' : `${Math.round(rate * 100)}%` }} /></div><small>{basis === undefined ? '집계 불러오는 중' : basis === 0 ? '판정된 상황 없음' : `판정 ${basis}건 중 오탐 ${falseAlarm}건`}</small></div>; }
function AnomalyRow({ item, onSelect }: { item: AdminAnomalyItem; onSelect: (value: AdminAnomalyItem) => void }) { return <tr className={cx('selectableRow')} tabIndex={0} onClick={() => onSelect(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item); } }}><td>{formatDateTime(item.startedAt)}</td><td><span className={cx('typeBadge', item.detectedType.toLowerCase())}>{item.detectedTypeLabel}</span></td><td>{item.wardName ?? '탈퇴한 회원'}</td><td>{item.cameraLabel ?? '삭제된 카메라'}</td><td><span className={cx('statusBadge', item.reviewStatus.toLowerCase())}>{statusLabel(item.reviewStatus)}</span></td></tr>; }
function AnomalyDetailModal({ item, onClose }: { item: AdminAnomalyItem; onClose: () => void }) { return <div className={cx('modalOverlay')} role="presentation" onMouseDown={onClose}><section className={cx('modal')} role="dialog" aria-modal="true" aria-labelledby="anomaly-detail-title" onMouseDown={event => event.stopPropagation()}><header><div><span className={cx('typeBadge', item.detectedType.toLowerCase())}>{item.detectedTypeLabel}</span><h2 id="anomaly-detail-title">이상감지 상황 상세</h2></div><button type="button" aria-label="닫기" onClick={onClose}>×</button></header><div className={cx('modalBody')}><dl><div><dt>첫 감지 시각</dt><dd>{formatDateTime(item.startedAt)}</dd></div><div><dt>마지막 감지</dt><dd>{formatDateTime(item.lastDetectedAt)}</dd></div><div><dt>피보호자</dt><dd>{item.wardName ?? '탈퇴한 회원'}</dd></div><div><dt>카메라</dt><dd>{item.cameraLabel ?? '삭제된 카메라'}</dd></div><div><dt>지속 시간</dt><dd>{formatDuration(item.durationMinutes)}</dd></div><div><dt>감지 횟수</dt><dd>{formatCount(item.eventCount)}</dd></div><div><dt>최고 신뢰도</dt><dd>{percent(item.maxConfidence)}</dd></div><div><dt>최종 판정</dt><dd><span className={cx('statusBadge', item.reviewStatus.toLowerCase())}>{statusLabel(item.reviewStatus)}</span></dd></div></dl><section className={cx('feedbacks')}><h3>보호자 응답</h3>{item.feedbacks.length === 0 ? <p>아직 보호자 응답이 없습니다.</p> : <ul>{item.feedbacks.map(feedback => <li key={feedback.guardianId}><div><b>{feedback.guardianName ?? '탈퇴한 회원'}</b><small>마지막 응답 {formatDateTime(feedback.respondedAt)}</small></div><span className={cx('feedbackBadge', feedback.verdict.toLowerCase())}>{feedback.verdict === 'REAL' ? '실제 위험' : '괜찮아요'}</span></li>)}</ul>}</section></div></section></div>; }
function Notice({ children, retry }: { children: string; retry?: () => void }) { return <section className={cx('notice')} aria-live="polite"><p>{children}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</section>; }
