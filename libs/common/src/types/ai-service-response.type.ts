export interface AiServiceResponse<T = Record<string, unknown>> {
  success: boolean;
  message: string;
  data: T;
}
