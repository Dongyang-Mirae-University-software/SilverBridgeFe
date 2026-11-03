import type { Metadata } from 'next';
import { GuardianWardsListPanel } from './_components/GuardianWardsListPanel';

export const metadata: Metadata = { title: '연결된 가족' };

export default function GuardianWardsPage() {
  return <GuardianWardsListPanel />;
}
