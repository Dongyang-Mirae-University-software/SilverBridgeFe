'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import * as hospitalApi from '@/service/api/admin/hospital';
import {
  AdminHospitalCongestionLevel,
  AdminHospitalCreateRequest,
  AdminHospitalItem,
  AdminHospitalOperationStatus,
  AdminHospitalStatusUpdateRequest,
  AdminHospitalUpdateRequest,
  AdminHospitalWeekdayHours,
} from '@/service/interface/admin/hospital';
import { adminHospitalListQueryOptions, adminHospitalQueryKey, adminHospitalSummaryQueryOptions } from '@/service/query/admin';
import styles from './AdminHospitalsContent.module.css';

const cx = classNames.bind(styles);
const PAGE_SIZE = 10;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const COMMON_DEPARTMENTS = ['내과', '가정의학과', '정형외과', '재활의학과', '신경과', '신경외과', '안과', '이비인후과', '치과', '피부과', '한방내과', '침구과', '비뇨의학과'];

type FormState = {
  name: string; region: string; address: string; phone: string; description: string;
  openTime: string; closeTime: string; bookingAvailable: boolean; departments: string[];
  breakStart: string; breakEnd: string; closedWeekdays: number[]; weekdayHours: AdminHospitalWeekdayHours[];
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(date);
}

function errorCode(error: unknown) { return isAxiosError<{ code?: string }>(error) ? error.response?.data?.code : undefined; }
function requiresListRefresh(error: unknown) { const code = errorCode(error); return code === 'HOSPITAL_RESULT_UNKNOWN' || code === 'HOSPITAL_SERVICE_TIMEOUT'; }
function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) return error.response?.data?.message;
  return undefined;
}

function formOf(hospital?: AdminHospitalItem): FormState {
  return {
    name: hospital?.name ?? '', region: hospital?.region ?? '', address: hospital?.address ?? '', phone: hospital?.phone ?? '', description: hospital?.description ?? '',
    openTime: hospital?.openTime ?? '09:00', closeTime: hospital?.closeTime ?? '18:00', bookingAvailable: hospital?.bookingAvailable ?? true,
    departments: hospital?.departments.map(department => department.name).filter((name): name is string => Boolean(name)) ?? [],
    breakStart: hospital?.breakStart ?? '', breakEnd: hospital?.breakEnd ?? '', closedWeekdays: hospital?.closedWeekdays ?? [], weekdayHours: hospital?.weekdayHours ?? [],
  };
}

function cleanForm(form: FormState): AdminHospitalCreateRequest {
  return {
    name: form.name.trim(), region: form.region.trim(), address: form.address.trim(), phone: form.phone.trim(), description: form.description,
    openTime: form.openTime, closeTime: form.closeTime, bookingAvailable: form.bookingAvailable,
    departments: form.departments.map(value => value.trim()).filter(Boolean),
    ...(form.breakStart && form.breakEnd ? { breakStart: form.breakStart, breakEnd: form.breakEnd } : {}),
    ...(form.closedWeekdays.length ? { closedWeekdays: form.closedWeekdays } : {}),
    ...(form.weekdayHours.length ? { weekdayHours: form.weekdayHours } : {}),
  };
}

function changedHospitalFields(form: FormState, original: AdminHospitalItem): AdminHospitalUpdateRequest {
  const next = cleanForm(form); const result: AdminHospitalUpdateRequest = {};
  if (next.name !== (original.name ?? '')) result.name = next.name;
  if (next.region !== (original.region ?? '')) result.region = next.region;
  if (next.address !== (original.address ?? '')) result.address = next.address;
  if (next.phone !== (original.phone ?? '')) result.phone = next.phone;
  if (next.description !== original.description) result.description = next.description;
  if (next.openTime !== (original.openTime ?? '')) result.openTime = next.openTime;
  if (next.closeTime !== (original.closeTime ?? '')) result.closeTime = next.closeTime;
  if (next.bookingAvailable !== original.bookingAvailable) result.bookingAvailable = next.bookingAvailable;
  if ((next.breakStart || '') !== (original.breakStart || '')) result.breakStart = next.breakStart;
  if ((next.breakEnd || '') !== (original.breakEnd || '')) result.breakEnd = next.breakEnd;
  if (JSON.stringify([...(next.closedWeekdays ?? [])].sort()) !== JSON.stringify([...(original.closedWeekdays ?? [])].sort())) result.closedWeekdays = next.closedWeekdays;
  if (JSON.stringify(next.weekdayHours) !== JSON.stringify(original.weekdayHours ?? [])) result.weekdayHours = next.weekdayHours;
  return result;
}

