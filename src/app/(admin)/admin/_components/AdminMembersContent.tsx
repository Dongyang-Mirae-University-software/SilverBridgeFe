'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { deleteAdminUser, updateAdminUser } from '@/service/api/admin/user';
import {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
} from '@/service/interface/admin/user';
import {
  adminUserCountsQueryOptions,
  adminUserDetailQueryOptions,
  adminUserListQueryOptions,
  adminUserQueryKey,
} from '@/service/query/admin';
import { getModalErrorMessage } from '@/utils/dashboard/profile';
import styles from './AdminMembersContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 20;

const ROLE_LABEL: Record<AdminUserRole, string> = { WARD: '피보호자', GUARDIAN: '보호자', ADMIN: '관리자' };
const STATUS_LABEL: Record<AdminUserStatus, string> = { ACTIVE: '이용 중', RESTRICTED: '이용 제한' };
const CONNECTION_LABEL = { CONNECTED: '연결됨', PENDING: '수락 대기', NONE: '미연결' } as const;

type RoleTab = 'ALL' | AdminUserRole;
type StatusFilter = 'ALL' | AdminUserStatus;
type ConnectionFilter = 'ALL' | keyof typeof CONNECTION_LABEL;

export function AdminMembersContent() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<RoleTab>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [connection, setConnection] = useState<ConnectionFilter>('ALL');
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const params = useMemo(() => ({
    keyword: keyword.trim() || undefined,
    role: role === 'ALL' ? undefined : role,
    status,
    connection,
    page,
    size: PAGE_SIZE,
  }), [connection, keyword, page, role, status]);
  const members = useQuery(adminUserListQueryOptions(params));
  const counts = useQuery(adminUserCountsQueryOptions);
  const detail = useQuery(adminUserDetailQueryOptions(selectedUserId));

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: adminUserQueryKey });
  const updateMutation = useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: Parameters<typeof updateAdminUser>[1] }) => updateAdminUser(userId, body),
    onSuccess: async () => { await invalidateMembers(); },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: async () => { setSelectedUserId(null); await invalidateMembers(); },
  });

  const data = members.data;
  const roleTabs: Array<{ value: RoleTab; label: string; count: number | undefined }> = [
    { value: 'ALL', label: '전체', count: counts.data?.total },
    { value: 'GUARDIAN', label: '보호자', count: counts.data?.guardian },
    { value: 'WARD', label: '피보호자', count: counts.data?.ward },
    { value: 'ADMIN', label: '관리자', count: counts.data?.admin },
  ];

  return <div className={cx('page')}>
    <header className={cx('heading')}><h1>회원 관리</h1><p>가입한 회원을 조회하고 계정 정보를 관리합니다.</p></header>
    <div className={cx('roleTabs')} role="tablist" aria-label="회원 역할">
      {roleTabs.map(tab => <button className={cx('roleTab', { active: role === tab.value })} key={tab.value} type="button" role="tab" aria-selected={role === tab.value} onClick={() => { setRole(tab.value); setPage(0); }}>{tab.label} <small>{counts.isLoading ? '—' : `(${tab.count ?? 0})`}</small></button>)}
    </div>
    <section className={cx('card')}>
      <div className={cx('filterBar')}>
        <label className={cx('search')}><Icon name="search" size={17} /><span className="sr-only">회원 검색</span><input value={keyword} onChange={event => { setKeyword(event.target.value); setPage(0); }} placeholder="이름 · 이메일 · 전화번호 · 연결 회원 검색" /></label>
        <label className={cx('selectWrap')}>계정 상태<select value={status} onChange={event => { setStatus(event.target.value as StatusFilter); setPage(0); }}><option value="ALL">전체</option><option value="ACTIVE">이용 중</option><option value="RESTRICTED">이용 제한</option></select></label>
        <label className={cx('selectWrap')}>연결 상태<select value={connection} onChange={event => { setConnection(event.target.value as ConnectionFilter); setPage(0); }}><option value="ALL">전체</option><option value="CONNECTED">연결됨</option><option value="PENDING">수락 대기</option><option value="NONE">미연결</option></select></label>
      </div>
      <div className={cx('tableScroll')}>
        <table className={cx('table')}>
          <colgroup>
            <col className={cx('idColumn')} /><col className={cx('providerColumn')} /><col className={cx('emailColumn')} /><col className={cx('nameColumn')} /><col className={cx('roleColumn')} />
            <col className={cx('connectionColumn')} /><col className={cx('connectionStateColumn')} /><col className={cx('phoneColumn')} /><col className={cx('statusColumn')} /><col className={cx('actionColumn')} />
          </colgroup>
          <thead><tr><th>회원 ID</th><th>가입</th><th>이메일</th><th>이름</th><th>역할</th><th>연결 회원</th><th>연결 상태</th><th>전화번호</th><th>계정 상태</th><th><span className="sr-only">관리</span></th></tr></thead>
          <tbody>
            {members.isLoading && <tr><td className={cx('stateCell')} colSpan={10}>회원 목록을 불러오는 중입니다.</td></tr>}
            {members.isError && <tr><td className={cx('stateCell')} colSpan={10}>회원 목록을 불러오지 못했습니다. <button type="button" onClick={() => void members.refetch()}>다시 시도</button></td></tr>}
            {!members.isLoading && !members.isError && data?.content.length === 0 && <tr><td className={cx('stateCell')} colSpan={10}>검색 조건에 맞는 회원이 없습니다.</td></tr>}
            {data?.content.map(member => <MemberRow key={member.userId} member={member} onOpen={() => setSelectedUserId(member.userId)} />)}
          </tbody>
        </table>
      </div>
      {data && <footer className={cx('pager')}><span>{data.totalElements === 0 ? '0건' : `${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / 전체 ${data.totalElements}명`}</span><Pagination page={data.page} totalPages={data.totalPages} variant="numbered" disabled={members.isFetching} hasPrevPage={data.page > 0} hasNextPage={!data.last} onChange={setPage} /></footer>}
    </section>
    {selectedUserId && <MemberDetailModal
      detail={detail.data ?? undefined}
      isLoading={detail.isLoading}
      isError={detail.isError}
      isSaving={updateMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onClose={() => setSelectedUserId(null)}
      onRetry={() => void detail.refetch()}
      onUpdate={(userId, body) => updateMutation.mutate({ userId, body })}
      onDelete={userId => deleteMutation.mutate(userId)}
      actionError={updateMutation.isError ? getModalErrorMessage(updateMutation.error, '회원 정보를 저장하지 못했습니다.') : deleteMutation.isError ? getModalErrorMessage(deleteMutation.error, '회원 탈퇴 처리에 실패했습니다.') : ''}
    />}
  </div>;
}

