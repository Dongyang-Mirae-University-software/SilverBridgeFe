import type { Metadata } from 'next';
import { AdminInquiryContent } from '../_components/AdminInquiryContent';

export const metadata: Metadata = { title: '고객센터' };

export default function AdminInquiriesPage() {
  return <AdminInquiryContent />;
}
