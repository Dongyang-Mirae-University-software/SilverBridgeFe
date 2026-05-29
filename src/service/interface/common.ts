export interface CommonResponse<T> {
  code?: number;
  success?: boolean;
  message?: string;
  data?: T;
}
