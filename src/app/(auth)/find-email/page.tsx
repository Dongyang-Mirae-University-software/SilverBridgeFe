import type { Metadata } from 'next';
import FindEmailContent from './_components/FindEmailContent';

export const metadata: Metadata = { title: '아이디 찾기' };

export default function FindEmailPage() {
  return <FindEmailContent />;
}