function writeMessage(error: unknown) {
  const code = errorCode(error);
  if (code === 'HOSPITAL_RESULT_UNKNOWN') return '반영 여부를 확인하고 있어요. 목록을 새로고침해 확인해 주세요.';
  if (code === 'HOSPITAL_SERVICE_TIMEOUT') return '응답이 늦습니다. 목록을 새로고침해 반영 여부를 먼저 확인해 주세요.';
  if (code === 'HOSPITAL_DUPLICATED') return '같은 이름과 주소의 병원이 이미 있어요.';
  if (code === 'HOSPITAL_DEPARTMENT_DUPLICATED') return '이미 등록된 진료과입니다.';
  if (code === 'HOSPITAL_INVALID_HOURS') return '진료 시작은 종료보다 빨라야 합니다.';
  if (code === 'HOSPITAL_SERVICE_UNAVAILABLE') return '제휴 병원 관리를 지금 사용할 수 없습니다.';
  return errorMessage(error) || '입력값을 확인한 뒤 다시 시도해 주세요.';
}

export function AdminHospitalsContent() {
  const [query, setQuery] = useState(''); const [region, setRegion] = useState(''); const [department, setDepartment] = useState(''); const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<AdminHospitalItem | 'new' | null>(null); const [statusTarget, setStatusTarget] = useState<AdminHospitalItem | null>(null); const [deleteTarget, setDeleteTarget] = useState<AdminHospitalItem | null>(null);
  const client = useQueryClient();
  const params = { q: query.trim() || undefined, region: region.trim() || undefined, department: department.trim() || undefined, page, size: PAGE_SIZE };
  const list = useQuery(adminHospitalListQueryOptions(params)); const summary = useQuery(adminHospitalSummaryQueryOptions);
  const unavailable = errorCode(list.error) === 'HOSPITAL_SERVICE_UNAVAILABLE' || errorCode(summary.error) === 'HOSPITAL_SERVICE_UNAVAILABLE';
  const invalidate = async () => { await client.invalidateQueries({ queryKey: adminHospitalQueryKey }); };
  const remove = useMutation({ mutationFn: hospitalApi.deleteAdminHospital, onSuccess: async () => { setDeleteTarget(null); await invalidate(); } });

  const departmentOptions = useMemo(() => Array.from(new Set(list.data?.content.flatMap(item => item.departments.map(departmentItem => departmentItem.name ?? '')).filter(Boolean) ?? [])), [list.data]);
  const updateFilter = (update: () => void) => { update(); setPage(0); };

  return <section className={cx('page')}>
    <header className={cx('heading')}><h1>제휴 병원</h1><button type="button" onClick={() => setEditor('new')} disabled={unavailable}><Icon name="plus" size={15} decorative />병원 추가</button></header>
    <section className={cx('summaryGrid')} aria-label="제휴 병원 요약">
      <SummaryCard icon="hospital" label="제휴 병원" value={summary.data ? `${summary.data.total.toLocaleString('ko-KR')}곳` : '-'} />
      <SummaryCard icon="calendar" label="최근 제휴" value={formatDate(summary.data?.latestRegisteredAt ?? null)} detail={summary.data ? `앱 예약 가능 ${summary.data.bookingAvailable.toLocaleString('ko-KR')}곳` : undefined} tone="sun" />
    </section>
    {unavailable ? <Unavailable onRetry={() => { void list.refetch(); void summary.refetch(); }} /> : <section className={cx('card')}>
      <div className={cx('filterBar')}>
        <label className={cx('search')}><Icon name="search" size={16} decorative /><span className={cx('srOnly')}>병원 검색</span><input value={query} maxLength={100} placeholder="병원명·지역·주소 검색" onChange={event => updateFilter(() => setQuery(event.target.value))} />{query && <button type="button" aria-label="검색어 지우기" onClick={() => updateFilter(() => setQuery(''))}><Icon name="close" size={14} decorative /></button>}</label>
        <label className={cx('filterSelect')}><span>지역</span><input value={region} maxLength={30} placeholder="전체" onChange={event => updateFilter(() => setRegion(event.target.value))} /></label>
        <label className={cx('filterSelect')}><span>진료과</span><select value={department} onChange={event => updateFilter(() => setDepartment(event.target.value))}><option value="">전체</option>{departmentOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <div className={cx('tableScroll')}><table className={cx('table')}><colgroup><col className={cx('hospitalColumn')} /><col className={cx('departmentColumn')} /><col className={cx('addressColumn')} /><col className={cx('hoursColumn')} /><col className={cx('actionColumn')} /></colgroup><thead><tr><th>병원명</th><th>진료과</th><th>주소</th><th>진료 시간</th><th><span className={cx('srOnly')}>관리</span></th></tr></thead><tbody>
        {list.isLoading && <StateRow>제휴 병원 목록을 불러오는 중입니다.</StateRow>}
        {list.isError && <StateRow>제휴 병원 목록을 불러오지 못했습니다. <button type="button" onClick={() => void list.refetch()}>다시 시도</button></StateRow>}
        {!list.isLoading && !list.isError && list.data?.content.length === 0 && <StateRow>조건에 맞는 제휴 병원이 없습니다.</StateRow>}
        {list.data?.content.map(item => <HospitalRow item={item} key={item.id} onEdit={() => setEditor(item)} onStatus={() => setStatusTarget(item)} onDelete={() => setDeleteTarget(item)} />)}
      </tbody></table></div>
      {list.data && <footer className={cx('pager')}><span>{list.data.totalElements === 0 ? '0곳' : `${list.data.page * list.data.size + 1}-${Math.min((list.data.page + 1) * list.data.size, list.data.totalElements)} / 전체 ${list.data.totalElements}곳`}</span><Pagination page={list.data.page} totalPages={list.data.totalPages} variant="numbered" disabled={list.isFetching} hasPrevPage={list.data.page > 0} hasNextPage={!list.data.last} onChange={setPage} /></footer>}
    </section>}
    {editor && <HospitalEditor hospital={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await invalidate(); }} />}
    {statusTarget && <StatusEditor hospital={statusTarget} onClose={() => setStatusTarget(null)} onSaved={async () => { setStatusTarget(null); await invalidate(); }} />}
    {deleteTarget && <ConfirmModal title="제휴 병원을 삭제할까요?" description="삭제하면 되돌릴 수 없습니다. 이미 잡힌 예약 기록은 남습니다." confirmLabel="삭제" pending={remove.isPending} error={remove.error} onClose={() => setDeleteTarget(null)} onConfirm={() => remove.mutate(deleteTarget.id)} onRefresh={() => { remove.reset(); setDeleteTarget(null); void invalidate(); }} />}
  </section>;
}

