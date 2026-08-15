// api-spec.md 공통 에러 코드 표와 1:1 대응
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
  unauthorized: () => new ApiError(401, "UNAUTHORIZED", "토큰이 없거나 만료되었습니다."),
  invalidRefreshToken: () =>
    new ApiError(401, "INVALID_REFRESH_TOKEN", "리프레시 토큰이 만료되었거나 유효하지 않습니다."),
  emailAlreadyExists: () =>
    new ApiError(409, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다."),
  patientNotFound: () =>
    new ApiError(404, "PATIENT_NOT_FOUND", "해당 환자번호를 찾을 수 없습니다."),
  patientAlreadyClaimed: () =>
    new ApiError(409, "PATIENT_ALREADY_CLAIMED", "이미 가입 처리된 환자번호입니다."),
  patientIdentityMismatch: () =>
    new ApiError(400, "PATIENT_IDENTITY_MISMATCH", "환자번호/이름/생년월일이 일치하지 않습니다."),
  invalidCredentials: () =>
    new ApiError(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다."),
  noActiveCustomerProfile: () =>
    new ApiError(403, "NO_ACTIVE_CUSTOMER_PROFILE", "연결된 고객 프로필이 없습니다."),
  careRecordNotFound: () =>
    new ApiError(404, "CARE_RECORD_NOT_FOUND", "관리 이력을 찾을 수 없습니다."),
  membershipNotFound: () =>
    new ApiError(404, "MEMBERSHIP_NOT_FOUND", "이용권을 찾을 수 없습니다."),
  guideNotAvailable: () =>
    new ApiError(404, "GUIDE_NOT_AVAILABLE", "해당 관리 유형/경과일에 대한 가이드가 없습니다."),
  guideGenerationFailed: () =>
    new ApiError(503, "GUIDE_GENERATION_FAILED", "가이드 생성에 실패했습니다. 잠시 후 다시 시도해주세요."),
  answerGenerationFailed: () =>
    new ApiError(503, "ANSWER_GENERATION_FAILED", "답변 생성에 실패했습니다. 잠시 후 다시 시도해주세요."),
  unsupportedCategory: () =>
    new ApiError(422, "UNSUPPORTED_CATEGORY", "지원하지 않는 질문 카테고리입니다."),
  invalidOrExpiredResetToken: () =>
    new ApiError(400, "INVALID_OR_EXPIRED_RESET_TOKEN", "재설정 링크가 유효하지 않거나 만료되었습니다."),
  invalidCurrentPassword: () =>
    new ApiError(401, "INVALID_CURRENT_PASSWORD", "현재 비밀번호가 올바르지 않습니다."),
  validation: (message: string) => new ApiError(400, "VALIDATION_ERROR", message),
  notFound: (message = "요청한 리소스를 찾을 수 없습니다.") =>
    new ApiError(404, "NOT_FOUND", message),
  internal: (message = "서버 오류가 발생했습니다.") =>
    new ApiError(500, "INTERNAL_ERROR", message),
};
