import type { Metadata } from 'next';
import SignupContent from './_components/SignupContent';

export const metadata: Metadata = { title: '회원가입' };

type SignupPageProps = {
  searchParams: Promise<{
    // '1'이면 카카오 가입. 카카오 ID·이메일은 주소에 싣지 않는다(이 탭의 sessionStorage 로 넘긴다)
    kakao?: string;
    returnTo?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = await searchParams;

  return <SignupContent searchParams={resolvedSearchParams} />;
}
