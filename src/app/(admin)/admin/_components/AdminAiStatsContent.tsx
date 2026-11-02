'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { AdminChatStats } from '@/service/interface/admin/aiStats';
import { adminChatStatsQueryOptions } from '@/service/query/admin';
import { getAdminSafetyDashboard } from '@/service/api/admin/dashboard';
import { AdminSafetyDashboard } from '@/service/interface/admin/dashboard';
import styles from './AdminAiStatsContent.module.css';

const cx = classNames.bind(styles);

function getKstDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shiftDate(value: string, amount: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function getInitialRange() {
  const to = getKstDateString();
  return { from: shiftDate(to, -6), to };
}

function isValidRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  return !Number.isNaN(fromTime) && !Number.isNaN(toTime) && from <= to && (toTime - fromTime) / 86_400_000 <= 30;
}

function formatCount(value: number | null | undefined, suffix = '건') {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('ko-KR')}${suffix}`;
}

function formatGeneratedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(date);
}

function getErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 503) return 'AI 통계 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (error.response?.status === 504) return 'AI 통계 응답이 오래 걸리고 있습니다. 다시 시도해 주세요.';
    if (error.response?.status === 429) return '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.response?.status === 400) return '조회 기간은 최대 31일까지 선택할 수 있습니다.';
  }
  return 'AI 의료 챗봇 통계를 불러오지 못했습니다.';
}

export function AdminAiStatsContent() {
  const [tab, setTab] = useState<'detect' | 'chat'>('detect');
  const [range, setRange] = useState(getInitialRange);
  const validRange = isValidRange(range.from, range.to);
  const stats = useQuery({ ...adminChatStatsQueryOptions(range), enabled: validRange && tab === 'chat' });
  const detection = useQuery({ queryKey: ['admin-dashboard', 'safety', 'ai-stats'], queryFn: getAdminSafetyDashboard, enabled: tab === 'detect', staleTime: 60_000, refetchOnWindowFocus: false, retry: false });
  const applyPreset = (days: number) => {
    const to = getKstDateString();
    setRange({ from: shiftDate(to, -(days - 1)), to });
  };

  return <section className={cx('page')}>
    <header className={cx('pageHead')}><h1>AI 통계</h1><div className={cx('aiTabs')} role="tablist" aria-label="AI 통계 종류"><button className={cx({ active: tab === 'detect' })} type="button" role="tab" aria-selected={tab === 'detect'} onClick={() => setTab('detect')}>AI 이상감지</button><button className={cx({ active: tab === 'chat' })} type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>AI 의료 챗봇</button><button type="button" disabled role="tab" aria-selected={false}>AI 안부 말벗 · 정서 분석</button></div></header>
    {tab === 'detect' ? detection.isLoading ? <Notice>AI 이상감지 통계를 불러오는 중입니다.</Notice> : detection.isError || !detection.data ? <Notice retry={() => void detection.refetch()}>AI 이상감지 통계를 불러오지 못했습니다.</Notice> : <DetectionStats data={detection.data} /> : <><section className={cx('rangeCard')} aria-label="AI 의료 챗봇 통계 조회 기간">
      <div className={cx('rangeHeading')}><Icon name="calendar" size={16} /><span>조회 기간</span></div>
      <div className={cx('rangeControls')}>
        <div className={cx('quickRange')}><button type="button" onClick={() => applyPreset(7)}>최근 7일</button><button type="button" onClick={() => applyPreset(30)}>최근 30일</button></div>
        <label>시작일<input type="date" min="2000-01-01" max="2999-12-31" value={range.from} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} /></label>
        <span className={cx('rangeDash')}>~</span>
        <label>종료일<input type="date" min="2000-01-01" max="2999-12-31" value={range.to} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} /></label>
      </div>
      {!validRange && <p className={cx('rangeError')}>시작일과 종료일을 올바르게 입력해 주세요. 조회 기간은 최대 31일입니다.</p>}
    </section>{!validRange ? null : stats.isLoading ? <Notice>AI 의료 챗봇 통계를 불러오는 중입니다.</Notice> : stats.isError || !stats.data ? <Notice retry={() => void stats.refetch()}>{getErrorMessage(stats.error)}</Notice> : <ChatStats data={stats.data} />}</>}
  </section>;
}

function DetectionStats({ data }: { data: AdminSafetyDashboard }) {
  const review = data.todayAnomaly.review;
  const answered = data.todayAnomaly.total - review.pending;
  const falseAlarmRate = answered > 0 ? Math.round(review.falseAlarm / answered * 100) : null;
  const typeLabel: Record<AdminSafetyDashboard['todayAnomaly']['byType'][number]['detectedType'], string> = { FALL: '낙상', FIRE: '화재', WEAPON: '흉기' };
  const cards: Array<[string, number | null, 'warn' | 'brand' | 'care' | undefined]> = [['감지', data.todayAnomaly.total, undefined], ['위험', review.real, 'warn'], ['오탐', review.falseAlarm, 'care'], ['미판정', review.pending, undefined], ['AI 오탐률', falseAlarmRate, 'brand']];
  return <>
    <p className={cx('description')}>보호자가 ‘실제 위험 / 괜찮아요’로 판정한 결과로 오탐률을 계산해요</p>
    <div className={cx('subTabs')} role="tablist" aria-label="이상감지 조회 기간"><button className={cx('on')} type="button">오늘</button><button type="button" disabled>이번 주</button><button type="button" disabled>이번 달</button></div>
    <section className={cx('statNums')} aria-label="오늘 이상감지 통계">{cards.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong className={cx(tone)}>{label === 'AI 오탐률' ? value === null ? '—' : `${value}%` : formatCount(value)}</strong></div>)}</section>
    <div className={cx('listGrid')}><section className={cx('listCard')}><ListHeading title="유형별 감지" note="유형별 오탐률 집계 API가 제공되면 함께 표시됩니다." /><StatRows rows={data.todayAnomaly.byType.map(item => [typeLabel[item.detectedType], item.count, item.detectedType === 'FALL' ? 'brand' : item.detectedType === 'FIRE' ? 'sun' : 'safe'])} /></section><section className={cx('listCard')}><ListHeading title="판정 결과" note="오늘 감지된 상황 기준" /><StatRows rows={[["위험", review.real, 'warn'], ['오탐', review.falseAlarm, 'care'], ['미판정', review.pending, 'mute']]} /></section></div>
  </>;
}

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

function Notice({ children, retry }: { children: string; retry?: () => void }) { return <section className={cx('notice')} aria-live="polite"><p>{children}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</section>; }