function SummaryCard({ icon, label, value, detail, tone = 'brand' }: { icon: 'hospital' | 'calendar'; label: string; value: string; detail?: string; tone?: 'brand' | 'sun' }) { return <div className={cx('summaryCard')}><span><i className={cx('summaryIcon', tone)}><Icon name={icon} size={16} decorative /></i>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }
function HospitalRow({ item, onEdit, onStatus, onDelete }: { item: AdminHospitalItem; onEdit: () => void; onStatus: () => void; onDelete: () => void }) { return <tr><td><div className={cx('hospitalName')}><b>{item.name ?? '-'}</b><small>{item.region ?? '-'}</small></div></td><td className={cx('departmentCell')}><div className={cx('departments')}>{item.departments.length ? item.departments.map(department => <span key={department.id}>{department.name ?? '-'}</span>) : '-'}</div></td><td className={cx('address')} title={item.address ?? undefined}>{item.address ?? '-'}</td><td className={cx('hours')}><b>{item.openTime && item.closeTime ? `${item.openTime} - ${item.closeTime}` : '-'}</b>{item.breakStart && item.breakEnd && <small>휴게 {item.breakStart} - {item.breakEnd}</small>}</td><td><div className={cx('actions')}><button type="button" onClick={onEdit}>수정</button><button type="button" onClick={onStatus}>운영</button><button type="button" className={cx('delete')} onClick={onDelete}>삭제</button></div></td></tr>; }
function StateRow({ children }: { children: ReactNode }) { return <tr><td className={cx('state')} colSpan={5}>{children}</td></tr>; }
function Unavailable({ onRetry }: { onRetry: () => void }) { return <section className={cx('unavailable')}><Icon name="hospital" size={30} decorative /><strong>제휴 병원 관리를 지금 사용할 수 없습니다.</strong><p>예약 서비스 연결 상태를 확인한 뒤 다시 시도해 주세요.</p><button type="button" onClick={onRetry}><Icon name="refresh" size={15} decorative />새로고침</button></section>; }

