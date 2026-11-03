import type { Metadata } from 'next';
import { AdminHospitalsContent } from '../_components/AdminHospitalsContent';

export const metadata: Metadata = { title: '제휴 병원' };

export default function AdminHospitalsPage() {
  return <AdminHospitalsContent />;
}
