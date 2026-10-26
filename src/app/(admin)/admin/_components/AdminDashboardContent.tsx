'use client';

import { useState, useSyncExternalStore } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import styles from './AdminDashboardContent.module.css';

const cx = classNames.bind(styles);
const subscribeNothing = () => () => {};

const safetyEvents = [
  { label: '연결이 끊긴 카메라', value: '2대', description: '24시간 넘게 꺼져 있어 감지가 되지 않습니다', alert: true },
  { label: '보호자 미연결 피보호자', value: '3명', description: 'SOS를 눌러도 받을 보호자가 없습니다', alert: true },
  { label: '카메라 미등록 피보호자', value: '5명', description: '이상감지 대상 자체가 아닙니다', alert: false },
  { label: '전달 실패한 알림', value: '2건', description: 'SOS·복약 알림이 보호자에게 전달되지 않았습니다', alert: true },
  { label: '7일 이상 방치된 연결 요청', value: '1건', description: '수락만 하면 미연결이 해소됩니다', alert: false },
];

const anomalyTypes = [
  { label: '낙상', value: 4, color: 'accent' },
  { label: '화재', value: 2, color: 'danger' },
  { label: '흉기', value: 3, color: 'warn' },
];

const gameRows = [
  { label: '짝 맞추기', played: 5, quit: 20, color: 'brand' },
  { label: '낱말 퀴즈', played: 5, quit: 60, color: 'warn' },
  { label: '덧셈 카드', played: 4, quit: 25, color: 'sun' },
  { label: '뺄셈 카드', played: 4, quit: 25, color: 'accent' },
];

const hospitals = [
  { name: '가족가정의학과', department: '가정의학과', joined: '2026-01' },
  { name: '다정한방내과', department: '한방내과', joined: '2025-09' },
  { name: '맑은안과', department: '안과', joined: '2025-08' },
];

export function AdminDashboardContent() {
  const [tab, setTab] = useState<'safety' | 'operations'>('safety');
  // 서버와 하이드레이션 첫 렌더에는 고정 문구를 쓰고, 이후에만 사용자 시간대로 날짜를 조립한다.
  const dateLabel = useSyncExternalStore(
    subscribeNothing,
    () => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()),
    () => '오늘',
  );

  return (
    <div className={cx('dashboard')}>
      <header className={cx('heading')}>
        <h1>대시보드</h1>
        <p>{dateLabel}</p>
      </header>

      <div className={cx('tabs')} role="tablist" aria-label="관리자 대시보드 보기">
        <button className={cx('tab', { active: tab === 'safety' })} type="button" role="tab" aria-selected={tab === 'safety'} onClick={() => setTab('safety')}>안전 현황</button>
        <button className={cx('tab', { active: tab === 'operations' })} type="button" role="tab" aria-selected={tab === 'operations'} onClick={() => setTab('operations')}>운영 현황</button>
      </div>

      {tab === 'safety' ? <SafetyDashboard /> : <OperationsDashboard />}
    </div>
  );
}

