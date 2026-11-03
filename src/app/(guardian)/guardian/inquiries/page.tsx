import type { Metadata } from 'next';
import { GuardianInquiryContent } from './_components/GuardianInquiryContent';

export const metadata: Metadata = { title: '문의하기' };

export default function GuardianInquiriesPage() {
  return <GuardianInquiryContent />;
}
