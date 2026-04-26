import SignupContent from './_components/SignupContent';

type SignupPageProps = {
  searchParams: {
    kakaoId?: string;
    email?: string;
    name?: string;
    profileImageUrl?: string;
  };
};

export default function SignupPage({ searchParams }: SignupPageProps) {
  return <SignupContent searchParams={searchParams} />;
}