function HospitalEditor({ hospital, onClose, onSaved }: { hospital?: AdminHospitalItem; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(() => formOf(hospital)); const [departmentInput, setDepartmentInput] = useState(''); const [error, setError] = useState<string | null>(null); const [refreshRequired, setRefreshRequired] = useState(false);
  const isEdit = Boolean(hospital);
  const mutation = useMutation({ mutationFn: () => { const payload = cleanForm(form); if (!payload.name || !payload.region || !payload.address || !payload.phone || !payload.departments.length) throw new Error('병원명, 지역, 주소, 연락처와 진료과를 입력해 주세요.'); if (payload.openTime >= payload.closeTime) throw new Error('진료 시작은 종료보다 빨라야 합니다.'); if (isEdit) { const changes = changedHospitalFields(form, hospital!); if (!Object.keys(changes).length) throw new Error('변경한 정보가 없습니다.'); return hospitalApi.updateAdminHospital(hospital!.id, changes); } return hospitalApi.createAdminHospital(payload); }, onSuccess: () => { void onSaved(); }, onError: errorValue => { setRefreshRequired(requiresListRefresh(errorValue)); setError(errorValue instanceof Error ? errorValue.message : writeMessage(errorValue)); } });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));
  const addDepartment = () => { const value = departmentInput.trim(); if (!value) return; if (form.departments.some(item => item.replaceAll(' ', '').toLowerCase() === value.replaceAll(' ', '').toLowerCase())) { setError('이미 추가한 진료과입니다.'); return; } if (form.departments.length >= 20) { setError('진료과는 최대 20개까지 추가할 수 있습니다.'); return; } set('departments', [...form.departments, value]); setDepartmentInput(''); setError(null); };
  const toggleClosed = (weekday: number) => set('closedWeekdays', form.closedWeekdays.includes(weekday) ? form.closedWeekdays.filter(value => value !== weekday) : [...form.closedWeekdays, weekday]);
  const setSaturdayHours = (key: 'openTime' | 'closeTime', value: string) => { const rest = form.weekdayHours.filter(item => item.weekday !== 6); set('weekdayHours', [...rest, { weekday: 6, openTime: key === 'openTime' ? value : (form.weekdayHours.find(item => item.weekday === 6)?.openTime ?? '09:00'), closeTime: key === 'closeTime' ? value : (form.weekdayHours.find(item => item.weekday === 6)?.closeTime ?? '13:00') }]); };
  const saturday = form.weekdayHours.find(item => item.weekday === 6);
  return <Modal onClose={onClose}><header className={cx('modalHead')}><div><h2>{isEdit ? '제휴 병원 정보 수정' : '제휴 병원 추가'}</h2><p>앱에서 예약 가능한 병원 정보를 등록합니다.</p></div><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={16} decorative /></button></header><div className={cx('formBody')}>
    <div className={cx('formGrid')}><Field label="병원명" required><input value={form.name} maxLength={100} placeholder="예) 강남내과" onChange={event => set('name', event.target.value)} /></Field><Field label="대표 전화" required><input value={form.phone} maxLength={20} placeholder="02-0000-0000" onChange={event => set('phone', event.target.value)} /></Field><Field label="지역" required><input value={form.region} maxLength={30} placeholder="예) 서울 강남구" onChange={event => set('region', event.target.value)} /></Field><Field label="주소" required><input value={form.address} maxLength={200} placeholder="도로명 주소" onChange={event => set('address', event.target.value)} /></Field></div>
    <Field label="병원 소개"><textarea value={form.description} maxLength={1000} rows={3} placeholder="진료 특징을 입력하세요." onChange={event => set('description', event.target.value)} /></Field>
    {!isEdit ? <section className={cx('departmentEditor')}><div className={cx('fieldLabel')}>진료과 <em>필수</em></div><div className={cx('departmentList')}>{form.departments.map((name, index) => <span key={`${name}-${index}`}>{name}<button type="button" aria-label={`${name} 삭제`} onClick={() => set('departments', form.departments.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div><div className={cx('departmentAdd')}><input value={departmentInput} maxLength={30} placeholder="진료과 직접 입력" onChange={event => setDepartmentInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addDepartment(); } }} /><button type="button" onClick={addDepartment}>추가</button></div><div className={cx('quickDepartments')}>{COMMON_DEPARTMENTS.filter(item => !form.departments.includes(item)).map(item => <button type="button" key={item} onClick={() => set('departments', [...form.departments, item])}>{item}</button>)}</div></section> : null}
    <section className={cx('hoursEditor')}><div className={cx('fieldLabel')}>진료 시간 <em>필수</em></div><div className={cx('timeRow')}><b>기본</b><input type="time" value={form.openTime} onChange={event => set('openTime', event.target.value)} /><span>-</span><input type="time" value={form.closeTime} onChange={event => set('closeTime', event.target.value)} /></div><div className={cx('timeRow')}><b>휴게</b><input type="time" value={form.breakStart} onChange={event => set('breakStart', event.target.value)} /><span>-</span><input type="time" value={form.breakEnd} onChange={event => set('breakEnd', event.target.value)} /></div><div className={cx('timeRow')}><b>토요일</b><input type="time" value={saturday?.openTime ?? ''} onChange={event => setSaturdayHours('openTime', event.target.value)} /><span>-</span><input type="time" value={saturday?.closeTime ?? ''} onChange={event => setSaturdayHours('closeTime', event.target.value)} /></div><div className={cx('weekdayRow')}>{WEEKDAYS.map((day, index) => <label className={cx({ closed: form.closedWeekdays.includes(index) })} key={day}><input type="checkbox" checked={form.closedWeekdays.includes(index)} onChange={() => toggleClosed(index)} />{day} 휴무</label>)}</div></section>
    <label className={cx('bookingSwitch')}><span><b>앱 예약 가능</b><small>보호자와 피보호자가 앱에서 새 예약을 할 수 있어요.</small></span><input type="checkbox" checked={form.bookingAvailable} onChange={event => set('bookingAvailable', event.target.checked)} /></label>
    {isEdit && hospital && <DepartmentManager hospital={hospital} onChanged={onSaved} />}
    {error && <p className={cx('formError')} role="alert">{error}{refreshRequired && <button type="button" onClick={() => void onSaved()}>목록 새로고침</button>}</p>}<footer className={cx('formActions')}><button type="button" onClick={onClose}>취소</button><button type="button" disabled={mutation.isPending || refreshRequired} onClick={() => mutation.mutate()}>{mutation.isPending ? '저장 중...' : isEdit ? '저장' : '병원 추가'}</button></footer>
  </div></Modal>;
}

function DepartmentManager({ hospital, onChanged }: { hospital: AdminHospitalItem; onChanged: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<number, string>>({}); const [newDepartment, setNewDepartment] = useState(''); const [error, setError] = useState<string | null>(null); const [refreshRequired, setRefreshRequired] = useState(false); const [deleteId, setDeleteId] = useState<number | null>(null);
  const showError = (errorValue: unknown) => { setRefreshRequired(requiresListRefresh(errorValue)); setError(writeMessage(errorValue)); };
  const create = useMutation({ mutationFn: () => hospitalApi.createAdminHospitalDepartment(hospital.id, newDepartment.trim()), onSuccess: () => { void onChanged(); }, onError: showError });
  const edit = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => hospitalApi.updateAdminHospitalDepartment(hospital.id, id, name.trim()), onSuccess: () => { void onChanged(); }, onError: showError });
  const remove = useMutation({ mutationFn: (id: number) => hospitalApi.deleteAdminHospitalDepartment(hospital.id, id), onSuccess: () => { setDeleteId(null); void onChanged(); }, onError: showError });
  return <section className={cx('departmentManage')}><div className={cx('fieldLabel')}>등록된 진료과 관리</div>{hospital.departments.map(department => <div className={cx('departmentManageRow')} key={department.id}><input value={drafts[department.id] ?? department.name ?? ''} maxLength={30} onChange={event => setDrafts(current => ({ ...current, [department.id]: event.target.value }))} /><button type="button" disabled={refreshRequired || edit.isPending || !drafts[department.id]?.trim()} onClick={() => edit.mutate({ id: department.id, name: drafts[department.id] })}>이름 변경</button><button type="button" className={cx('removeDepartment')} disabled={refreshRequired} onClick={() => setDeleteId(department.id)}>삭제</button></div>)}<div className={cx('departmentAdd')}><input value={newDepartment} maxLength={30} disabled={refreshRequired} placeholder="새 진료과 입력" onChange={event => setNewDepartment(event.target.value)} /><button type="button" disabled={refreshRequired || create.isPending || !newDepartment.trim()} onClick={() => create.mutate()}>진료과 추가</button></div>{error && <p className={cx('formError')}>{error}{refreshRequired && <button type="button" onClick={() => void onChanged()}>목록 새로고침</button>}</p>}{deleteId !== null && <div className={cx('inlineConfirm')}><span>이 진료과를 삭제할까요? 기존 예약 기록은 유지됩니다.</span><button type="button" onClick={() => setDeleteId(null)}>취소</button><button type="button" disabled={remove.isPending || refreshRequired} onClick={() => remove.mutate(deleteId)}>삭제</button></div>}</section>;
}

