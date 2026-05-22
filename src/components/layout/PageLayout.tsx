import { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return <>{children}</>;
}
