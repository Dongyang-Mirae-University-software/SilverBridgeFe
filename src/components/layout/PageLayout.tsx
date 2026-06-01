import { ReactNode } from 'react';

import classNames from 'classnames/bind';

import styles from './PageLayout.module.css';

const cx = classNames.bind(styles);

interface PageLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

const DEFAULT_DESCRIPTION = '아직 상세 화면을 준비 중입니다.';

export default function PageLayout({ children, description, title }: PageLayoutProps) {
  return (
    <section className={cx('pageLayout')} aria-labelledby="page-layout-title">
      <header className={cx('header')}>
        <div>
          <h1 id="page-layout-title">{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </header>

      <div className={cx(children ? 'content' : 'emptyContent')}>
        {children ?? (
          <div className={cx('emptyState')}>
            <strong>{title}</strong>
            <span>{description ?? DEFAULT_DESCRIPTION}</span>
          </div>
        )}
      </div>
    </section>
  );
}
