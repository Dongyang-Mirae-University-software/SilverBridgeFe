import type { Metadata } from 'next';
import WardSosContent from './_components/WardSosContent';

export const metadata: Metadata = { title: '긴급 전화' };

export default function WardSosPage() {
  return <WardSosContent />;
}
