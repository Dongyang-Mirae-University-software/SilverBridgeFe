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
  getPreviewCheck,
  isValidMemberId,
  sanitizeMemberId,
  wardCallName,
} from '@/utils/connection/connectionView';
import styles from './GuardianConnectionRequestForm.module.css';

const cx = classNames.bind(styles);

// 어르신이 나(보호자)에게 누구인지 - 보호자 화면에서 어르신을 이렇게 부른다(2026-11-24 사용자 결정, "기타"는 "어르신")
// 두 칸에 놓으므로 짝이 한 줄에 오게 둔다(2026-11-25): 엄마 아빠 / 할머니 할아버지 / 외할머니 외할아버지 / 남편 아내 / 삼촌 이모 / 고모 기타
const WARD_RELATION_OPTIONS = [
  '엄마', '아빠', '할머니', '할아버지', '외할머니', '외할아버지', '남편', '아내', '삼촌', '이모', '고모', '기타',
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

// 단계를 브라우저 기록에 남긴다(2026-11-25 R-1) - 휴대폰 뒤로 가기가 페이지를 떠나지 않고 이전 질문으로 가게.
// 주소(?step=)에는 담지 않는다: 새로고침하면 고른 값 없이 3단계가 열린다. 기존 기록(Next 내부 값)은 그대로 둔다
const HISTORY_STEP_KEY = 'connectionStep';

function readHistoryStep(): Step | null {
  const value = (window.history.state as Record<string, unknown> | null)?.[HISTORY_STEP_KEY];
  return value === 1 || value === 2 || value === 3 || value === 'done' ? value : null;
}

function writeHistoryStep(step: Step, mode: 'push' | 'replace') {
  const state = { ...((window.history.state as Record<string, unknown> | null) ?? {}), [HISTORY_STEP_KEY]: step };
  if (mode === 'push') window.history.pushState(state, '');
  else window.history.replaceState(state, '');
}

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

  // 1단계 회원 ID 확인 결과(R-2) - 직접 입력한 ID도 링크로 받은 ID도 같게 보인다
  const previewCheck = memberIdValid && preview.isError ? getPreviewCheck(preview.error) : null;
  const idBlocked = previewCheck?.kind === 'blocked';

  const canGoNext = step === 1 ? memberIdValid && !idBlocked : step === 2 ? Boolean(wardRelation) : false;
  const canSubmit = memberIdValid && Boolean(wardRelation) && Boolean(relation) && !isPending;

  // 화면만 옮긴다(기록은 부르는 쪽이 정한다)
  const showStep = (next: Step) => {
    stepChanged.current = true;
    setErrorMessage('');
    setIsTargetError(false);
    setStep(next);
  };

  // 앞으로 가기 = 기록을 하나 더한다
  const moveTo = (next: Step) => {
    writeHistoryStep(next, 'push');
    showStep(next);
  };

  // 뒤로 가기·앞으로 가기가 부를 때 쓸 최신 값(이벤트 처리기는 처음 한 번만 붙인다)
  const latest = useRef({ step, memberIdValid, idBlocked, wardRelation, sentTo });
  useEffect(() => {
    latest.current = { step, memberIdValid, idBlocked, wardRelation, sentTo };
  });

  useEffect(() => {
    // 처음 열 때 지금 기록을 1단계로 표시한다 - 2단계에서 뒤로 가면 여기로 온다
    writeHistoryStep(1, 'replace');

    const onPopState = () => {
      const wanted = readHistoryStep();
      if (wanted === null) return; // 이 화면이 남긴 기록이 아니다
      const now = latest.current;
      // 완료 화면을 떠나면 보낸 요청은 끝난 일이다 - 새로 시작한다(값은 보낼 때 이미 비웠다)
      const leavingDone = now.step === 'done' && wanted !== 'done';
      if (leavingDone) setSentTo('');
      // 필요한 값이 없는 단계로는 가지 않는다(앞으로 가기로 다시 들어온 경우 등) - 갈 수 있는 데까지만
      let next: Step = wanted;
      if (next === 'done') next = !leavingDone && now.sentTo ? 'done' : 1;
      if ((next === 2 || next === 3) && (!now.memberIdValid || now.idBlocked)) next = 1;
      if (next === 3 && !now.wardRelation) next = 2;
      if (next !== wanted) writeHistoryStep(next, 'replace');
      showStep(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // [이전] = 브라우저 뒤로 가기와 똑같이(기록과 화면이 어긋나지 않게)
  const goBack = () => {
    if (step === 1 || step === 'done') return;
    if (readHistoryStep() === step) window.history.back();
    else showStep((step - 1) as QuestionStep);
  };

  // [회원 ID 바꾸기] - 쌓인 단계만큼 되돌아가 1단계로(뒤로 가기를 또 누르면 페이지를 떠난다)
  const backToIdStep = () => {
    if (step !== 1 && step !== 'done' && readHistoryStep() === step) window.history.go(1 - step);
    else moveTo(1);
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
          // 3단계 기록을 완료로 바꾼다 - 뒤로 가기로 보낸 요청의 3단계가 다시 열리지 않게
          writeHistoryStep('done', 'replace');
          showStep('done');
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
    writeHistoryStep(1, 'replace');
    showStep(1);
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
              aria-describedby="ward-member-id-help ward-member-id-check"
              aria-invalid={idBlocked || undefined}
            />
            <p id="ward-member-id-help" className={cx('help')}>
              어르신 화면 메뉴에서 이름(프로필)을 누르면 보이는 회원 ID예요. 휴대폰에서는 메뉴 버튼을 먼저 눌러 주세요 (영문·숫자 6자리, 대소문자 구분)
            </p>
            {/* 확인 결과 - 알림 영역은 늘 그려 둔다(처음부터 있어야 바뀐 문구를 읽어 준다, R-7) */}
            <p
              id="ward-member-id-check"
              className={cx('linkNotice', { noticeBlocked: idBlocked })}
              aria-live="polite"
              data-testid="member-id-check"
            >
              {memberIdValid && preview.isLoading && '가족 정보를 확인하고 있어요.'}
              {memberIdValid && preview.data?.maskedName && `이 분이 맞나요? ${preview.data.maskedName}`}
              {previewCheck?.message}
            </p>
          </>
        )}

        {/* "기타를 고르면 '어르신'으로 보여요" 도움말은 뺐다 - 기타를 고르면 아래 미리보기가 바로 "어르신"을 보여 준다(2026-11-25) */}
        {step === 2 && (
          <ChoiceList
            name="wardRelation"
            labelledBy={titleId}
            options={WARD_RELATION_OPTIONS}
            value={wardRelation}
            onChange={setWardRelation}
          />
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
            <button className={cx('secondaryButton')} type="button" onClick={backToIdStep}>
              회원 ID 바꾸기
            </button>
          )}
        </div>
      )}

      <footer className={cx('footer')}>
        {step === 1 && <p className={cx('hint')}>어르신이 수락하면 연결돼요</p>}
        <div className={cx('actions', { doneActions: isDone })}>
          {(step === 2 || step === 3) && (
            <button className={cx('secondaryButton')} type="button" onClick={goBack}>
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
