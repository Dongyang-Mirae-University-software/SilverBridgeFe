'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { updateWardCompanionTranscriptConsent } from '@/service/api/ward/companion';
import { wardCompanionConsentQueryKey, wardCompanionConsentQueryOptions } from '@/service/query/ward';
import { markConsentAsked } from '@/utils/companion/consentAsked';
import styles from './WardBasicSettingsSection.module.css';

const cx = classNames.bind(styles);

export const COMPANION_CONSENT_LABEL = '안부 대화 내용을 가족에게 보여 주기';

// 안부 말벗 대화 내용(글) 가족 공유 동의. 끄면 서버가 보관한 대화 내용을 바로 지운다(되돌릴 수 없어 한 번 더 묻는다)
export function WardCompanionConsentSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery(wardCompanionConsentQueryOptions);
  const mutation = useMutation({
    mutationFn: (consent: boolean) => updateWardCompanionTranscriptConsent(consent),
    onSuccess: saved => {
      // 본인이 정했으니 대화 시작 때 다시 묻지 않는다(철회하면 서버 consentedAt이 비어 카드가 다시 뜨던 것 - 점검 M-1)
      markConsentAsked();
      if (saved) queryClient.setQueryData(wardCompanionConsentQueryKey, saved);
      else void queryClient.invalidateQueries({ queryKey: wardCompanionConsentQueryKey });
    },
  });
  const consented = data?.consented === true;
  const [confirmOff, setConfirmOff] = useState(false);
  const handleChange = (checked: boolean) => {
    if (checked) {
      setConfirmOff(false);
      mutation.mutate(true);
      return;
    }
    setConfirmOff(true);
  };
  const turnOff = () => {
    setConfirmOff(false);
    mutation.mutate(false);
  };
  const retentionDays = data?.retentionDays ?? 30;

  return (
    <section className={cx('settingsCard')}>
      <div className={cx('displayContent')}>
        <h2>안부 대화</h2>
        {isError && (
          <p className={cx('localNote')} role="alert">
            설정을 불러오지 못했어요.{' '}
            <button className={cx('retryInline')} type="button" onClick={() => void refetch()}>다시 불러오기</button>
          </p>
        )}
      </div>
      <label className={cx('contrastRow')}>
        <span>
          <strong>{COMPANION_CONSENT_LABEL}</strong>
          <small>{retentionDays}일 뒤 지워져요. 끄면 지금까지 보관한 대화 내용을 바로 지워요.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={COMPANION_CONSENT_LABEL}
          checked={consented}
          disabled={isLoading || isError || mutation.isPending || confirmOff}
          onChange={event => handleChange(event.target.checked)}
        />
        <span className={cx('switchBox', { switchBoxOn: consented })} aria-hidden="true">
          {consented ? '켜짐' : '꺼짐'}
          <span className={cx('bigSwitch')}>
            <span />
          </span>
        </span>
      </label>
      {confirmOff && (
        <div className={cx('consentConfirm')} role="alertdialog" aria-labelledby="companion-consent-off-title">
          <p id="companion-consent-off-title">끄면 지금까지 보관한 대화 내용이 바로 지워져요. 끌까요?</p>
          <div>
            <button className={cx('consentConfirmButton', 'danger')} type="button" onClick={turnOff}>끄고 지우기</button>
            <button className={cx('consentConfirmButton')} type="button" autoFocus onClick={() => setConfirmOff(false)}>그대로 두기</button>
          </div>
        </div>
      )}
      {mutation.isError && (
        <p className={cx('localNote', 'consentError')} role="alert">바꾸지 못했어요. 잠시 후 다시 눌러 주세요.</p>
      )}
      {data && data.notice.length > 0 && (
        <ul className={cx('consentNoticeList')} aria-label="개인정보 수집·이용 안내">
          {data.notice.map(item => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}
