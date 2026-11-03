import type { Metadata } from 'next';
import { AdminMembersContent } from '../_components/AdminMembersContent';

export const metadata: Metadata = { title: '회원 관리' };

export default function AdminMembersPage() {
  return <AdminMembersContent />;
}
