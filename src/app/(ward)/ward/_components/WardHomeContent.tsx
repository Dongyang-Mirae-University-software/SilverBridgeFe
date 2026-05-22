import Link from 'next/link';

import { WARD_ACTIONS } from '@/constants/dashboard';
import { cx } from '@/components/layout/dashboard/styles';

export function WardHomeContent() {
  return (
    <div className={cx('wardHomeActions')}>
      <section className={cx('quickGrid', 'wardHomeActionGrid')}>
        {WARD_ACTIONS.map(action => (
          <Link key={action.href} className={cx('actionCard')} href={action.href}>
            <strong>{action.label}</strong>
          </Link>
        ))}
      </section>
    </div>
  );
}
