// frontend/src/utils.ts

/** catch에서 받은 값을 사용자에게 보여줄 문장으로 바꿈 (ApiError의 message는 서버가 준 문구) */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.';
}