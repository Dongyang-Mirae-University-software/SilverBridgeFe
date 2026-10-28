'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import { useGuardianConnectionRequestMutation } from '@/service/query/guardian';
import {
  getConnectionRequestErrorMessage,
  isValidMemberId,
  sanitizeMemberId,
} from '@/utils/connection/connectionView';
import styles from './GuardianConnectionRequestForm.module.css';

const cx = classNames.bind(styles);

// 보호자(나)가 어르신에게 누구인지 - BE relation 예시와 같은 8개
const RELATION_OPTIONS = ['아들', '딸', '며느리', '사위', '손자', '손녀', '배우자', '기타'] as const;
type RelationOption = (typeof RELATION_OPTIONS)[number];

export function GuardianConnectionRequestForm() {
  const [memberId, setMemberId] = useState('');
  const [relation, setRelation] = useState<RelationOption | ''>('');
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { mutate, isPending } = useGuardianConnectionRequestMutation();

  const canSubmit = isValidMemberId(memberId) && Boolean(relation) && !isPending;

  /* v12 보관: 성공 안내를 2.5초 뒤 자동으로 숨겼다.
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), SENT_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [sent]);
  */

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !relation) return;
    setErrorMessage('');
    setSent(false);
    // 회원 ID는 대소문자를 구분하므로 입력값 그대로 보낸다
    mutate(
      { relation, targetId: memberId },
      {
        onSuccess: () => {
          setMemberId('');
          setRelation('');
          setSent(true);
        },
        onError: error => setErrorMessage(getConnectionRequestErrorMessage(error)),
      },
    );
  };

  return (
    <form className={cx('card')} onSubmit={handleSubmit}>
      <div className={cx('field')}>
        <label className={cx('label')} htmlFor="ward-member-id">
          <span className={cx('step')}>1</span>
          어르신의 회원 ID
        </label>
        <input
          id="ward-member-id"
          className={cx('idInput')}
          value={memberId}
          onChange={event => {
            setMemberId(sanitizeMemberId(event.target.value));
            setErrorMessage('');
            setSent(false);
          }}
          placeholder="예) aB3x9Z"
          // maxLength는 두지 않는다 - 붙여 넣은 "aB-3x 9Z"가 정리 전에 잘려 버린다. 길이는 sanitizeMemberId가 자른다
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby="ward-member-id-help"
        />
        <p id="ward-member-id-help" className={cx('help')}>
          어르신 화면 메뉴에서 이름(프로필)을 누르면 보이는 회원 ID예요. 휴대폰에서는 메뉴 버튼을 먼저 눌러 주세요 (영문·숫자 6자리, 대소문자 구분)
        </p>
      </div>

      <fieldset className={cx('field', 'relationField')}>
        <legend className={cx('label')}>
          <span className={cx('step')}>2</span>
          어르신과의 관계
        </legend>
        <div className={cx('chips')}>
          {RELATION_OPTIONS.map(option => (
            <button
              key={option}
              className={cx('chip', { selected: relation === option })}
              type="button"
              aria-pressed={relation === option}
              onClick={() => {
                setRelation(option);
                setSent(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <footer className={cx('footer')}>
        <p className={cx('hint')} aria-live="polite">
          {sent ? <span className={cx('sentText')}>연결 요청을 보냈어요. 어르신이 수락하면 연결돼요</span> : '어르신이 수락하면 연결돼요'}
        </p>
        <button className={cx('submitButton')} type="submit" disabled={!canSubmit}>
          {isPending ? '요청 보내는 중…' : '연결 요청 보내기'}
        </button>
      </footer>

      {errorMessage && (
        <p className={cx('errorMessage')} role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