function StatusEditor({ hospital, onClose, onSaved }: { hospital: AdminHospitalItem; onClose: () => void; onSaved: () => Promise<void> }) {
  const original = hospital.status; const [operationStatus, setOperationStatus] = useState<AdminHospitalOperationStatus>(original?.operationStatus ?? 'OPEN'); const [congestionLevel, setCongestionLevel] = useState<AdminHospitalCongestionLevel>(original?.congestionLevel ?? 'NORMAL'); const [waitingCount, setWaitingCount] = useState(original?.waitingCount?.toString() ?? ''); const [averageWaitingMinutes, setAverageWaitingMinutes] = useState(original?.averageWaitingMinutes?.toString() ?? ''); const [acceptingPatients, setAcceptingPatients] = useState(original?.acceptingPatients ?? true); const [notice, setNotice] = useState(original?.notice ?? ''); const [error, setError] = useState<string | null>(null); const [refreshRequired, setRefreshRequired] = useState(false);
  const mutation = useMutation({ mutationFn: () => { const body: AdminHospitalStatusUpdateRequest = {}; if (operationStatus !== original?.operationStatus) body.operationStatus = operationStatus; if (congestionLevel !== original?.congestionLevel) body.congestionLevel = congestionLevel; if (waitingCount !== (original?.waitingCount?.toString() ?? '')) body.waitingCount = waitingCount === '' ? 0 : Number(waitingCount); if (averageWaitingMinutes !== (original?.averageWaitingMinutes?.toString() ?? '')) body.averageWaitingMinutes = averageWaitingMinutes === '' ? 0 : Number(averageWaitingMinutes); if (acceptingPatients !== (original?.acceptingPatients ?? true)) body.acceptingPatients = acceptingPatients; if (notice !== (original?.notice ?? '')) body.notice = notice; if (!Object.keys(body).length) throw new Error('변경한 운영 정보가 없습니다.'); return hospitalApi.updateAdminHospitalStatus(hospital.id, body); }, onSuccess: () => { void onSaved(); }, onError: errorValue => { setRefreshRequired(requiresListRefresh(errorValue)); setError(errorValue instanceof Error ? errorValue.message : writeMessage(errorValue)); } });
  return <Modal onClose={onClose}><header className={cx('modalHead')}><div><h2>운영 상태 관리</h2><p>{hospital.name ?? '병원'}의 현재 운영 정보를 수정합니다.</p></div><button type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={16} decorative /></button></header><div className={cx('formBody')}><div className={cx('formGrid')}><Field label="운영 상태"><select value={operationStatus} onChange={event => setOperationStatus(event.target.value as AdminHospitalOperationStatus)}>{(['OPEN', 'CLOSED', 'BREAK_TIME', 'HOLIDAY', 'INSPECTION'] as const).map(value => <option key={value} value={value}>{operationLabel(value)}</option>)}</select></Field><Field label="혼잡도"><select value={congestionLevel} onChange={event => setCongestionLevel(event.target.value as AdminHospitalCongestionLevel)}>{(['LOW', 'NORMAL', 'BUSY', 'VERY_BUSY'] as const).map(value => <option key={value} value={value}>{congestionLabel(value)}</option>)}</select></Field><Field label="대기 인원"><input type="number" min="0" max="9999" value={waitingCount} placeholder="-" onChange={event => setWaitingCount(event.target.value)} /></Field><Field label="평균 대기 시간(분)"><input type="number" min="0" max="1440" value={averageWaitingMinutes} placeholder="-" onChange={event => setAverageWaitingMinutes(event.target.value)} /></Field></div><div className={cx('readonlyMetric')}><span>오늘 예약 수</span><b>{original?.todayReservationCount ?? '-'}건</b><small>예약 서비스가 집계하는 읽기 전용 정보입니다.</small></div><label className={cx('bookingSwitch')}><span><b>환자 접수 중</b><small>현재 신규 환자를 접수할 수 있는 상태예요.</small></span><input type="checkbox" checked={acceptingPatients} onChange={event => setAcceptingPatients(event.target.checked)} /></label><Field label="운영 공지"><input value={notice} maxLength={200} placeholder="예) 13:00-14:00 점심시간" onChange={event => setNotice(event.target.value)} /></Field>{error && <p className={cx('formError')} role="alert">{error}{refreshRequired && <button type="button" onClick={() => void onSaved()}>목록 새로고침</button>}</p>}<footer className={cx('formActions')}><button type="button" onClick={onClose}>취소</button><button type="button" disabled={mutation.isPending || refreshRequired} onClick={() => mutation.mutate()}>{mutation.isPending ? '저장 중...' : '저장'}</button></footer></div></Modal>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) { return <label className={cx('field')}><span>{label}{required && <em>필수</em>}</span>{children}</label>; }
