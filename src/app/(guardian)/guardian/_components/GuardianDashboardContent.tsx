import { GUARDIAN_STATS } from '@/app/constant/dashboard';
import { cx } from '@/app/_common/layout/dashboard/styles';

export function GuardianDashboardContent() {
  return (
    <div className={cx('contentGrid')}>
      <section className={cx('heroCard')}>
        <span className={cx('eyebrow')}>보호자 대시보드</span>
        <h2>피보호자 상태와 이상감지 현황을 한눈에 확인하세요.</h2>
        <p>위험 신호, 정서 상태, 복약 일정, 병원 예약을 보호자 기준으로 정리했습니다.</p>
      </section>

      <section className={cx('statGrid')}>
        {GUARDIAN_STATS.map(stat => (
          <div key={stat.label} className={cx('statCard')}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.state}</small>
          </div>
        ))}
      </section>

      <section className={cx('wideCard')}>
        <div>
          <span className={cx('eyebrow')}>최근 알림</span>
          <h3>박영희 님의 낙상 의심 알림이 1건 있습니다.</h3>
        </div>
        <div className={cx('statusList')}>
          <span>낙상 의심 · 오늘 09:12</span>
          <span>복약 완료 · 오늘 08:10</span>
          <span>정서 상태 안정 · 어제</span>
        </div>
      </section>
    </div>
  );
}
