import type { Metadata } from 'next';
import { AdminDevicesContent } from '../_components/AdminDevicesContent';

export const metadata: Metadata = { title: '디바이스 관리' };

export default function AdminDevicesPage() {
  return <AdminDevicesContent />;
}
