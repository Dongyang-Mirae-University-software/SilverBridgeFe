import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { cx } from './styles';

export function FeaturePanel({ title, role }: { title: string; role: AuthRole }) {
  return (
    <section className={cx('featurePanel')}>
      <span className={cx('eyebrow')}>{getRoleLabel(role)} 전용 기능</span>
      <h2>{title}</h2>
      <p>이 화면은 역할별 route group 안에 분리되어 있습니다. 이후 실제 API와 상세 기능을 이 페이지 단위로 연결하면 됩니다.</p>
    </section>
  );
}
