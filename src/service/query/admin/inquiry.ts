import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { answerAdminInquiry, getAdminInquiryDetail, getAdminInquiries } from '@/service/api/admin/inquiry';
import { AdminInquiryListParams } from '@/service/interface/admin/inquiry';

export const adminInquiryQueryKey = ['admin-inquiry'] as const;

export const adminInquiryListQueryOptions = (params: AdminInquiryListParams) => queryOptions({
  queryKey: [...adminInquiryQueryKey, 'list', params] as const,
  queryFn: () => getAdminInquiries(params),
  staleTime: 10_000,
});

export const adminInquiryDetailQueryOptions = (id: number) => queryOptions({
  queryKey: [...adminInquiryQueryKey, 'detail', id] as const,
  queryFn: () => getAdminInquiryDetail(id),
  retry: false,
});

export function useAnswerAdminInquiryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['admin-inquiry-answer'],
    mutationFn: answerAdminInquiry,
    onSuccess: data => {
      void queryClient.invalidateQueries({ queryKey: adminInquiryQueryKey });
      if (data) queryClient.setQueryData([...adminInquiryQueryKey, 'detail', data.id], data);
    },
  });
}