function MemberRow({ member, onOpen }: { member: AdminUserListItem; onOpen: () => void }) {
  const connectionText = member.firstConnection ? `${member.firstConnection.counterpartName}${member.firstConnection.relation ? ` (${member.firstConnection.relation})` : ''}` : '—';
  return <tr className={cx({ restricted: member.status === 'RESTRICTED' })}>
    <td className={cx('userId')}>{member.userId}</td><td><Badge tone={member.provider === 'KAKAO' ? 'sun' : 'mute'}>{member.provider === 'KAKAO' ? '카카오' : '로컬'}</Badge></td><td>{member.email}</td><td className={cx('name')}>{member.name}</td><td><Badge tone={member.role === 'ADMIN' ? 'brand' : member.role === 'GUARDIAN' ? 'sun' : 'mute'}>{ROLE_LABEL[member.role]}</Badge></td>
    <td title={connectionText}>{connectionText}{member.connectionCount > 1 && <span className={cx('moreConnection')}> 외 {member.connectionCount - 1}명</span>}</td><td>{member.connectionState ? <Badge tone={member.connectionState === 'CONNECTED' ? 'safe' : member.connectionState === 'PENDING' ? 'sun' : 'warn'}>{CONNECTION_LABEL[member.connectionState]}</Badge> : '—'}</td><td className={cx('phone')}>{member.phone}</td><td title={member.statusReason ?? undefined}><Badge tone={member.status === 'ACTIVE' ? 'safe' : 'warn'}>{STATUS_LABEL[member.status]}</Badge></td>
    <td><button className={cx('editButton')} type="button" onClick={onOpen}>{member.role === 'ADMIN' ? '상세' : '관리'}</button></td>
  </tr>;
}

function Badge({ children, tone }: { children: string; tone: 'brand' | 'safe' | 'sun' | 'warn' | 'mute' }) { return <span className={cx('badge', tone)}>{children}</span>; }

interface MemberDetailModalProps {
  detail: AdminUserDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onRetry: () => void;
  onUpdate: (userId: string, body: Parameters<typeof updateAdminUser>[1]) => void;
  onDelete: (userId: string) => void;
  actionError: string;
}

function MemberDetailModal({ detail, isLoading, isError, isSaving, isDeleting, onClose, onRetry, onUpdate, onDelete, actionError }: MemberDetailModalProps) {
  return <div className={cx('modalOverlay')} role="presentation" onMouseDown={onClose}><section className={cx('modal')} role="dialog" aria-modal="true" aria-labelledby="admin-member-title" onMouseDown={event => event.stopPropagation()}>
    <header className={cx('modalHead')}><div><p>회원 상세</p><h2 id="admin-member-title">{detail?.name ?? '회원 정보'}</h2></div><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={20} /></button></header>
    {isLoading && <div className={cx('modalState')}>회원 정보를 불러오는 중입니다.</div>}
    {isError && <div className={cx('modalState')}>회원 정보를 불러오지 못했습니다.<button type="button" onClick={onRetry}>다시 시도</button></div>}
    {detail && <MemberDetailForm key={detail.userId} actionError={actionError} detail={detail} isDeleting={isDeleting} isSaving={isSaving} onDelete={onDelete} onUpdate={onUpdate} />}
  </section></div>;
}

