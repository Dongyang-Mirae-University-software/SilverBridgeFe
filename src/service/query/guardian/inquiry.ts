'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { createGuardianInquiry, getGuardianInquiries, getGuardianInquiryDetail } from '@/service/api/guardian/inquiry';
import { CreateGuardianInquiryReq, GetGuardianInquiriesParams } from '@/service/interface/guardian/inquiry';

export const guardianInquiriesQueryKey = ['guardian-inquiries'] as const;
export const guardianInquiryDetailQueryKey = ['guardian-inquiry-detail'] as const;

export function guardianInquiriesQueryOptions(params: GetGuardianInquiriesParams = {}) {
  return queryOptions({
    queryKey: [...guardianInquiriesQueryKey, params] as const,
    queryFn: () => getGuardianInquiries(params),
    staleTime: 10 * 1000,
  });
}

export function guardianInquiryDetailQueryOptions(id: number) {
  return queryOptions({
    queryKey: [...guardianInquiryDetailQueryKey, id] as const,
    queryFn: () => getGuardianInquiryDetail(id),
    retry: false,
  });
}

export function useCreateGuardianInquiryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['guardian-inquiry-create'],
    mutationFn: (body: CreateGuardianInquiryReq) => createGuardianInquiry(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guardianInquiriesQueryKey }),
  });
}
