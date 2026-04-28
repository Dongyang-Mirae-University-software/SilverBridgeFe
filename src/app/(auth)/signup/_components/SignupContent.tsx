'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import KakaoSignupForm from './KakaoSignupForm';
import { useRouter } from 'next/navigation';

const cx = classNames.bind(styles);

type SignupContentProps = {
  searchParams: {
    kakaoId?: string;
    email?: string;
    name?: string;
    profileImageUrl?: string;
  };
};

export default function SignupContent({ searchParams }: SignupContentProps) {
  const router = useRouter();
  const kakaoId = searchParams.kakaoId;
  const email = searchParams.email;
  const name = searchParams.name;
  const profileImageUrl = searchParams.profileImageUrl;

  const isKakao = Boolean(kakaoId && email && name);

  const kakaoData = isKakao
    ? {
        kakaoId: kakaoId!,
        email: email!,
        name: name!,
        profileImageUrl: profileImageUrl || undefined,
      }
    : undefined;

  return (
    <section className={cx('container')}>
      <div className={cx('panel')}>
        <div className={cx('header')}>
          <p className={cx('eyebrow')}>Silver Bridge</p>
          <h1 className={cx('title')}>회원가입</h1>
          <p className={cx('description')}>안전한 회원가입을 위해 필요한 정보를 입력해주세요.</p>
        </div>

        <div className={cx('content')}>
          {isKakao && kakaoData ? <KakaoSignupForm kakaoData={kakaoData} /> : <SignupForm />}
        </div>

        <button className={cx('backButton')} type="button" onClick={() => router.push('/login')}>
          돌아가기
        </button>
      </div>
    </section>
  );
}
