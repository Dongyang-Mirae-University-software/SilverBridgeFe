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
// 깊이 = 처음(1단계) 기록에서 몇 칸 왔는지, 회차 = 화면을 열 때마다 새로 만드는 값(2026-11-25 H-1).
// 화면이 새로 열리면(새로고침·다른 화면에서 돌아옴) 그 앞에 지난 회차의 단계 기록이 남는다 - 깊이만큼 되감아
// 뒤로 가기가 헛돌지 않게 한다. 깊이는 1단계 0, 2단계 1, 3단계·완료 2(완료는 3단계 기록을 덮어쓴다)
const HISTORY_DEPTH_KEY = 'connectionDepth';
const HISTORY_MOUNT_KEY = 'connectionMount';
const MAX_HISTORY_DEPTH = 2;
const STEP_DEPTH: Record<Step, number> = { 1: 0, 2: 1, 3: 2, done: 2 };

interface HistoryEntry {
  step: Step | null;
  depth: number | null; // 믿을 수 없으면(없음·범위 밖) null - 그때는 되감지 않는다
  mount: string | null;
}

function readHistoryEntry(): HistoryEntry {
  const state = window.history.state as Record<string, unknown> | null;
  const step = state?.[HISTORY_STEP_KEY];
  const depth = state?.[HISTORY_DEPTH_KEY];
  const mount = state?.[HISTORY_MOUNT_KEY];
  return {
    step: step === 1 || step === 2 || step === 3 || step === 'done' ? step : null,
    depth: typeof depth === 'number' && Number.isInteger(depth) && depth >= 0 && depth <= MAX_HISTORY_DEPTH ? depth : null,
    mount: typeof mount === 'string' ? mount : null,
  };
}

// depth는 보통 단계로 정해지지만, 완료는 보내는 중에 뒤로 간 경우 3단계가 아닌 기록을 덮어쓰므로 그 기록의 실제 깊이를 넘긴다
function writeHistoryStep(step: Step, mount: string, mode: 'push' | 'replace', depth: number = STEP_DEPTH[step]) {
  const state = {
    ...((window.history.state as Record<string, unknown> | null) ?? {}),
    [HISTORY_STEP_KEY]: step,
    [HISTORY_DEPTH_KEY]: depth,
    [HISTORY_MOUNT_KEY]: mount,
  };
  if (mode === 'push') window.history.pushState(state, '');
  else window.history.replaceState(state, '');
}

