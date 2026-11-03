'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { AdminInquiryCategory, AdminInquiryDetail, AdminInquiryListItem, AdminInquiryStatus } from '@/service/interface/admin/inquiry';
import { adminInquiryDetailQueryOptions, adminInquiryListQueryOptions, useAnswerAdminInquiryMutation } from '@/service/query/admin';
import styles from './AdminInquiryContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 20;
type InquiryTab = 'ALL' | AdminInquiryStatus;

const CATEGORY_LABEL: Record<AdminInquiryCategory, string> = { ANOMALY: '이상감지 관련', HOSPITAL: '병원 관련', ACCOUNT: '계정/회원', SERVICE: '서비스 이용', ETC: '기타' };
const CATEGORY_TONES: Record<AdminInquiryCategory, string> = { ANOMALY: 'anomaly', HOSPITAL: 'hospital', ACCOUNT: 'account', SERVICE: 'service', ETC: 'etc' };
const TAB_ITEMS: Array<{ value: InquiryTab; label: string }> = [{ value: 'ALL', label: '전체' }, { value: 'WAITING', label: '답변 대기' }, { value: 'ANSWERED', label: '답변 완료' }];

function formatDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return '-'; return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(date).replace(/\. /g, '. ').replace(/\.$/, '.'); }
function formatDateTime(value: string | null) { if (!value) return '-'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '-'; return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(date); }

export function AdminInquiryContent() {
  const [tab, setTab] = useState<InquiryTab>('ALL');
  const [category, setCategory] = useState<AdminInquiryCategory | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const params = { category: category === 'ALL' ? undefined : category, status: tab === 'ALL' ? undefined : tab, keyword: keyword.trim() || undefined, page, size: PAGE_SIZE };
  const list = useQuery(adminInquiryListQueryOptions(params));
  const data = list.data;
  const updateTab = (value: InquiryTab) => { setTab(value); setPage(0); };
  const updateCategory = (value: AdminInquiryCategory | 'ALL') => { setCategory(value); setPage(0); };
  const updateKeyword = (value: string) => { setKeyword(value); setPage(0); };

  return <section className={cx('page')}>
    <header className={cx('heading')}><h1>고객센터</h1></header>
    <nav className={cx('tabs')} aria-label="문의 상태 필터">{TAB_ITEMS.map(item => <button key={item.value} className={cx('tab', { active: tab === item.value })} type="button" onClick={() => updateTab(item.value)}>{item.label}<span className={cx({ waitingCount: item.value === 'WAITING' && tab !== item.value })}>{item.value === 'ALL' ? data?.totalCount ?? '-' : item.value === 'WAITING' ? data?.waitingCount ?? '-' : data?.answeredCount ?? '-'}</span></button>)}</nav>
    <section className={cx('card')}>
      <div className={cx('filterBar')}><label className={cx('search')}><Icon name="search" size={16} decorative /><span className={cx('srOnly')}>제목, 작성자 또는 내용 검색</span><input value={keyword} placeholder="제목 · 작성자 · 내용 검색" onChange={event => updateKeyword(event.target.value)} />{keyword && <button type="button" aria-label="검색어 지우기" onClick={() => updateKeyword('')}><Icon name="close" size={14} decorative /></button>}</label><label className={cx('categorySelect')}><span className={cx('srOnly')}>문의 카테고리</span><select value={category} onChange={event => updateCategory(event.target.value as AdminInquiryCategory | 'ALL')}><option value="ALL">카테고리: 전체</option>{(Object.keys(CATEGORY_LABEL) as AdminInquiryCategory[]).map(value => <option key={value} value={value}>카테고리: {CATEGORY_LABEL[value]}</option>)}</select></label></div>
      <div className={cx('tableScroll')}><table className={cx('table')}><colgroup><col className={cx('categoryColumn')} /><col className={cx('titleColumn')} /><col className={cx('authorColumn')} /><col className={cx('dateColumn')} /><col className={cx('statusColumn')} /><col className={cx('actionColumn')} /></colgroup><thead><tr><th className={cx('categoryCell')}>카테고리</th><th>제목</th><th>보호자</th><th>날짜</th><th>상태</th><th><span className={cx('srOnly')}>상세 보기</span></th></tr></thead><tbody>{list.isLoading && <StateRow>문의를 불러오는 중입니다.</StateRow>}{list.isError && <StateRow>문의를 불러오지 못했습니다. <button type="button" onClick={() => void list.refetch()}>다시 시도</button></StateRow>}{!list.isLoading && !list.isError && data?.inquiries.content.length === 0 && <StateRow>검색 결과가 없습니다.</StateRow>}{data?.inquiries.content.map(item => <InquiryRow key={item.id} item={item} onOpen={setSelectedId} />)}</tbody></table></div>
      {data && <footer className={cx('pager')}><span>{data.inquiries.totalElements === 0 ? '0건' : `${data.inquiries.page * data.inquiries.size + 1}–${Math.min((data.inquiries.page + 1) * data.inquiries.size, data.inquiries.totalElements)} / 전체 ${data.inquiries.totalElements}건`}</span><Pagination page={data.inquiries.page} totalPages={data.inquiries.totalPages} variant="numbered" disabled={list.isFetching} hasPrevPage={data.inquiries.page > 0} hasNextPage={!data.inquiries.last} onChange={setPage} /></footer>}
    </section>
    {selectedId !== null && <InquiryModal inquiryId={selectedId} onClose={() => setSelectedId(null)} />}
  </section>;
}

