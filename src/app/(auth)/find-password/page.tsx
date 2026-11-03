import type { Metadata } from 'next';
import FindPasswordContent from './_components/FindPasswordContent';

export const metadata: Metadata = { title: '비밀번호 찾기' };

export default function FindPasswordPage() {
  return <FindPasswordContent />;
}