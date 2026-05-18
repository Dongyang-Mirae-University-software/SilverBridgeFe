import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import TextInput from '@/app/_components/common/TextInput';
import useSignupForm from '@/app/_hook/useSignupForm';
import { signupEmailCheck, signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import { useMutation } from '@tanstack/react-query';
import { ChangeEvent, useState } from 'react';

const cx = classNames.bind(styles);

interface Props {
  step: number;
  onStepChange: (step: number) => void;
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

  const { mutate: smsSendMutate } = useMutation({
    mutationKey: ['sms-send'],
    mutationFn: signupSmsSend,
    onMutate: () => setSmsSendErrorMsg(''),
    onError: error => setSmsSendErrorMsg((error as Error).message || '인증번호 발송에 실패했습니다.'),
    onSuccess: () => setIsCode(true),
  });

  const { mutate: smsVerifyMutate, error: smsVerifyError } = useMutation({
    mutationKey: ['sms-verify'],
    mutationFn: signupSmsVerify,
    onSuccess: () => setIsSmsCheck(true),
  });

  const handleEmailCheck = () => {
    setIsEmailTouched(true);
    emailCheckMutate({ email: getValues('email') });
  };

  const handlePhoneCheck = () => {
    smsSendMutate({ phone: getValues('phone') });
  };

  const handleCode = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value.length <= 6) setSmsCode(value);
  };

  const handlePhoneReset = () => {
    setIsCode(false);
    setSmsSendErrorMsg('');
    setValue('phone', '');
  };

  const handleSmsVerify = () => {
    smsVerifyMutate({ code: smsCode, phone: getValues('phone') });
  };

  const emailError =
    (errors.email && allValues.email && allValues.email.trim() !== '') ||
    (isEmailTouched && !isEmailCheck && !isEmailCheckPending && !!getValues('email').length);
  const isStepOneValid =
    allValues.name.trim().length >= 2 &&
    allValues.email.trim().length > 0 &&
    isEmailCheck &&
    allValues.password.trim().length > 0 &&
    allValues.passwordCheck.trim().length > 0 &&
    allValues.address.trim().length > 0 &&
    !errors.email &&
    !errors.password &&
    !errors.passwordCheck &&
    !errors.name;

  const handleNextStep = () => {
    if (isStepOneValid) onStepChange(2);
  };

  return (
    <>
      <form className={cx('container')} onSubmit={onSubmit}>
        {step === 1 && (
          <>
            <div className={cx('roleSection')}>
              <label className={cx('fieldLabel')}>가입 유형</label>
              <div className={cx('radioGroup')}>
                <label className={cx('roleCard', { active: allValues.role === 'WARD' })} htmlFor="WARD">
                  <input id="WARD" type="radio" value="WARD" {...register('role')} defaultChecked />
                  <span className={cx('roleEmoji')}>피</span>
                  <span className={cx('roleCopy')}>
                    <strong>피보호자</strong>
                    <small>직접 사용</small>
                  </span>
                  {allValues.role === 'WARD' && <span className={cx('checkMark')}>✓</span>}
                </label>
                <label className={cx('roleCard', { active: allValues.role === 'GUARDIAN' })} htmlFor="GUARDIAN">
                  <input id="GUARDIAN" type="radio" value="GUARDIAN" {...register('role')} />
                  <span className={cx('roleEmoji')}>보</span>
                  <span className={cx('roleCopy')}>
                    <strong>보호자</strong>
                    <small>가족 돌봄</small>
                  </span>
                  {allValues.role === 'GUARDIAN' && <span className={cx('checkMark')}>✓</span>}
                </label>
              </div>
            </div>
            <TextInput
              label="이름"
              placeholder="홍길동"
              required
              {...register('name', textRules('이름을 입력하세요.', 2))}
              error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
              errorText={errors.name?.message}
            />
            <TextInput
              label="이메일"
              placeholder="example@email.com"
              required
              {...register('email', emailRules('이메일 형식이 올바르지 않습니다.'))}
              onBlur={handleEmailCheck}
              error={emailError}
              errorText={
                emailError ? (errors.email?.message ?? (emailCheckErrorMsg || '이메일이 중복되었습니다.')) : undefined
              }
            />
            <TextInput
              label="비밀번호"
              placeholder="8자 이상"
              required
              {...register('password', passwordRules('비밀번호 형식이 올바르지 않습니다.'))}
              error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
              errorText={errors.password?.message}
            />
            <TextInput
              label="비밀번호 확인"
              placeholder="비밀번호 다시 입력"
              required
              {...register('passwordCheck', passwordCheckRules('비밀번호가 일치하지 않습니다.'))}
              error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
              errorText={errors.passwordCheck?.message}
            />
            <TextInput
              label="주소"
              placeholder="주소를 입력하세요"
              required
              {...register('address', textRules('주소를 입력하세요.', 1))}
              error={Boolean(errors.address && allValues.address && allValues.address.trim() !== '')}
              errorText={errors.address?.message}
            />
            <TextInput
              label="상세주소"
              placeholder="상세주소를 입력하세요"
              {...register('addressDetail')}
            />
            <button className={cx('button')} disabled={!isStepOneValid} type="button" onClick={handleNextStep}>
              다음
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <TextInput
              label="전화번호"
              placeholder="010-0000-0000"
              required
              {...register('phone', phoneRules('전화번호 형식이 올바르지 않습니다.'))}
              error={Boolean((errors.phone && allValues.phone && allValues.phone.trim() !== '') || smsSendErrorMsg)}
              disabled={isCode}
              errorText={smsSendErrorMsg || errors.phone?.message}
            />
            <div className={cx('actionRow')}>
              <button className={cx('secondaryButton')} type="button" onClick={handlePhoneCheck}>
                인증요청
              </button>
              <button className={cx('secondaryButton')} type="button" onClick={handlePhoneReset}>
                재설정
              </button>
            </div>
            {isCode && (
              <>
                <TextInput
                  error={Boolean(smsVerifyError)}
                  errorText={
                    smsVerifyError ? (smsVerifyError as Error).message || '인증번호가 올바르지 않습니다.' : undefined
                  }
                  label="인증번호"
                  maxLength={6}
                  value={smsCode}
                  onChange={handleCode}
                  placeholder="6자리 입력"
                />
                <button
                  className={cx('secondaryButton')}
                  type="button"
                  disabled={smsCode.length !== 6 || isSmsCheck}
                  onClick={handleSmsVerify}
                >
                  인증 확인
                </button>
                {isSmsCheck && <p className={cx('verifySuccess')}>인증이 완료되었습니다.</p>}
              </>
            )}
            <label className={cx('terms')}>
              <input type="checkbox" defaultChecked />
              <span>이용약관 · 개인정보 처리방침에 동의합니다</span>
            </label>
            <div className={cx('stepActions')}>
              <button className={cx('prevButton')} type="button" onClick={() => onStepChange(1)}>
                이전
              </button>
              <button className={cx('button')} disabled={!isEmailCheck || !isSmsCheck} type="submit">
                가입 완료
              </button>
            </div>
          </>
        )}
      </form>

      {signupError && (
        <div className={cx('popupOverlay')}>
          <div className={cx('popup')}>
            <p className={cx('popupMessage')}>{signupError}</p>
            <button className={cx('popupButton')} type="button" onClick={clearSignupError}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