function MemberDetailForm({ detail, isSaving, isDeleting, onUpdate, onDelete, actionError }: Pick<MemberDetailModalProps, 'detail' | 'isSaving' | 'isDeleting' | 'onUpdate' | 'onDelete' | 'actionError'> & { detail: AdminUserDetail }) {
  const [name, setName] = useState(detail.name);
  const [role, setRole] = useState<Exclude<AdminUserRole, 'ADMIN'>>(detail.role === 'ADMIN' ? 'GUARDIAN' : detail.role);
  const [status, setStatus] = useState<AdminUserStatus>(detail.status);
  const [statusReason, setStatusReason] = useState(detail.statusReason ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState('');

  const isAdmin = detail?.role === 'ADMIN';
  const isWard = detail?.role === 'WARD';
  const savingDisabled = isSaving || !detail || isAdmin || !name.trim() || (status === 'RESTRICTED' && isWard);
  const save = () => {
    if (!detail) return;
    if (status === 'RESTRICTED' && isWard) { setFeedback('피보호자는 안전을 위해 이용 제한할 수 없습니다.'); return; }
    onUpdate(detail.userId, { name: name.trim(), role, status, statusReason: status === 'RESTRICTED' ? statusReason.trim() || null : null });
  };

  return <div className={cx('modalBody')}>
      <div className={cx('detailMeta')}><span>{detail.userId}</span><Badge tone={detail.provider === 'KAKAO' ? 'sun' : 'mute'}>{detail.provider === 'KAKAO' ? '카카오 가입' : '로컬 가입'}</Badge><span>가입 {formatDate(detail.createdAt)}</span></div>
      <div className={cx('readOnly')}><div><span>이메일</span><b>{detail.email}</b></div><div><span>전화번호</span><b>{detail.phone}</b></div><div><span>최근 로그인</span><b>{detail.lastLoginAt ? formatDate(detail.lastLoginAt, true) : '로그인 이력 없음'}</b></div></div>
      <div className={cx('formGrid')}><label>이름<input maxLength={20} disabled={isAdmin} value={name} onChange={event => setName(event.target.value)} /></label><label>역할<select disabled={isAdmin} value={role} onChange={event => { const nextRole = event.target.value as Exclude<AdminUserRole, 'ADMIN'>; setRole(nextRole); if (nextRole === 'WARD') setStatus('ACTIVE'); }}><option value="GUARDIAN">보호자</option><option value="WARD">피보호자</option></select></label><label>계정 상태<select disabled={isAdmin || role === 'WARD'} value={status} onChange={event => setStatus(event.target.value as AdminUserStatus)}><option value="ACTIVE">이용 중</option><option value="RESTRICTED">이용 제한</option></select></label></div>
      {role === 'WARD' && <p className={cx('formNotice')}>피보호자는 SOS 안전망을 위해 이용 제한할 수 없습니다.</p>}
      {status === 'RESTRICTED' && <label className={cx('reason')}>이용 제한 사유<textarea maxLength={200} disabled={isAdmin} value={statusReason} onChange={event => setStatusReason(event.target.value)} placeholder="선택 입력 · 최대 200자" /></label>}
      <section className={cx('connections')}><h3>연결된 회원 <small>{detail.connections.length}명</small></h3>{detail.connections.length === 0 ? <p>연결된 회원이 없습니다.</p> : <ul>{detail.connections.map(connection => <li key={connection.connectionId}><span><b>{connection.counterpartName}</b> · {ROLE_LABEL[connection.counterpartRole]}{connection.relation ? ` (${connection.relation})` : ''}</span><Badge tone={connection.status === 'ACTIVE' ? 'safe' : 'sun'}>{connection.status === 'ACTIVE' ? '연결됨' : '수락 대기'}</Badge></li>)}</ul>}</section>
      {(feedback || actionError) && <p className={cx('errorMessage')}>{feedback || actionError}</p>}
      {!isAdmin && <div className={cx('modalActions')}><button className={cx('deleteButton')} type="button" disabled={isSaving || isDeleting} onClick={() => setConfirmDelete(true)}>강제 탈퇴</button><button className={cx('saveButton')} type="button" disabled={savingDisabled} onClick={save}>{isSaving ? '저장 중...' : '저장'}</button></div>}
      {isAdmin && <p className={cx('adminNotice')}>관리자 계정은 이 화면에서 수정하거나 삭제할 수 없습니다.</p>}
      {confirmDelete && <div className={cx('confirm')}><strong>정말 강제 탈퇴 처리할까요?</strong><p>계정과 연결 정보가 영구 삭제되며 복구할 수 없습니다.</p><div><button type="button" onClick={() => setConfirmDelete(false)}>취소</button><button type="button" disabled={isDeleting} onClick={() => onDelete(detail.userId)}>{isDeleting ? '처리 중...' : '영구 삭제'}</button></div></div>}
    </div>;
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
