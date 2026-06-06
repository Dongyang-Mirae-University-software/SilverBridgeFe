import { ChangeEvent, FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import styles from './SignupForm.module.css';
const cx = classNames.bind(styles);import SignupBasicInfoStep from './SignupBasicInfoStep';
import SignupPhoneVerificationStep from './SignupPhoneVerificationStep';
import { CommonModal } from '@/components/CommonModal';
import useSignupForm, { type KakaoSignupData } from '@/hooks/useSignupForm';
import { getPhoneDigits } from '@/lib/format/phone';
import { openKakaoPostcode } from '@/lib/postcode/kakaoPostcode';
import { signupEmailCheck, signupSmsSend, signupSmsVerify } from '@/service/api/auth';


interface Props {
  step: number;
  onStepChange: (step: number) => void;
  kakaoData?: KakaoSignupData;
}

function getVerificationNonce(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;
  const result = (nestedData ?? data ?? response) as { verificationNonce?: unknown };

  return typeof result.verificationNonce === 'string' ? result.verificationNonce : '';
}

export default function SignupForm({ step, onStepChange, kakaoData }: Props) {
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
  } = useSignupForm({ kakaoData });

  const [isEmailCheck, setIsEmailCheck] = useState(Boolean(kakaoData));
  const [checkedEmail, setCheckedEmail] = useState(kakaoData?.email.trim() ?? '');
  const [isEmailTouched, setIsEmailTouched] = useState(false);
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
    onError: error => {
      setIsEmailCheck(false);
      setCheckedEmail('');
      setEmailCheckErrorMsg((error as Error).message || '이메일이 중복되었습니다.');
    },
    onSuccess: (_response, variables) => {
      setIsEmailCheck(true);
      setCheckedEmail(variables.email.trim());
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
    setIsEmailTouched(true);
    emailCheckMutate({ email: getValues('email') });
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
    (isEmailTouched && !isEmailVerified && !isEmailCheckPending && !!getValues('email').length);
  const emailErrorText = emailError
    ? (errors.email?.message ?? (emailCheckErrorMsg || '이메일이 중복되었습니다.'))
    : undefined;
  const isStepOneValid =
    allValues.name.trim().length >= 2 &&
    allValues.email.trim().length > 0 &&
    (isKakaoSignup || isEmailVerified) &&
    (isKakaoSignup || allValues.password.trim().length > 0) &&
    (isKakaoSignup || allValues.passwordCheck.trim().length > 0) &&
    allValues.birthDate.trim().length > 0 &&
    allValues.postcode.trim().length > 0 &&
    allValues.address.trim().length > 0 &&
    allValues.addressDetail.trim().length > 0 &&
    !errors.email &&
    (isKakaoSignup || !errors.password) &&
    (isKakaoSignup || !errors.passwordCheck) &&
    !errors.name &&
    !errors.birthDate &&
    !errors.postcode &&
    !errors.address;

  const handleNextStep = () => {
    if (isStepOneValid) onStepChange(2);
  };

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
      <form className={cx('container')} onSubmit={handleSignupSubmit}>
        {step === 1 && (
          <SignupBasicInfoStep
            allValues={allValues}
            errors={errors}
            emailError={Boolean(emailError)}
            emailErrorText={emailErrorText}
            isStepOneValid={isStepOneValid}
            isKakaoSignup={isKakaoSignup}
            register={register}
            nameField={register('name', textRules('이름을 입력하세요.', 2))}
            emailField={register('email', emailRules('이메일 형식이 올바르지 않습니다.'))}
            passwordField={register('password', isKakaoSignup ? undefined : passwordRules('비밀번호 형식이 올바르지 않습니다.'))}
            passwordCheckField={register('passwordCheck', isKakaoSignup ? undefined : passwordCheckRules('비밀번호가 일치하지 않습니다.'))}
            birthDateField={register('birthDate', textRules('생년월일을 입력하세요.', 1))}
            postcodeField={register('postcode', textRules('우편번호를 입력하세요.', 1))}
            addressField={register('address', textRules('주소를 입력하세요.', 1))}
            addressDetailField={register('addressDetail', textRules('상세주소를 입력하세요.', 1))}
            onAddressSearch={handleAddressSearch}
            onEmailCheck={handleEmailCheck}
            onNextStep={handleNextStep}
          />
        )}

        {step === 2 && (
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
            onPrevStep={() => onStepChange(1)}
            onSmsVerify={handleSmsVerify}
          />
        )}
      </form>

      {signupError && <CommonModal type="error" title="회원가입 실패" message={signupError} onClose={clearSignupError} />}
    </>
  );
}