function ConfirmModal({ title, description, confirmLabel, pending, error, onClose, onConfirm, onRefresh }: { title: string; description: string; confirmLabel: string; pending: boolean; error: unknown; onClose: () => void; onConfirm: () => void; onRefresh: () => void }) { const refreshRequired = errorCode(error) === 'HOSPITAL_RESULT_UNKNOWN' || errorCode(error) === 'HOSPITAL_SERVICE_TIMEOUT'; return <Modal onClose={onClose}><div className={cx('confirmBody')}><Icon name="warning" size={25} decorative /><h2>{title}</h2><p>{refreshRequired ? '반영 여부를 확인하고 있어요. 목록을 새로고침해 확인해 주세요.' : description}</p>{Boolean(error) && !refreshRequired && <p className={cx('formError')}>{writeMessage(error)}</p>}<footer><button type="button" onClick={onClose}>취소</button><button type="button" className={cx('dangerButton')} disabled={pending} onClick={refreshRequired ? onRefresh : onConfirm}>{pending ? '처리 중...' : refreshRequired ? '목록 새로고침' : confirmLabel}</button></footer></div></Modal>; }
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) { return <div className={cx('overlay')} role="presentation" onMouseDown={onClose}><section className={cx('modal')} role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>{children}</section></div>; }
function operationLabel(value: AdminHospitalOperationStatus) { return ({ OPEN: '정상 운영', CLOSED: '운영 종료', BREAK_TIME: '휴게 시간', HOLIDAY: '휴무', INSPECTION: '점검 중' })[value]; }
function congestionLabel(value: AdminHospitalCongestionLevel) { return ({ LOW: '여유', NORMAL: '보통', BUSY: '혼잡', VERY_BUSY: '매우 혼잡' })[value]; }