// Next는 router.refresh()·같은 주소 이동 때 지금 기록을 자기 값으로만 다시 쓴다(preserveCustomHistoryState=false).
// 그러면 단계 기록이 지워져 [이전]·뒤로 가기가 헛돈다(2026-11-26 I-1 - 알림을 받으면 어느 화면에서든 refresh가 불린다).
// 이 화면이 열려 있는 동안, 같은 주소에 우리 값 없이 덮어쓰면 지금 기록(이 회차 것일 때만)의 우리 값을 이어 붙인다.
// Next는 덮어쓸 때마다 window.history.replaceState를 그 자리에서 불러 쓰므로 여기서 감싸면 거친다
function keepStepOnSameUrlReplace(mount: string): () => void {
  const previous = window.history.replaceState;
  let active = true;
  const withoutHash = (href: string) => href.split('#')[0];
  const isSameUrl = (url?: string | URL | null) =>
    url === undefined || url === null || url === '' || withoutHash(new URL(url, window.location.href).href) === withoutHash(window.location.href);

  const wrapped = function replaceState(this: History, data: unknown, unused: string, url?: string | URL | null) {
    const current = window.history.state as Record<string, unknown> | null;
    const incoming = data as Record<string, unknown> | null;
    const wipesOurEntry =
      active &&
      current?.[HISTORY_MOUNT_KEY] === mount &&
      incoming !== null &&
      typeof incoming === 'object' &&
      incoming[HISTORY_STEP_KEY] === undefined &&
      isSameUrl(url);
    const next = wipesOurEntry
      ? {
          ...incoming,
          [HISTORY_STEP_KEY]: current[HISTORY_STEP_KEY],
          [HISTORY_DEPTH_KEY]: current[HISTORY_DEPTH_KEY],
          [HISTORY_MOUNT_KEY]: mount,
        }
      : data;
    return previous.call(this, next, unused, url);
  };
  window.history.replaceState = wrapped;

  return () => {
    // 뒤에 다른 코드가 또 감쌌으면 되돌리지 않고 끄기만 한다(그 코드가 감싼 함수를 잃지 않게)
    active = false;
    if (window.history.replaceState === wrapped) window.history.replaceState = previous;
  };
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
  // 못 불러오면 비워 두고 미리보기에 "(내 이름)"을 흐리게 보인다(R-6 - "나 보호자 (아들)"는 어색했다)
  const myName = getUserProfileData(profileResponse)?.name?.trim() ?? '';

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

  // 확인 중에 [다음]을 눌렀는데 결과가 늦게 "요청할 수 없음"으로 온 경우(H-2) - 2·3단계에서 바로 알리고 보내기를 막는다
  const lateBlocked = (step === 2 || step === 3) && idBlocked;

  // 2단계도 늦게 온 막힘이면 [다음]·Enter를 막는다 - 3단계로 가 봐야 보낼 수 없다(I-2)
  const canGoNext = step === 1 ? memberIdValid && !idBlocked : step === 2 ? Boolean(wardRelation) && !idBlocked : false;
  const canSubmit = memberIdValid && !idBlocked && Boolean(wardRelation) && Boolean(relation) && !isPending;

  // 이 화면을 연 회차(기록에 남겨 지난 회차의 기록과 구분한다, H-1)
  const [mountId] = useState(() => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  // Next의 refresh가 단계 기록을 지우지 않게(I-1) - 화면을 닫으면 되돌린다
  useEffect(() => keepStepOnSameUrlReplace(mountId), [mountId]);

  // 화면만 옮긴다(기록은 부르는 쪽이 정한다)
  const showStep = (next: Step) => {
    stepChanged.current = true;
    setErrorMessage('');
    setIsTargetError(false);
    setStep(next);
  };

  // 앞으로 가기 = 기록을 하나 더한다
  const moveTo = (next: Step) => {
    writeHistoryStep(next, mountId, 'push');
    showStep(next);
  };

  // 뒤로 가기·앞으로 가기가 부를 때 쓸 최신 값(이벤트 처리기는 처음 한 번만 붙인다)
  const latest = useRef({ step, memberIdValid, idBlocked, wardRelation, sentTo });
  useEffect(() => {
    latest.current = { step, memberIdValid, idBlocked, wardRelation, sentTo };
  });

  // 지금 기록이 이 회차가 남긴 그 단계인가 - 그래야 깊이를 믿고 기록 사이를 오갈 수 있다
  const isOwnEntry = (expected: Step) => {
    const entry = readHistoryEntry();
    return entry.step === expected && entry.mount === mountId && entry.depth === STEP_DEPTH[expected];
  };

  // 지금 기록의 깊이(이 회차가 남긴 것일 때만) - 완료 기록에 실제 깊이를 남기고 되감는 데 쓴다
  const ownDepth = () => {
    const entry = readHistoryEntry();
    return entry.mount === mountId ? entry.depth : null;
  };

  useEffect(() => {
    // 처음 열 때: 지난 회차의 2단계 이상 기록 위라면(새로고침·다른 화면에서 돌아옴) 그 회차의 처음 기록까지 되감는다.
    // 되감지 않으면 그 앞의 단계 기록이 남아 뒤로 가기가 헛돈다(H-1). 깊이를 믿을 수 없으면 지금 기록만 1단계로 표시한다
    const start = readHistoryEntry();
    if (start.step !== null && start.mount !== mountId && start.depth !== null && start.depth > 0) {
      window.history.go(-start.depth);
    } else {
      writeHistoryStep(1, mountId, 'replace');
    }

    const onPopState = () => {
      const entry = readHistoryEntry();
      if (entry.step === null) return; // 이 화면이 남긴 기록이 아니다
      const now = latest.current;
      // 완료 화면을 떠나면 보낸 요청은 끝난 일이다 - 새로 시작한다(값은 보낼 때 이미 비웠다)
      const leavingDone = now.step === 'done' && entry.step !== 'done';
      if (leavingDone) setSentTo('');

      // 지난 회차의 기록: 2단계 이상이면 그 회차의 처음 기록까지 더 간다(되감기·앞으로 가기를 무름),
      // 처음 기록(또는 깊이를 모르는 옛 기록)이면 이 회차의 1단계로 삼는다
      if (entry.mount !== mountId) {
        if (entry.depth !== null && entry.depth > 0) {
          window.history.go(-entry.depth);
          return;
        }
        writeHistoryStep(1, mountId, 'replace');
        if (now.step !== 1) showStep(1);
        return;
      }

      // 이 회차의 기록: 필요한 값이 없는 단계로는 가지 않는다 - 갈 수 있는 단계의 기록까지 실제로 옮겨 가서
      // 화면이 그대로인 뒤로 가기가 남지 않게 한다(중간 기록에서는 화면을 바꾸지 않는다)
      let next: Step = entry.step;
      if (next === 'done' && (leavingDone || !now.sentTo)) next = 1;
      if ((next === 2 || next === 3) && (!now.memberIdValid || now.idBlocked)) next = 1;
      if (next === 3 && !now.wardRelation) next = 2;
      if (next !== entry.step) {
        const move = STEP_DEPTH[next] - (entry.depth ?? STEP_DEPTH[entry.step]);
        if (move < 0) {
          window.history.go(move);
          return;
        }
        writeHistoryStep(next, mountId, 'replace');
      }
      if (next !== now.step) showStep(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [mountId]); // mountId는 바뀌지 않는다 - 처음 한 번만 돈다

  // [이전] = 브라우저 뒤로 가기와 똑같이(기록과 화면이 어긋나지 않게)
  const goBack = () => {
    if (step === 1 || step === 'done') return;
    if (isOwnEntry(step)) window.history.back();
    else showStep((step - 1) as QuestionStep);
  };

  // [회원 ID 바꾸기] - 쌓인 단계만큼 되돌아가 1단계로(뒤로 가기를 또 누르면 페이지를 떠난다)
  const backToIdStep = () => {
    if (step !== 1 && step !== 'done' && isOwnEntry(step)) window.history.go(1 - step);
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
          // 3단계 기록을 완료로 바꾼다 - 뒤로 가기로 보낸 요청의 3단계가 다시 열리지 않게.
          // 보내는 중에 뒤로 가서 2단계 기록 위라면 그 깊이(1)를 그대로 둔다 - 2로 적으면 되감을 때 페이지를 떠난다
          writeHistoryStep('done', mountId, 'replace', ownDepth() ?? STEP_DEPTH.done);
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
  // 완료 기록(깊이 2)에서 1단계 기록까지 되감는다 - 덮어쓰기만 하면 그 앞의 1·2단계 기록이 남아 뒤로 가기가 헛돈다(H-1)
  const startOver = () => {
    setSentTo('');
    const depth = readHistoryEntry().step === 'done' ? ownDepth() : null;
    if (depth !== null && depth > 0) {
      window.history.go(-depth);
      return;
    }
    writeHistoryStep(1, mountId, 'replace');
    showStep(1);
  };

  const isDone = step === 'done';
  const filledBars = isDone ? STEP_COUNT : step;

  const titleId = `connection-step-${step}-title`;
  const shownName = preview.data?.maskedName;
  const myScreen = wardRelation ? [shownName, wardCallName(wardRelation)].filter(Boolean).join(' ') : NOT_CHOSEN;
  const wardScreenRelation = relation ? `(${relation})` : NOT_CHOSEN;

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
              // 휴대폰 키보드가 화면 아래 [다음]을 가리므로 키보드 Enter 자리에 "다음"을 띄운다(Enter = [다음], R-5)
              enterKeyHint="next"
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
            {/* 확인 결과 - 알림 영역은 늘 그려 둔다(처음부터 있어야 바뀐 문구를 읽어 준다, R-2) */}
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
          {/* 고를 때마다 바뀐 줄을 읽어 준다(R-7) - 2단계 "기타 = 어르신"은 이 미리보기가 유일한 단서다.
              2·3단계가 같은 칸을 이어 쓰므로 단계를 옮길 때는 읽지 않는다 */}
          <dl className={cx('previewList')} aria-live="polite">
            <div>
              <dt>내 화면</dt>
              <dd data-testid="preview-my-screen">{myScreen}</dd>
            </div>
            <div>
              <dt>어르신 화면</dt>
              <dd data-testid="preview-ward-screen">
                {myName || <span className={cx('namePlaceholder')}>(내 이름)</span>} 보호자 {wardScreenRelation}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* 보낸 뒤 서버 오류가 먼저, 없으면 늦게 온 확인 결과(H-2) */}
      {(errorMessage || lateBlocked) && (
        <div className={cx('errorBox')} role="alert">
          <p className={cx('errorMessage')}>{errorMessage || previewCheck?.message}</p>
          {(isTargetError || lateBlocked) && (
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