function InquiryRow({ item, onOpen }: { item: AdminInquiryListItem; onOpen: (id: number) => void }) { return <tr className={cx('selectableRow')} tabIndex={0} onClick={() => onOpen(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item.id); } }}><td className={cx('categoryCell')}><CategoryBadge category={item.category} /></td><td className={cx('titleCell')} title={item.title}>{item.title}</td><td>{item.authorName}</td><td className={cx('date')}>{formatDate(item.createdAt)}</td><td><StatusBadge status={item.status} /></td><td><button className={cx('actionButton')} type="button" onClick={event => { event.stopPropagation(); onOpen(item.id); }}>{item.status === 'ANSWERED' ? '보기' : '답변'}</button></td></tr>; }
function CategoryBadge({ category }: { category: AdminInquiryCategory }) { return <span className={cx('categoryBadge', CATEGORY_TONES[category])}>{CATEGORY_LABEL[category]}</span>; }
function StatusBadge({ status }: { status: AdminInquiryStatus }) { return <span className={cx('statusBadge', status.toLowerCase())}>{status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</span>; }
function StateRow({ children }: { children: ReactNode }) { return <tr><td className={cx('stateCell')} colSpan={6}>{children}</td></tr>; }

function InquiryModal({ inquiryId, onClose }: { inquiryId: number; onClose: () => void }) {
  const detail = useQuery(adminInquiryDetailQueryOptions(inquiryId));
  const answerMutation = useAnswerAdminInquiryMutation();
  const [answer, setAnswer] = useState('');
  const inquiry = detail.data;
  const submit = () => { if (!inquiry || !answer.trim() || answerMutation.isPending) return; answerMutation.mutate({ id: inquiry.id, answer: answer.trim() }); };
  return <div className={cx('modalOverlay')} role="presentation" onMouseDown={onClose}><section className={cx('modal')} role="dialog" aria-modal="true" aria-labelledby="admin-inquiry-title" onMouseDown={event => event.stopPropagation()}>{detail.isLoading && <div className={cx('modalState')}>문의를 불러오는 중입니다.</div>}{detail.isError && <div className={cx('modalState')}>문의를 불러오지 못했습니다.<button type="button" onClick={() => void detail.refetch()}>다시 시도</button></div>}{inquiry && <InquiryDetail inquiry={inquiry} answer={answer} setAnswer={setAnswer} isSaving={answerMutation.isPending} error={answerMutation.isError ? '답변을 등록하지 못했습니다. 이미 답변된 문의인지 확인해 주세요.' : null} onSubmit={submit} onClose={onClose} />}</section></div>;
}

function InquiryDetail({ inquiry, answer, setAnswer, isSaving, error, onSubmit, onClose }: { inquiry: AdminInquiryDetail; answer: string; setAnswer: (value: string) => void; isSaving: boolean; error: string | null; onSubmit: () => void; onClose: () => void }) { const answered = inquiry.status === 'ANSWERED'; return <><header className={cx('modalHead')}><div><div className={cx('modalBadges')}><CategoryBadge category={inquiry.category} /><StatusBadge status={inquiry.status} /></div><h2 id="admin-inquiry-title">{inquiry.title}</h2><p>{inquiry.authorName} · {formatDate(inquiry.createdAt)}</p></div><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={16} decorative /></button></header><div className={cx('modalBody')}><section className={cx('question')}><b>문의 내용</b><p>{inquiry.content}</p></section>{answered ? <section className={cx('answerBox')}><b>답변 내용</b><p>{inquiry.answer}</p><small>{inquiry.answeredByName ?? '관리자'} · {formatDateTime(inquiry.answeredAt)}</small></section> : <section className={cx('answerForm')}><label htmlFor="admin-inquiry-answer">답변 작성</label><textarea id="admin-inquiry-answer" value={answer} onChange={event => setAnswer(event.target.value)} rows={5} maxLength={4000} placeholder="답변 내용을 입력하세요" /><div><small>{answer.length}/4000</small>{error && <p role="alert">{error}</p>}</div><footer><button type="button" onClick={onClose}>닫기</button><button type="button" disabled={!answer.trim() || isSaving} onClick={onSubmit}>{isSaving ? '등록 중...' : '답변 전송'}</button></footer></section>}</div></>; }
