import { ChangeEvent, FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import SignupAccountStep from './SignupAccountStep';
import SignupProfileStep from './SignupProfileStep';
import SignupPhoneVerificationStep from './SignupPhoneVerificationStep';
import { SignupStepKey } from './signupSteps';
import { CommonModal } from '@/components/CommonModal';
import useSignupForm, { type KakaoSignupData } from '@/hooks/useSignupForm';
import { getPhoneDigits } from '@/utils/format/phone';
import { EMAIL_PATTRERN } from '@/constants/pattern';
import { openKakaoPostcode } from '@/lib/postcode/kakaoPostcode';
import { signupEmailCheck, signupSmsSend, signupSmsVerify } from '@/service/api/auth/auth';

const cx = classNames.bind(styles);

interface Props {
  step: SignupStepKey;
  onNext: () => void;
  onPrev: () => void;
  kakaoData?: KakaoSignupData;
  returnTo?: string;
}

function getVerificationNonce(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;
  const result = (nestedData ?? data ?? response) as { verificationNonce?: unknown };

  return typeof result.verificationNonce === 'string' ? result.verificationNonce : '';
}

export default function SignupForm({ step, onNext, onPrev, kakaoData, returnTo }: Props) {
  const {
    register,
    onSubmit,
    formState: { errors },
    getValues,
    setValue,
    emailRules,
    passwordRules,
    passwordCheckRules,
    phoneRules,
    textRules,
    allValues,
    signupError,
    isKakaoSignup,
    clearSignupError,
    isSignupCompleted,
    goToLogin,
  } = useSignupForm({ kakaoData, returnTo });

  const [isEmailCheck, setIsEmailCheck] = useState(Boolean(kakaoData));
  const [checkedEmail, setCheckedEmail] = useState(kakaoData?.email.trim() ?? '');
  // 중복 확인에 실패한 이메일. 칸 값이 이것과 같을 때만 오류를 보인다(고치는 중엔 지난 결과를 띄우지 않는다)
  const [failedEmail, setFailedEmail] = useState('');
  const [emailCheckErrorMsg, setEmailCheckErrorMsg] = useState('');
  const [isCode, setIsCode] = useState(false);
  const [smsSendErrorMsg, setSmsSendErrorMsg] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [isSmsCheck, setIsSmsCheck] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [smsTimerKey, setSmsTimerKey] = useState(0);
  const currentEmail = allValues.email.trim();
  const currentPhone = getPhoneDigits(allValues.phone);
  const isEmailVerified = isKakaoSignup || (isEmailCheck && checkedEmail === currentEmail);
  const isSmsVerified = isSmsCheck && verifiedPhone === currentPhone && Boolean(allValues.verificationNonce);

  const { mutate: emailCheckMutate, isPending: isEmailCheckPending } = useMutation({
    mutationKey: ['email-check'],
    mutationFn: signupEmailCheck,
    onError: (error, variables) => {
      setIsEmailCheck(false);
      setCheckedEmail('');
      setFailedEmail(variables.email.trim());
      setEmailCheckErrorMsg((error as Error).message || '이메일이 중복되었습니다.');
    },
    onSuccess: (_response, variables) => {
      setIsEmailCheck(true);
      setCheckedEmail(variables.email.trim());
      setFailedEmail('');
      setEmailCheckErrorMsg('');
    },
  });

  const { mutate: smsSendMutate, isPending: isSmsSendPending } = useMutation({
    mutationKey: ['sms-send'],
    mutationFn: signupSmsSend,
    onMutate: () => {
      setSmsSendErrorMsg('');
      setSmsCode('');
      setIsSmsCheck(false);
      setVerifiedPhone('');
      setValue('verificationNonce', '');
    },
    onError: error => {
      setIsCode(false);
      setSmsSendErrorMsg((error as Error).message || '인증번호 발송에 실패했습니다.');
    },
    onSuccess: () => {
      setIsCode(true);
      setSmsTimerKey(key => key + 1);
    },
  });

  const {
    mutate: smsVerifyMutate,
    error: smsVerifyError,
    isPending: isSmsVerifyPending,
  } = useMutation({
    mutationKey: ['sms-verify'],
    mutationFn: signupSmsVerify,
    onMutate: () => {
      setIsSmsCheck(false);
      setVerifiedPhone('');
      setValue('verificationNonce', '');
    },
    onSuccess: (response, variables) => {
      const verificationNonce = getVerificationNonce(response);
      setValue('verificationNonce', verificationNonce);
      setVerifiedPhone(verificationNonce ? variables.phone : '');
      setIsSmsCheck(Boolean(verificationNonce));
    },
  });

  const handleEmailCheck = () => {
    if (isKakaoSignup) return;
    // 형식이 틀린 값은 칸 아래 형식 오류로 충분하다 - 중복 확인 API는 부르지 않는다
    const email = getValues('email').trim();
    if (!EMAIL_PATTRERN.test(email)) return;
    emailCheckMutate({ email });
  };

  const handlePhoneCheck = () => {
    smsSendMutate({ phone: getPhoneDigits(getValues('phone')) });
  };
  const handlePhoneChange = (value: string) => {
    const nextPhone = getPhoneDigits(value);
    setValue('phone', nextPhone, { shouldDirty: true, shouldValidate: true });

    if (verifiedPhone && verifiedPhone !== nextPhone) {
      setIsSmsCheck(false);
      setVerifiedPhone('');
      setValue('verificationNonce', '');
    }
  };

  const handleCode = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '');
    setSmsCode(value.slice(0, 6));
  };

  const handlePhoneReset = () => {
    setIsCode(false);
    setSmsSendErrorMsg('');
    setSmsCode('');
    setIsSmsCheck(false);
    setVerifiedPhone('');
    setValue('phone', '');
    setValue('verificationNonce', '');
  };

  const handleSmsVerify = () => {
    if (smsCode.length !== 6 || isSmsVerifyPending) return;
    smsVerifyMutate({ code: smsCode, phone: getPhoneDigits(getValues('phone')) });
  };

  const emailError =
    (errors.email && allValues.email && allValues.email.trim() !== '') ||
    (!isEmailCheckPending && currentEmail !== '' && failedEmail === currentEmail);
  const emailErrorText = emailError
    ? (errors.email?.message ?? (emailCheckErrorMsg || '이메일이 중복되었습니다.'))
    : undefined;
  const isAccountValid =
    isKakaoSignup ||
    (isEmailVerified &&
      allValues.password.trim().length > 0 &&
      allValues.passwordCheck.trim().length > 0 &&
      !errors.email &&
      !errors.password &&
      !errors.passwordCheck);
  const isProfileValid =
    allValues.name.trim().length >= 2 &&
    allValues.birthDate.trim().length > 0 &&
    allValues.gender.trim().length > 0 &&
    allValues.postcode.trim().length > 0 &&
    allValues.address.trim().length > 0 &&
    allValues.addressDetail.trim().length > 0 &&
    !errors.name &&
    !errors.gender &&
    !errors.birthDate &&
    !errors.postcode &&
    !errors.address;

  const handleSignupSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!isKakaoSignup && !isEmailVerified) {
      event.preventDefault();
      return;
    }

    if (!isSmsVerified) {
      event.preventDefault();
      setIsSmsCheck(false);
      setValue('verificationNonce', '');
      return;
    }

    onSubmit(event);
  };

  const handleAddressSearch = async () => {
    try {
      const { address, postcode } = await openKakaoPostcode();
      setValue('postcode', postcode, { shouldDirty: true, shouldValidate: true });
      setValue('address', address, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      window.alert((error as Error).message || '주소 검색을 불러오지 못했습니다.');
    }
  };

  return (
    <>
      <form method="post" className={cx('container')} onSubmit={handleSignupSubmit}>
        {step === 'account' && (
          <SignupAccountStep
            allValues={allValues}
            errors={errors}
            emailError={Boolean(emailError)}
            emailErrorText={emailErrorText}
            isValid={isAccountValid}
            register={register}
            emailField={register('email', emailRules('이메일 형식이 올바르지 않습니다.'))}
            passwordField={register('password', passwordRules('비밀번호 형식이 올바르지 않습니다.'))}
            passwordCheckField={register('passwordCheck', passwordCheckRules('비밀번호가 일치하지 않습니다.'))}
            onEmailCheck={handleEmailCheck}
            onNext={() => isAccountValid && onNext()}
          />
        )}

        {step === 'profile' && (
          <SignupProfileStep
            allValues={allValues}
            errors={errors}
            isValid={isProfileValid}
            showRoleSelector={isKakaoSignup}
            register={register}
            nameField={register('name', textRules('이름을 입력하세요.', 2))}
            genderField={register('gender', { required: '성별을 선택하세요.' })}
            birthDateValue={allValues.birthDate}
            onBirthDateChange={value => setValue('birthDate', value, { shouldDirty: true, shouldValidate: true })}
            postcodeField={register('postcode', textRules('우편번호를 입력하세요.', 1))}
            addressField={register('address', textRules('주소를 입력하세요.', 1))}
            addressDetailField={register('addressDetail', textRules('상세주소를 입력하세요.', 1))}
            onAddressSearch={handleAddressSearch}
            onNext={() => isProfileValid && onNext()}
            onPrev={isKakaoSignup ? undefined : onPrev}
          />
        )}

        {step === 'phone' && (
          <SignupPhoneVerificationStep
            allValues={allValues}
            errors={errors}
            phoneField={register('phone', phoneRules('전화번호 형식이 올바르지 않습니다.'))}
            smsCode={smsCode}
            smsSendErrorMsg={smsSendErrorMsg}
            smsVerifyError={smsVerifyError}
            isCode={isCode}
            isEmailCheck={isEmailVerified}
            isSmsCheck={isSmsVerified}
            isSmsSendPending={isSmsSendPending}
            isSmsVerifyPending={isSmsVerifyPending}
            smsTimerKey={smsTimerKey}
            onCodeChange={handleCode}
            onPhoneChange={handlePhoneChange}
            onPhoneCheck={handlePhoneCheck}
            onPhoneReset={handlePhoneReset}
            onPrevStep={onPrev}
            onSmsVerify={handleSmsVerify}
          />
        )}
      </form>

      {signupError && (
        <CommonModal type="error" title="회원가입 실패" message={signupError} onClose={clearSignupError} />
      )}
      {isSignupCompleted && (
        <CommonModal
          type="success"
          title="회원가입이 완료되었습니다"
          message="가입한 이메일과 비밀번호로 로그인해주세요."
          primaryButton={{ text: '로그인하기', onClick: goToLogin }}
          onClose={goToLogin}
        />
      )}
    </>
  );
}
