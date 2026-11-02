'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import { AdminChatStats } from '@/service/interface/admin/aiStats';
import { adminChatStatsQueryOptions } from '@/service/query/admin';
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
  const [range, setRange] = useState(getInitialRange);
  const validRange = isValidRange(range.from, range.to);
  const stats = useQuery({ ...adminChatStatsQueryOptions(range), enabled: validRange });
  const applyPreset = (days: number) => {
    const to = getKstDateString();
    setRange({ from: shiftDate(to, -(days - 1)), to });
  };

  return <section className={cx('page')}>
    <header className={cx('heading')}><div><h1>AI 통계</h1><p>AI 의료 챗봇 집계</p></div></header>
    <section className={cx('filterCard')} aria-label="AI 의료 챗봇 통계 조회 기간">
      <div className={cx('serviceLabel')}><span><Icon name="messageCircle" size={17} /></span><div><strong>AI 의료 챗봇</strong><p>상담 내용과 사용자 식별 정보는 포함하지 않습니다.</p></div></div>
      <div className={cx('rangeControls')}>
        <div className={cx('quickRange')}><button type="button" onClick={() => applyPreset(7)}>최근 7일</button><button type="button" onClick={() => applyPreset(30)}>최근 30일</button></div>
        <label>시작일<input type="date" min="2000-01-01" max="2999-12-31" value={range.from} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} /></label>
        <span className={cx('rangeDash')}>~</span>
        <label>종료일<input type="date" min="2000-01-01" max="2999-12-31" value={range.to} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} /></label>
      </div>
      {!validRange && <p className={cx('rangeError')}>시작일과 종료일을 올바르게 입력해 주세요. 조회 기간은 최대 31일입니다.</p>}
    </section>
    {!validRange ? null : stats.isLoading ? <Notice>AI 의료 챗봇 통계를 불러오는 중입니다.</Notice> : stats.isError || !stats.data ? <Notice retry={() => void stats.refetch()}>{getErrorMessage(stats.error)}</Notice> : <ChatStats data={stats.data} />}
  </section>;
}

function ChatStats({ data }: { data: AdminChatStats }) {
  const statCards: Array<{ label: string; value: number | null; icon: IconName; tone: 'brand' | 'safe' | 'sun' | 'danger' | 'mute'; detail?: string }> = [
    { label: '전체 상담', value: data.totalChats, icon: 'messageCircle', tone: 'brand' },
    { label: '상담 사용자', value: data.users, icon: 'users', tone: 'safe', detail: '역할 미기록 포함' },
    { label: '예약 완료', value: data.reservationCompleted, icon: 'calendar', tone: 'brand' },
    { label: '119 안내', value: data.emergencyGuidance, icon: 'alert', tone: 'danger', detail: '고위험 판정 기준' },
    { label: '대체 응답', value: data.fallbackReplies, icon: 'messageCircle', tone: 'sun' },
  ];
  return <>
    <div className={cx('summaryGrid')} aria-label="AI 의료 챗봇 집계 요약">{statCards.map(card => <article className={cx('summaryCard')} key={card.label}><span className={cx('summaryLabel')}><i className={cx('summaryIcon', card.tone)}><Icon name={card.icon} size={16} /></i>{card.label}</span><strong className={cx(card.tone)}>{formatCount(card.value)}</strong>{card.detail && <small>{card.detail}</small>}</article>)}</div>
    <div className={cx('grid')}>
      <section className={cx('card', 'dailyCard')}><CardHeading title="일별 상담 수" note={`${data.from} ~ ${data.to}`} /><DailyChart daily={data.daily} /></section>
      <section className={cx('card')}><CardHeading title="상담 사용자 역할" note="unknown은 역할이 기록되지 않은 과거 상담입니다." /><Breakdown rows={[['보호자', data.byRole.guardian, 'brand'], ['피보호자', data.byRole.ward, 'safe'], ['역할 미기록', data.byRole.unknown, 'mute']]} /></section>
      <section className={cx('card')}><CardHeading title="상담 경로" note="AI가 분류한 상담 목적 기준입니다." /><Breakdown rows={[['병원 예약', data.byRoute.reservation, 'brand'], ['증상 상담', data.byRoute.symptom, 'sun'], ['일반 상담', data.byRoute.general, 'safe'], ['분류 미확인', data.byRoute.unknown, 'mute']]} /></section>
    </div>
    <p className={cx('generatedAt')}>AI 집계 시각 {formatGeneratedAt(data.generatedAt)} · 같은 기간은 60초 동안 같은 결과를 제공합니다.</p>
  </>;
}

function CardHeading({ title, note }: { title: string; note: string }) { return <header className={cx('cardHeading')}><h2>{title}</h2><p>{note}</p></header>; }

function Breakdown({ rows }: { rows: Array<[string, number | null, 'brand' | 'safe' | 'sun' | 'mute']> }) {
  return <div className={cx('breakdown')}>{rows.map(([label, value, tone]) => <div key={label}><span><i className={cx(tone)} />{label}</span><strong>{formatCount(value)}</strong></div>)}</div>;
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
