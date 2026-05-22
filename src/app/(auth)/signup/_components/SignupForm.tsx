import classNames from 'classnames/bind';
import { ChangeEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import styles from './SignupForm.module.css';
import SignupBasicInfoStep from './SignupBasicInfoStep';
import SignupErrorPopup from './SignupErrorPopup';
import SignupPhoneVerificationStep from './SignupPhoneVerificationStep';
import useSignupForm from '@/hooks/useSignupForm';
import { signupEmailCheck, signupSmsSend, signupSmsVerify } from '@/service/api/auth';

const cx = classNames.bind(styles);

interface Props {
  step: number;
  onStepChange: (step: number) => void;
}

function getVerificationNonce(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;
  const result = (nestedData ?? data ?? response) as { verificationNonce?: unknown };

  return typeof result.verificationNonce === 'string' ? result.verificationNonce : '';
}

export default function SignupForm({ step, onStepChange }: Props) {
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
    clearSignupError,
  } = useSignupForm();

  const [isEmailCheck, setIsEmailCheck] = useState(false);
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [emailCheckErrorMsg, setEmailCheckErrorMsg] = useState('');
  const [isCode, setIsCode] = useState(false);
  const [smsSendErrorMsg, setSmsSendErrorMsg] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [isSmsCheck, setIsSmsCheck] = useState(false);

  const { mutate: emailCheckMutate, isPending: isEmailCheckPending } = useMutation({
    mutationKey: ['email-check'],
    mutationFn: signupEmailCheck,
    onError: error => {
      setIsEmailCheck(false);
      setEmailCheckErrorMsg((error as Error).message || '이메일이 중복되었습니다.');
    },
    onSuccess: () => {
      setIsEmailCheck(true);
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
      setValue('verificationNonce', '');
    },
    onError: error => {
      setIsCode(false);
      setSmsSendErrorMsg((error as Error).message || '인증번호 발송에 실패했습니다.');
    },
    onSuccess: () => setIsCode(true),
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
      setValue('verificationNonce', '');
    },
    onSuccess: response => {
      const verificationNonce = getVerificationNonce(response);
      setValue('verificationNonce', verificationNonce);
      setIsSmsCheck(Boolean(verificationNonce));
    },
  });

  const handleEmailCheck = () => {
    setIsEmailTouched(true);
    emailCheckMutate({ email: getValues('email') });
  };

  const handlePhoneCheck = () => {
    smsSendMutate({ phone: getValues('phone') });
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
    setValue('phone', '');
    setValue('verificationNonce', '');
  };

  const handleSmsVerify = () => {
    if (smsCode.length !== 6 || isSmsVerifyPending) return;
    smsVerifyMutate({ code: smsCode, phone: getValues('phone') });
  };

  const emailError =
    (errors.email && allValues.email && allValues.email.trim() !== '') ||
    (isEmailTouched && !isEmailCheck && !isEmailCheckPending && !!getValues('email').length);
  const emailErrorText = emailError
    ? (errors.email?.message ?? (emailCheckErrorMsg || '이메일이 중복되었습니다.'))
    : undefined;
  const isStepOneValid =
    allValues.name.trim().length >= 2 &&
    allValues.email.trim().length > 0 &&
    isEmailCheck &&
    allValues.password.trim().length > 0 &&
    allValues.passwordCheck.trim().length > 0 &&
    allValues.birthDate.trim().length > 0 &&
    allValues.postcode.trim().length > 0 &&
    allValues.address.trim().length > 0 &&
    allValues.addressDetail.trim().length > 0 &&
    !errors.email &&
    !errors.password &&
    !errors.passwordCheck &&
    !errors.name &&
    !errors.birthDate &&
    !errors.postcode &&
    !errors.address;

  const handleNextStep = () => {
    if (isStepOneValid) onStepChange(2);
  };

  return (
    <>
      <form className={cx('container')} onSubmit={onSubmit}>
        {step === 1 && (
          <SignupBasicInfoStep
            allValues={allValues}
            errors={errors}
            emailError={Boolean(emailError)}
            emailErrorText={emailErrorText}
            isStepOneValid={isStepOneValid}
            register={register}
            nameField={register('name', textRules('이름을 입력하세요.', 2))}
            emailField={register('email', emailRules('이메일 형식이 올바르지 않습니다.'))}
            passwordField={register('password', passwordRules('비밀번호 형식이 올바르지 않습니다.'))}
            passwordCheckField={register('passwordCheck', passwordCheckRules('비밀번호가 일치하지 않습니다.'))}
            birthDateField={register('birthDate', textRules('생년월일을 입력하세요.', 1))}
            postcodeField={register('postcode', textRules('우편번호를 입력하세요.', 1))}
            addressField={register('address', textRules('주소를 입력하세요.', 1))}
            addressDetailField={register('addressDetail', textRules('상세주소를 입력하세요.', 1))}
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
            isEmailCheck={isEmailCheck}
            isSmsCheck={isSmsCheck}
            isSmsSendPending={isSmsSendPending}
            isSmsVerifyPending={isSmsVerifyPending}
            onCodeChange={handleCode}
            onPhoneCheck={handlePhoneCheck}
            onPhoneReset={handlePhoneReset}
            onPrevStep={() => onStepChange(1)}
            onSmsVerify={handleSmsVerify}
          />
        )}
      </form>

      {signupError && <SignupErrorPopup message={signupError} onClose={clearSignupError} />}
    </>
  );
}
