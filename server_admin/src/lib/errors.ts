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
  patientAlreadyClaimed: () =>
    new ApiError(409, "PATIENT_ALREADY_CLAIMED", "이미 앱 가입이 완료된 환자입니다."),
  validation: (message: string) => new ApiError(400, "VALIDATION_ERROR", message),
  notFound: (message = "요청한 리소스를 찾을 수 없습니다.") => new ApiError(404, "NOT_FOUND", message),
  internal: (message = "서버 오류가 발생했습니다.") => new ApiError(500, "INTERNAL_ERROR", message),
};
