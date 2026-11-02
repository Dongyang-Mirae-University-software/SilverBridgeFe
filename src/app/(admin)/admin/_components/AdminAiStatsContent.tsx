'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { AdminAnomalyItem, AdminAnomalyPeriod, AdminAnomalySummary } from '@/service/interface/admin/anomaly';
import { adminAnomalyListQueryOptions, adminAnomalySummaryQueryOptions } from '@/service/query/admin';
import styles from './AdminAiStatsContent.module.css';

const cx = classNames.bind(styles);

function formatCount(value: number | null | undefined, suffix = '건') {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('ko-KR')}${suffix}`;
}


export function AdminAiStatsContent() {
  const [tab, setTab] = useState<'detect' | 'chat'>('detect');
  const [period, setPeriod] = useState<AdminAnomalyPeriod>('TODAY');
  const [type, setType] = useState<'ALL' | 'FIRE' | 'FALL' | 'WEAPON'>('ALL');
  const summary = useQuery(adminAnomalySummaryQueryOptions({ period, type: type === 'ALL' ? undefined : type }));
  const records = useQuery(adminAnomalyListQueryOptions({ period, type: type === 'ALL' ? undefined : type, page: 0, size: 20 }));

  return <section className={cx('page')}>
    <header className={cx('pageHead')}><h1>AI 통계</h1><div className={cx('aiTabs')} role="tablist" aria-label="AI 통계 종류"><button className={cx({ active: tab === 'detect' })} type="button" role="tab" aria-selected={tab === 'detect'} onClick={() => setTab('detect')}>AI 이상감지</button><button className={cx({ active: tab === 'chat' })} type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>AI 의료 챗봇</button><button type="button" disabled role="tab" aria-selected={false}>AI 안부 말벗 · 정서 분석</button></div></header>
    {tab === 'detect' ? summary.isLoading || records.isLoading ? <Notice>AI 이상감지 통계를 불러오는 중입니다.</Notice> : summary.isError || records.isError || !summary.data || !records.data ? <Notice retry={() => { void summary.refetch(); void records.refetch(); }}>AI 이상감지 통계를 불러오지 못했습니다.</Notice> : <DetectionStats data={summary.data} records={records.data.content} period={period} type={type} onPeriod={setPeriod} onType={setType} /> : <Notice>AI 의료 챗봇 통계는 준비 중입니다.</Notice>}
  </section>;
}

function DetectionStats({ data, records, period, type, onPeriod, onType }: { data: AdminAnomalySummary; records: AdminAnomalyItem[]; period: AdminAnomalyPeriod; type: 'ALL' | 'FIRE' | 'FALL' | 'WEAPON'; onPeriod: (value: AdminAnomalyPeriod) => void; onType: (value: 'ALL' | 'FIRE' | 'FALL' | 'WEAPON') => void }) {
  const review = data.review;
  const answered = data.total - review.pending;
  const falseAlarmRate = answered > 0 ? Math.round(review.falseAlarm / answered * 100) : null;
  const cards: Array<[string, number | null, 'warn' | 'brand' | 'care' | undefined]> = [['감지', data.total, undefined], ['위험', review.real, 'warn'], ['오탐', review.falseAlarm, 'care'], ['미판정', review.pending, undefined], ['AI 오탐률', falseAlarmRate, 'brand']];
  return <>
    <p className={cx('description')}>보호자가 ‘실제 위험 / 괜찮아요’로 판정한 결과로 오탐률을 계산해요</p>
    <div className={cx('subTabs')} role="tablist" aria-label="이상감지 조회 기간">{([['TODAY','오늘'],['THIS_WEEK','이번 주'],['THIS_MONTH','이번 달']] as const).map(([value,label]) => <button key={value} className={cx({ on: period === value })} type="button" onClick={() => onPeriod(value)}>{label}</button>)}</div>
    <section className={cx('statNums')} aria-label="오늘 이상감지 통계">{cards.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong className={cx(tone)}>{label === 'AI 오탐률' ? value === null ? '—' : `${value}%` : formatCount(value)}</strong></div>)}</section>
    <div className={cx('subTabs')} role="tablist" aria-label="감지 유형">{([['ALL','전체'],['FALL','낙상'],['FIRE','화재'],['WEAPON','흉기']] as const).map(([value,label]) => <button key={value} className={cx({ on: type === value })} type="button" onClick={() => onType(value)}>{label} {data.byType.find(item => item.type === value)?.count ?? '—'}</button>)}</div><section className={cx('listCard')}><ListHeading title="이상감지 기록" note="상황 기준 · 최신순" /><StatRows rows={records.map(item => [`${item.detectedTypeLabel} · ${item.wardName ?? '탈퇴한 회원'} · ${item.cameraLabel ?? '삭제된 카메라'}`, item.eventCount, item.reviewStatus === 'REAL' ? 'warn' : item.reviewStatus === 'FALSE_ALARM' ? 'care' : 'mute'])} /></section>
  </>;
}

/* 챗봇 집계 API는 최신 명세에서 준비 중으로 전환됐다.
function ChatStats({ data }: { data: AdminChatStats }) {
  const statCards: Array<{ label: string; value: number | null; tone?: 'brand' | 'warn' | 'care' }> = [
    { label: '기간 내 대화', value: data.totalChats }, { label: '쓴 사람', value: data.users }, { label: '예약 완료', value: data.reservationCompleted, tone: 'brand' }, { label: '119 안내', value: data.emergencyGuidance, tone: 'warn' }, { label: '대체 응답', value: data.fallbackReplies, tone: 'care' },
  ];
  return <>
    <section className={cx('statNums')} aria-label="AI 의료 챗봇 집계 요약">{statCards.map(card => <div key={card.label}><span>{card.label}</span><strong className={cx(card.tone)}>{formatCount(card.value)}</strong></div>)}</section>
    <div className={cx('listGrid')}>
      <section className={cx('listCard')}><ListHeading title="상담 사용자 역할" note="기간 내 역할 기준" /><StatRows rows={[["보호자", data.byRole.guardian, 'brand'], ['피보호자', data.byRole.ward, 'safe'], ['역할 미기록', data.byRole.unknown, 'mute']]} /></section>
      <section className={cx('listCard')}><ListHeading title="상담 경로" note="AI가 분류한 상담 목적 기준" /><StatRows rows={[["병원 예약", data.byRoute.reservation, 'brand'], ['증상 상담', data.byRoute.symptom, 'sun'], ['일반 상담', data.byRoute.general, 'safe'], ['분류 미확인', data.byRoute.unknown, 'mute']]} /></section>
    </div>
    <section className={cx('listCard', 'dailyCard')}><ListHeading title="일별 상담 수" note={`${data.from} ~ ${data.to}`} /><DailyChart daily={data.daily} /></section>
    <p className={cx('generatedAt')}>AI 집계 시각 {formatGeneratedAt(data.generatedAt)} · 같은 기간은 60초 동안 같은 결과를 제공합니다.</p>
  </>;
}

function ListHeading({ title, note }: { title: string; note: string }) { return <header className={cx('listHead')}><span>{title}</span><small>{note}</small></header>; }

function StatRows({ rows }: { rows: Array<[string, number | null, 'brand' | 'safe' | 'sun' | 'mute' | 'warn' | 'care']> }) {
  return <div className={cx('statRows')}>{rows.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong className={cx(tone)}>{formatCount(value)}</strong></div>)}</div>;
}

function DailyChart({ daily }: { daily: AdminChatStats['daily'] }) {
  const width = 520; const height = 150; const left = 18; const right = 18; const top = 20; const bottom = 30;
  const numeric = daily.filter(item => item.totalChats !== null) as Array<{ date: string; totalChats: number }>;
  if (numeric.length === 0) return <div className={cx('chartEmpty')}>AI가 일별 상담 수를 집계하지 못했습니다.</div>;
  const max = Math.max(1, ...numeric.map(item => item.totalChats));
  const x = (index: number) => left + index * (width - left - right) / Math.max(1, daily.length - 1);
  const y = (value: number) => top + (max - value) / max * (height - top - bottom);
  const points = daily.flatMap((item, index) => item.totalChats === null ? [] : [`${x(index)},${y(item.totalChats)}`]).join(' ');
  return <div className={cx('chartWrap')}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="일별 AI 의료 챗봇 상담 수"><line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} /><polyline points={points} /><>{daily.map((item, index) => item.totalChats === null ? null : <g key={item.date}><circle cx={x(index)} cy={y(item.totalChats)} r="3.5" /><text x={x(index)} y={height - 10} textAnchor="middle">{item.date.slice(5).replace('-', '/')}</text></g>)}</></svg></div>;
}
*/

function ListHeading({ title, note }: { title: string; note: string }) { return <header className={cx('listHead')}><span>{title}</span><small>{note}</small></header>; }
function StatRows({ rows }: { rows: Array<[string, number | null, 'mute' | 'warn' | 'care']> }) { return <div className={cx('statRows')}>{rows.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong className={cx(tone)}>{formatCount(value)}</strong></div>)}</div>; }

function Notice({ children, retry }: { children: string; retry?: () => void }) { return <section className={cx('notice')} aria-live="polite"><p>{children}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</section>; }
