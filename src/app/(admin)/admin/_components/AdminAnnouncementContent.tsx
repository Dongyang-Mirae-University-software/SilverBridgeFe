'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import * as announcementApi from '@/service/api/admin/announcement';
import { AdminAnnouncementItem, AdminAnnouncementWriteRequest } from '@/service/interface/admin/announcement';
import { adminAnnouncementDetailQueryOptions, adminAnnouncementListQueryOptions, adminAnnouncementQueryKey, adminAnnouncementSummaryQueryOptions } from '@/service/query/admin';
import styles from './AdminAnnouncementContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 10;
type Tab = 'ALL' | 'PUBLISHED' | 'DRAFT';
type EditorState = { item?: AdminAnnouncementItem; draft: boolean } | null;

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(date).replace(/\. /g, '. ').replace(/\.$/, '.'); }

export function AdminAnnouncementContent() {
  const [tab, setTab] = useState<Tab>('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<EditorState>(null);
  const [viewing, setViewing] = useState<{ id: number; draft: boolean } | null>(null);
  const client = useQueryClient();
  const draft = tab === 'DRAFT';
  // 서버에는 전체 공지 목록이 없으므로 전체 탭은 문서 권장 방식대로 게시 공지를 기본으로 보여 준다.
  const list = useQuery(adminAnnouncementListQueryOptions({ page, size: PAGE_SIZE, keyword: keyword.trim() || undefined }, draft));
  const summary = useQuery(adminAnnouncementSummaryQueryOptions);
  const invalidate = () => client.invalidateQueries({ queryKey: adminAnnouncementQueryKey });
  const remove = useMutation({ mutationFn: ({ id, isDraft }: { id: number; isDraft: boolean }) => isDraft ? announcementApi.deleteAdminAnnouncementDraft(id) : announcementApi.deleteAdminAnnouncement(id), onSuccess: invalidate });
  const changeTab = (next: Tab) => { setTab(next); setPage(0); setViewing(null); };
  const counts = { ALL: (summary.data?.publishedCount ?? 0) + (summary.data?.draftCount ?? 0), PUBLISHED: summary.data?.publishedCount ?? 0, DRAFT: summary.data?.draftCount ?? 0 };

  return <section className={cx('page')}>
    <header className={cx('heading')}><h1>공지사항</h1><button type="button" onClick={() => setEditor({ draft: false })}><Icon name="plus" size={16} decorative />공지 작성</button></header>
    <nav className={cx('tabs')} aria-label="공지 상태 필터">{([{ value: 'ALL', label: '전체' }, { value: 'PUBLISHED', label: '게시됨' }, { value: 'DRAFT', label: '임시저장' }] as const).map(item => <button type="button" key={item.value} className={cx({ active: tab === item.value })} onClick={() => changeTab(item.value)}>{item.label} <small>({counts[item.value]})</small></button>)}</nav>
    {tab === 'ALL' && <p className={cx('allNotice')}>전체에서는 게시된 공지를 먼저 보여 드립니다. 임시저장 글은 임시저장 탭에서 확인할 수 있습니다.</p>}
    <section className={cx('card')}><div className={cx('search')}><Icon name="search" size={16} decorative /><span className={cx('srOnly')}>공지 제목 검색</span><input value={keyword} maxLength={50} placeholder="공지 제목 검색" onChange={event => { setKeyword(event.target.value); setPage(0); }} />{keyword && <button type="button" aria-label="검색어 지우기" onClick={() => { setKeyword(''); setPage(0); }}><Icon name="close" size={14} decorative /></button>}</div>
      <div className={cx('tableScroll')}><table className={cx('table')}><thead><tr><th>제목</th><th>작성자</th><th>등록일</th><th>조회수</th><th><span className={cx('srOnly')}>관리</span></th></tr></thead><tbody>
        {list.isLoading && <StateRow>공지사항을 불러오는 중입니다.</StateRow>}{list.isError && <StateRow>공지사항을 불러오지 못했습니다. <button type="button" onClick={() => void list.refetch()}>다시 시도</button></StateRow>}{!list.isLoading && !list.isError && list.data?.content.length === 0 && <StateRow>{keyword ? '검색 결과가 없습니다.' : '등록된 공지사항이 없습니다.'}</StateRow>}
        {list.data?.content.map(item => <AnnouncementRow key={item.id} item={item} draft={draft} onView={() => setViewing({ id: item.id, draft })} onEdit={() => setEditor({ item, draft })} onDelete={() => { if (window.confirm('이 공지를 영구 삭제할까요?')) remove.mutate({ id: item.id, isDraft: draft }); }} />)}
      </tbody></table></div>
      {list.data && <footer className={cx('pager')}><span>{list.data.totalElements === 0 ? '0건' : `${list.data.page * list.data.size + 1}–${Math.min((list.data.page + 1) * list.data.size, list.data.totalElements)} / 전체 ${list.data.totalElements}건`}</span><Pagination page={list.data.page} totalPages={list.data.totalPages} variant="numbered" disabled={list.isFetching} hasPrevPage={list.data.page > 0} hasNextPage={!list.data.last} onChange={setPage} /></footer>}
    </section>
    {editor && <AnnouncementEditor state={editor} onClose={() => setEditor(null)} onPublished={() => { void invalidate(); setEditor(null); setTab('PUBLISHED'); setPage(0); }} onDrafted={() => { void invalidate(); setEditor(null); setTab('DRAFT'); setPage(0); }} />}
    {viewing && <AnnouncementDetail state={viewing} onClose={() => setViewing(null)} onEdit={(item, isDraft) => { setViewing(null); setEditor({ item, draft: isDraft }); }} />}
  </section>;
}

function AnnouncementRow({ item, draft, onView, onEdit, onDelete }: { item: AdminAnnouncementItem; draft: boolean; onView: () => void; onEdit: () => void; onDelete: () => void }) { return <tr><td className={cx('title')}><div>{draft && <span className={cx('draftBadge')}>임시저장</span>}<button type="button" onClick={onView}>{item.title || '(제목 없음)'}</button></div></td><td>{item.authorName ?? '-'}</td><td>{formatDate(item.createdAt)}</td><td className={cx('views')}>{draft ? '-' : (item.viewCount ?? 0).toLocaleString('ko-KR')}</td><td><div className={cx('actions')}><button type="button" onClick={onEdit}>수정</button><button type="button" onClick={onDelete}>삭제</button></div></td></tr>; }
function StateRow({ children }: { children: ReactNode }) { return <tr><td className={cx('state')} colSpan={5}>{children}</td></tr>; }

function AnnouncementEditor({ state, onClose, onPublished, onDrafted }: { state: Exclude<EditorState, null>; onClose: () => void; onPublished: () => void; onDrafted: () => void }) {
  const [title, setTitle] = useState(state.item?.title ?? ''); const [content, setContent] = useState(state.item?.content ?? ''); const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: async ({ destination }: { destination: 'published' | 'draft' }) => { const body: AdminAnnouncementWriteRequest = { title, content }; if (state.item) { if (state.draft) { if (destination === 'draft') return announcementApi.updateAdminAnnouncementDraft(state.item.id, body); await announcementApi.updateAdminAnnouncementDraft(state.item.id, body); return announcementApi.publishAdminAnnouncementDraft(state.item.id); } return announcementApi.updateAdminAnnouncement(state.item.id, body); } return destination === 'draft' ? announcementApi.createAdminAnnouncementDraft(body) : announcementApi.createAdminAnnouncement(body); }, onSuccess: (_, variables) => variables.destination === 'draft' ? onDrafted() : onPublished(), onError: () => setError('저장하지 못했습니다. 제목과 내용을 확인해 주세요.') });
  const isPublished = Boolean(state.item && !state.draft); const canPublish = title.trim().length > 0 && content.trim().length > 0;
  return <Modal onClose={onClose}><header className={cx('modalHead')}><h2>{state.item ? '공지 수정' : '새 공지 작성'}</h2><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={16} decorative /></button></header><div className={cx('editorBody')}><label>제목<input value={title} maxLength={200} placeholder="공지사항 제목" onChange={event => setTitle(event.target.value)} /><small>{title.length}/200</small></label><label>내용<textarea value={content} maxLength={5000} rows={10} placeholder="안내 내용을 입력하세요" onChange={event => setContent(event.target.value)} /><small>{content.length}/5000</small></label>{error && <p className={cx('error')} role="alert">{error}</p>}<footer><button type="button" onClick={onClose}>취소</button>{!isPublished && <button type="button" className={cx('draftButton')} disabled={mutation.isPending} onClick={() => mutation.mutate({ destination: 'draft' })}>임시저장</button>}<button type="button" className={cx('publishButton')} disabled={!canPublish || mutation.isPending} onClick={() => mutation.mutate({ destination: 'published' })}>{mutation.isPending ? '저장 중...' : state.draft && state.item ? '게시' : isPublished ? '저장' : '게시'}</button></footer></div></Modal>;
}

