import PageLayout from '@/components/layout/PageLayout';
import { GuardianInquiryContent } from './_components/GuardianInquiryContent';

export default function GuardianInquiriesPage() {
  return (
    <PageLayout title="문의하기" description="궁금한 점이나 불편한 사항을 알려주세요">
      <GuardianInquiryContent />
    </PageLayout>
  );
}
