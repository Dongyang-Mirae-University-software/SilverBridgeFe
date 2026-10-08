import classNames from 'classnames/bind';

import { WardGuardianActiveSection } from './WardGuardianActiveSection';
import { WardGuardianPendingSection } from './WardGuardianPendingSection';
import styles from './WardGuardiansPanel.module.css';

const cx = classNames.bind(styles);

export function WardGuardiansPanel() {
  return (
    <section className={cx('connectionPage')}>
      <WardGuardianActiveSection />
      <WardGuardianPendingSection />
    </section>
  );
}
