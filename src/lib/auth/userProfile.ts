import { IUserProfile } from '@/service/interface/user';

export function getUserProfileData(response: unknown) {
  const data = (response as { data?: unknown }).data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;

  return (nestedData ?? data ?? response) as IUserProfile | null;
}
