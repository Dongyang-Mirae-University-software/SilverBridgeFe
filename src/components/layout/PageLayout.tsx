import { ReactNode } from 'react';

import styles from './PageLayout.module.css';

interface PageLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

const DEFAULT_DESCRIPTION = '아직 상세 화면을 준비 중입니다.';

export default function PageLayout({ children, description, title }: PageLayoutProps) {
  return (
    <section className={styles.pageLayout} aria-labelledby="page-layout-title">
      <header className={styles.header}>
        <div>
          <h1 id="page-layout-title">{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </header>

      <div className={children ? styles.content : styles.emptyContent}>
        {children ?? (
          <div className={styles.emptyState}>
            <strong>{title}</strong>
            <span>{description ?? DEFAULT_DESCRIPTION}</span>
          </div>
        )}
      </div>
    </section>
  );
}
