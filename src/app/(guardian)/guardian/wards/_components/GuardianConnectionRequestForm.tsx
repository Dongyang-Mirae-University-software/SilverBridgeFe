'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { useGuardianConnectionPreview, useGuardianConnectionRequestMutation } from '@/service/query/guardian';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import {
  getConnectionErrorCode,
  getConnectionRequestErrorMessage,
  isValidMemberId,
  sanitizeMemberId,
  wardCallName,
} from '@/utils/connection/connectionView';
import styles from './GuardianConnectionRequestForm.module.css';

const cx = classNames.bind(styles);

// 어르신이 나(보호자)에게 누구인지 - 보호자 화면에서 어르신을 이렇게 부른다(2026-11-24 사용자 결정, "기타"는 "어르신")
const WARD_RELATION_OPTIONS = [
  '엄마', '아빠', '할머니', '할아버지', '외할머니', '외할아버지', '삼촌', '이모', '고모', '남편', '아내', '기타',
] as const;
type WardRelationOption = (typeof WARD_RELATION_OPTIONS)[number];

// 보호자(나)가 어르신에게 누구인지 - 어르신 화면에 "OOO 보호자 (아들)"로 보인다. 조카는 삼촌·이모·고모 호칭의 짝(2026-11-25)
const RELATION_OPTIONS = ['아들', '딸', '며느리', '사위', '손자', '손녀', '조카', '배우자', '기타'] as const;
type RelationOption = (typeof RELATION_OPTIONS)[number];

// 'done' = 보낸 뒤 완료 화면(2026-11-25 - 1단계로 돌아가면 처음부터 다시 하라는 것처럼 보였다)
type QuestionStep = 1 | 2 | 3;
type Step = QuestionStep | 'done';
const STEP_COUNT = 3;
const STEP_TITLES: Record<Step, string> = {
  1: '어르신의 회원 ID를 알려 주세요',
  2: '어르신을 뭐라고 부르세요?',
  3: '어르신께 나는 누구인가요?',
  done: '연결 요청을 보냈어요',
};

// 상대 계정 때문에 안 되는 경우 - 관계는 두고 회원 ID만 다시 고르게 한다
const TARGET_ERROR_CODES = new Set([
  'USER_NOT_FOUND',
  'INVALID_CONNECTION_ROLE',
  'CANNOT_CONNECT_SELF',
  'CONNECTION_TARGET_NOT_ACTIVE',
  'CONNECTION_ALREADY_EXISTS',
  'CONNECTION_REQUEST_COOLDOWN',
]);

const NOT_CHOSEN = '(고르면 보여요)';

interface ChoiceListProps<T extends string> {
  name: string;
  labelledBy: string;
  describedBy?: string;
  options: readonly T[];
  value: T | '';
  onChange: (value: T) => void;
}