function AnnouncementDetail({ state, onClose, onEdit }: { state: { id: number; draft: boolean }; onClose: () => void; onEdit: (item: AdminAnnouncementItem, draft: boolean) => void }) { const detail = useQuery(adminAnnouncementDetailQueryOptions(state.id, state.draft)); const item = detail.data; return <Modal onClose={onClose}>{detail.isLoading && <div className={cx('modalState')}>공지사항을 불러오는 중입니다.</div>}{detail.isError && <div className={cx('modalState')}>공지사항을 불러오지 못했습니다.<button type="button" onClick={() => void detail.refetch()}>다시 시도</button></div>}{item && <><header className={cx('modalHead')}><div>{state.draft && <span className={cx('draftBadge')}>임시저장</span>}<h2>{item.title || '(제목 없음)'}</h2></div><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={16} decorative /></button></header><div className={cx('detailBody')}><div className={cx('meta')}><span>작성자 <b>{item.authorName ?? '-'}</b></span><span>등록일 {formatDate(item.createdAt)}</span>{!state.draft && <span>조회 {(item.viewCount ?? 0).toLocaleString('ko-KR')}</span>}</div><p>{item.content || '내용이 없습니다.'}</p><footer><button type="button" onClick={onClose}>닫기</button><button type="button" onClick={() => onEdit(item, state.draft)}>수정</button></footer></div></>}</Modal>; }
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) { return <div className={cx('overlay')} role="presentation" onMouseDown={onClose}><section className={cx('modal')} role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>{children}</section></div>; }
