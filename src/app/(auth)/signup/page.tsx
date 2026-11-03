import type { Metadata } from 'next';
import SignupContent from './_components/SignupContent';

export const metadata: Metadata = { title: '회원가입' };

type SignupPageProps = {
  searchParams: Promise<{
    kakaoId?: string;
    email?: string;
    profileImageUrl?: string;
    returnTo?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = await searchParams;

  return <SignupContent searchParams={resolvedSearchParams} />;
}
