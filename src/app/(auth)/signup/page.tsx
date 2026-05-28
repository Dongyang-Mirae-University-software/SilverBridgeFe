import SignupContent from './_components/SignupContent';

type SignupPageProps = {
  searchParams: Promise<{
    kakaoId?: string;
    email?: string;
    name?: string;
    profileImageUrl?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = await searchParams;

  return <SignupContent searchParams={resolvedSearchParams} />;
}