// 한 줄에 하나씩 고르는 목록 - 고르기만 하고 넘어가지 않는다([다음]을 눌러야 넘어간다)
function ChoiceList<T extends string>({ name, labelledBy, describedBy, options, value, onChange }: ChoiceListProps<T>) {
  return (
    <div className={cx('choices')} role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {options.map(option => (
        <label key={option} className={cx('choice', { selected: value === option })}>
          <input
            className={cx('choiceInput')}
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

export function GuardianConnectionRequestForm() {
  const searchParams = useSearchParams();
  const linkedTargetId = searchParams.get('targetId') ?? '';
  const isLinkedTargetId = isValidMemberId(linkedTargetId);
  const [step, setStep] = useState<Step>(1);
  const [memberId, setMemberId] = useState(() => (isLinkedTargetId ? linkedTargetId : ''));
  const [wardRelation, setWardRelation] = useState<WardRelationOption | ''>('');
  const [relation, setRelation] = useState<RelationOption | ''>('');
  // 완료 화면에 보일 "김*희 엄마" - 값을 비운 뒤에도 보여 주려고 보낸 순간에 남겨 둔다
  const [sentTo, setSentTo] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isTargetError, setIsTargetError] = useState(false);
  const { mutate, isPending } = useGuardianConnectionRequestMutation();
  const memberIdValid = isValidMemberId(memberId);
  const preview = useGuardianConnectionPreview(memberId, memberIdValid);
  // 보호자 화면 레이아웃이 이미 불러 둔 내 정보를 쓴다(새 호출 없음)
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const myName = getUserProfileData(profileResponse)?.name?.trim() || '나';

  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepChanged = useRef(false);
  useEffect(() => {
    // 처음 열 때는 두고, 단계를 옮길 때만 제목으로 초점을 옮긴다(화면 읽기 프로그램이 새 질문을 읽게)
    if (!stepChanged.current) return;
    titleRef.current?.focus();
  }, [step]);

  const canGoNext = step === 1 ? memberIdValid : step === 2 ? Boolean(wardRelation) : false;
  const canSubmit = memberIdValid && Boolean(wardRelation) && Boolean(relation) && !isPending;

  const moveTo = (next: Step) => {
    stepChanged.current = true;
    setErrorMessage('');
    setIsTargetError(false);
    setStep(next);
  };

  const send = () => {
    if (!canSubmit || !relation || !wardRelation) return;
    setErrorMessage('');
    setIsTargetError(false);
    const requestedWard = [preview.data?.maskedName, wardCallName(wardRelation)].filter(Boolean).join(' ');
    // 회원 ID는 대소문자를 구분하므로 입력값 그대로 보낸다
    mutate(
      { relation, wardRelation, targetId: memberId },
      {
        onSuccess: () => {
          setMemberId('');
          setWardRelation('');
          setRelation('');
          setSentTo(requestedWard);
          moveTo('done');
        },
        onError: error => {
          setErrorMessage(getConnectionRequestErrorMessage(error));
          setIsTargetError(TARGET_ERROR_CODES.has(getConnectionErrorCode(error) ?? ''));
        },
      },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 1·2단계에서 Enter는 [다음]과 같다
    if (step === 'done') return;
    if (step === 3) send();
    else if (canGoNext) moveTo((step + 1) as QuestionStep);
  };

  // 다른 어르신을 처음부터 - 값은 보내기 성공 때 이미 비웠다(?targetId= 링크의 ID도 다시 채우지 않는다)
  const startOver = () => {
    setSentTo('');
    moveTo(1);
  };

  const isDone = step === 'done';
  const filledBars = isDone ? STEP_COUNT : step;

  const titleId = `connection-step-${step}-title`;
  const shownName = preview.data?.maskedName;
  const myScreen = wardRelation ? [shownName, wardCallName(wardRelation)].filter(Boolean).join(' ') : NOT_CHOSEN;
  const wardScreen = `${myName} 보호자 ${relation ? `(${relation})` : NOT_CHOSEN}`;

  return (
    <form className={cx('card')} onSubmit={handleSubmit}>
      <div className={cx('progress')}>
        <div
          className={cx('progressBars')}
          role="img"
          aria-label={isDone ? `${STEP_COUNT}단계를 모두 마쳤어요` : `${STEP_COUNT}단계 중 ${step}단계`}
        >
          {[1, 2, 3].map(index => (
            <span key={index} className={cx('progressBar', { done: index <= filledBars })} />
          ))}
        </div>
        <span className={cx('progressText')} aria-hidden="true">
          {isDone ? '완료' : `${step} / ${STEP_COUNT}`}
        </span>
      </div>

      <div className={cx('field')}>
        <div className={cx({ doneTitle: isDone })}>
          {isDone && (
            <span className={cx('doneMark')} aria-hidden="true">
              ✓
            </span>
          )}
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className={cx('title')}>
            {STEP_TITLES[step]}
          </h2>
        </div>

        {isDone && (
          <div className={cx('doneBody')}>
            {sentTo && <p className={cx('doneWard')}>{sentTo}</p>}
            {/* 수락 알림은 보호자 알림 설정에 따라 안 갈 수 있어(CONNECTION_ACCEPTED = SETTINGS_ONLY) 약속하지 않는다 */}
            {/* 두 문장이 한 줄에 이어지면 어중간하게 접혀 읽기 어렵다 - 한 문장씩 줄을 나눈다 */}
            <p className={cx('doneNote')}>
              <span>어르신이 수락하면 연결돼요.</span>
              <span>연결된 가족 화면에서 확인할 수 있어요.</span>
            </p>
          </div>
        )}

        {step === 1 && (
          <>
            <input
              id="ward-member-id"
              className={cx('idInput')}
              value={memberId}
              onChange={event => {
                setMemberId(sanitizeMemberId(event.target.value));
                setErrorMessage('');
                setIsTargetError(false);
              }}
              placeholder="예) aB3x9Z"
              // maxLength는 두지 않는다 - 붙여 넣은 "aB-3x 9Z"가 정리 전에 잘려 버린다. 길이는 sanitizeMemberId가 자른다
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="어르신의 회원 ID"
              aria-describedby="ward-member-id-help"
            />
            <p id="ward-member-id-help" className={cx('help')}>
              어르신 화면 메뉴에서 이름(프로필)을 누르면 보이는 회원 ID예요. 휴대폰에서는 메뉴 버튼을 먼저 눌러 주세요 (영문·숫자 6자리, 대소문자 구분)
            </p>
            {isLinkedTargetId && memberId === linkedTargetId && (
              <p className={cx('linkNotice')} aria-live="polite">
                {preview.isLoading && '가족 정보를 확인하고 있어요.'}
                {preview.data?.maskedName && `이 분이 맞나요? ${preview.data.maskedName}`}
                {preview.isError && '이 ID는 지금 연결할 수 없어요. 다른 ID를 확인해 주세요.'}
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <ChoiceList
              name="wardRelation"
              labelledBy={titleId}
              describedBy="ward-relation-help"
              options={WARD_RELATION_OPTIONS}
              value={wardRelation}
              onChange={setWardRelation}
            />
            <p id="ward-relation-help" className={cx('help')}>
              기타를 고르면 &lsquo;어르신&rsquo;으로 보여요
            </p>
          </>
        )}

        {step === 3 && (
          <ChoiceList
            name="relation"
            labelledBy={titleId}
            options={RELATION_OPTIONS}
            value={relation}
            onChange={setRelation}
          />
        )}
      </div>

      {(step === 2 || step === 3) && (
        <section className={cx('preview')} aria-label="이렇게 보여요">
          <p className={cx('previewTitle')}>이렇게 보여요</p>
          <dl className={cx('previewList')}>
            <div>
              <dt>내 화면</dt>
              <dd data-testid="preview-my-screen">{myScreen}</dd>
            </div>
            <div>
              <dt>어르신 화면</dt>
              <dd data-testid="preview-ward-screen">{wardScreen}</dd>
            </div>
          </dl>
        </section>
      )}

      {errorMessage && (
        <div className={cx('errorBox')} role="alert">
          <p className={cx('errorMessage')}>{errorMessage}</p>
          {isTargetError && (
            <button className={cx('secondaryButton')} type="button" onClick={() => moveTo(1)}>
              회원 ID 바꾸기
            </button>
          )}
        </div>
      )}

      <footer className={cx('footer')}>
        {step === 1 && <p className={cx('hint')}>어르신이 수락하면 연결돼요</p>}
        <div className={cx('actions', { doneActions: isDone })}>
          {(step === 2 || step === 3) && (
            <button className={cx('secondaryButton')} type="button" onClick={() => moveTo((step - 1) as QuestionStep)}>
              이전
            </button>
          )}
          {isDone ? (
            <>
              <button className={cx('secondaryButton')} type="button" onClick={startOver}>
                다른 어르신 등록하기
              </button>
              <Link className={cx('submitButton', 'linkButton')} href="/guardian/wards">
                연결된 가족 보기
              </Link>
            </>
          ) : step === 3 ? (
            <button className={cx('submitButton')} type="submit" disabled={!canSubmit}>
              {isPending ? '요청 보내는 중…' : '연결 요청 보내기'}
            </button>
          ) : (
            <button className={cx('submitButton')} type="submit" disabled={!canGoNext}>
              다음
            </button>
          )}
        </div>
      </footer>
    </form>
  );
}