function SafetyDashboard() {
  return (
    <div className={cx('stack')}>
      <section className={cx('serviceCard')} aria-label="AI 서비스 상태">
        <div className={cx('sectionTitleRow')}>
          <span className={cx('serviceIcon')}><Icon name="alert" size={18} /></span>
          <h2>AI 서비스 상태</h2>
          <time>1분 전 확인</time>
        </div>
        <div className={cx('serviceGrid')}>
          {['이상감지 (영상 분석)', 'AI 안부 말벗 · 정서 상태 분석', 'AI 의료 챗봇'].map(name => (
            <div className={cx('serviceItem')} key={name}>
              <i />
              <strong>{name}</strong>
              <span>정상</span>
            </div>
          ))}
        </div>
      </section>

      <div className={cx('primaryGrid')}>
        <section className={cx('card')}>
          <div className={cx('cardHeading')}><h2>안전 이벤트</h2><span>확인이 필요한 항목</span></div>
          <div className={cx('eventList')}>
            {safetyEvents.map(event => (
              <article className={cx('event', { alert: event.alert })} key={event.label}>
                <div><strong>{event.label}</strong><p>{event.description}</p></div>
                <b>{event.value}</b>
                <Icon name="chevronRight" size={16} />
              </article>
            ))}
          </div>
        </section>

        <section className={cx('card', 'anomalyCard')}>
          <div className={cx('cardHeading')}><h2>오늘 이상감지</h2><span className={cx('allLink')}>전체 보기 <Icon name="chevronRight" size={13} /></span></div>
          <div className={cx('anomalySummary')}>
            <Donut />
            <div className={cx('legend')}>
              {anomalyTypes.map(item => <div key={item.label}><i className={cx(item.color)} /><span>{item.label}</span><b>{item.value}건</b></div>)}
            </div>
          </div>
          <div className={cx('confidence')}><div><span>평균 AI 신뢰도</span><b>82<small>%</small></b></div><i><em /></i></div>
          <p className={cx('judgeTitle')}>판정</p>
          <div className={cx('judgeGrid')}>
            <div className={cx('danger')}><span>위험 판정</span><b>29<small>%</small><em>2건</em></b></div>
            <div><span>오탐 판정</span><b>71<small>%</small><em>5건</em></b></div>
          </div>
        </section>
      </div>

      <p className={cx('subheading')}>서비스 이용 현황</p>
      <div className={cx('secondaryGrid')}>
        <section className={cx('card', 'mutedCard')}>
          <div className={cx('cardHeading')}><h2>게임별 참여 · 중도 이탈</h2><span className={cx('allLink')}>전체 보기 <Icon name="chevronRight" size={13} /></span></div>
          <p className={cx('participation')}><b>5</b> / 34명 오늘 참여</p>
          <div className={cx('gameList')}>
            {gameRows.map(row => <div key={row.label}><p><span>{row.label}</span><b>{row.played}회</b><em>이탈 {row.quit}%</em></p><i><span className={cx(row.color)} style={{ width: `${100 - row.quit}%` }} /><span className={cx('quit')} style={{ width: `${row.quit}%` }} /></i></div>)}
          </div>
        </section>
        <section className={cx('card', 'mutedCard')}>
          <div className={cx('cardHeading')}><h2>제휴 병원 현황</h2><span className={cx('allLink')}>전체 보기 <Icon name="chevronRight" size={13} /></span></div>
          <div className={cx('hospitalStats')}><div><span>제휴 병원</span><b>6곳</b></div><div><span>최근 제휴</span><b>2026-01</b></div></div>
          <p className={cx('recentTitle')}>최근 등록된 제휴 병원</p>
          <div className={cx('hospitalList')}>{hospitals.map(hospital => <div key={hospital.name}><strong>{hospital.name}</strong><span>{hospital.department}</span><b>{hospital.joined}</b></div>)}</div>
        </section>
      </div>
    </div>
  );
}

function Donut() {
  return (
    <div className={cx('donut')} aria-label="오늘 이상감지 9건">
      <svg viewBox="0 0 36 36" aria-hidden="true"><circle className={cx('track')} cx="18" cy="18" r="15.5" /><circle className={cx('accent')} cx="18" cy="18" r="15.5" pathLength="100" strokeDasharray="44 56" /><circle className={cx('danger')} cx="18" cy="18" r="15.5" pathLength="100" strokeDasharray="22 78" strokeDashoffset="-44" /><circle className={cx('warn')} cx="18" cy="18" r="15.5" pathLength="100" strokeDasharray="34 66" strokeDashoffset="-66" /></svg>
      <div><b>9건</b><span>오늘 감지</span></div>
    </div>
  );
}

function OperationsDashboard() {
  const stats = [['전체 회원', '86명', 'users'], ['연결 대기', '2건', 'users'], ['미처리 문의', '3건', 'messageCircle'], ['카메라 등록', '29 / 34대', 'camera']] as const;
  return <div className={cx('stack')}>
    <div className={cx('statGrid')}>{stats.map(([label, value, icon]) => <section className={cx('stat')} key={label}><span><Icon name={icon} size={16} />{label}</span><b>{value}</b></section>)}</div>
    <div className={cx('operationsGrid')}>
      <section className={cx('card')}><div className={cx('cardHeading')}><h2>회원 구성</h2><span className={cx('allLink')}>전체 보기</span></div><div className={cx('memberTypes')}><div><span>피보호자</span><b>34명</b></div><div><span>보호자</span><b>52명</b></div></div><p className={cx('recentTitle')}>최근 7일 신규 가입</p><div className={cx('trend')} aria-label="최근 7일 신규 가입 추이">{[3, 1, 4, 2, 5, 3, 2].map((value, index) => <span key={index} style={{ height: `${value * 13}px` }}><i>{['토', '일', '월', '화', '수', '목', '금'][index]}</i></span>)}</div></section>
      <section className={cx('card')}><div className={cx('cardHeading')}><h2>처리 대기 항목</h2></div><div className={cx('pendingList')}><div><Icon name="users" size={17} /><span>피보호자 연결 요청</span><b>2건</b></div><div><Icon name="messageCircle" size={17} /><span>오늘 접수된 문의</span><b>3건</b></div><div><Icon name="bell" size={17} /><span>공지사항 임시저장</span><b>1건</b></div></div></section>
    </div>
  </div>;
}
