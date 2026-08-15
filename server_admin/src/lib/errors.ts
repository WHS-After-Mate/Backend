export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  patientNotFound: () => new ApiError(404, "PATIENT_NOT_FOUND", "환자를 찾을 수 없습니다."),
  careRecordNotFound: () => new ApiError(404, "CARE_RECORD_NOT_FOUND", "시술 기록을 찾을 수 없습니다."),
  membershipNotFound: () => new ApiError(404, "MEMBERSHIP_NOT_FOUND", "이용권을 찾을 수 없습니다."),
  membershipExhausted: () => new ApiError(409, "MEMBERSHIP_EXHAUSTED", "선택한 이용권의 잔여 횟수가 없습니다."),
  invalidCareType: () =>
    new ApiError(400, "INVALID_CARE_TYPE", "검수된 사후관리 가이드가 있는 관리 유형만 선택할 수 있습니다."),
  invalidCredentials: () => new ApiError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다."),
  unauthorized: () => new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다."),
  validation: (message: string) => new ApiError(400, "VALIDATION_ERROR", message),
  notFound: (message = "요청한 리소스를 찾을 수 없습니다.") => new ApiError(404, "NOT_FOUND", message),
  internal: (message = "서버 오류가 발생했습니다.") => new ApiError(500, "INTERNAL_ERROR", message),
};
