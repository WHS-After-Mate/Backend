import { env } from "../config/env";

// 국내 SMS 업체 연동 지점. MVP/개발 중에는 SMS_DEV_MODE=true로 콘솔 출력만 한다.
export async function sendSmsCode(phone: string, code: string): Promise<void> {
  if (env.SMS_DEV_MODE) {
    // eslint-disable-next-line no-console
    console.log(`[SMS_DEV_MODE] ${phone} 인증코드: ${code}`);
    return;
  }

  if (!env.SMS_PROVIDER_API_KEY || !env.SMS_PROVIDER_SENDER) {
    throw new Error("SMS_PROVIDER_API_KEY / SMS_PROVIDER_SENDER 가 설정되지 않았습니다.");
  }

  // TODO: 실제 국내 SMS 업체(예: 알리고, NCP SENS 등) API 연동
  throw new Error("실제 SMS 발송 연동이 아직 구현되지 않았습니다. SMS_DEV_MODE=true로 개발하세요.");
}
