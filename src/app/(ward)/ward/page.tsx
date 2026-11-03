import type { Metadata } from 'next';
import { WardHomeContent } from './_components/WardHomeContent';

export const metadata: Metadata = { title: '홈' };

export default function WardPage() {
  return <WardHomeContent />;
}
