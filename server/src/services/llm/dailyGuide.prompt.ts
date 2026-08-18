import type { MedicalProfile } from "../medicalProfile.service";

export interface DailyGuideContext {
  careName: string;
  careDate: string;
  daysElapsed: number;
  partOfBody: string[];
  brand: string | null;
  doctorComment: string | null;
  medicalProfile: MedicalProfile;
}

// 2026-08-19 — docs/prompt.docx 설계로 전면 재작성. 기존엔 "검수된 가이드(reference_guides)
// 원문만이 유일한 근거"였으나(reviewedGuide를 그대로 재서술), reference_guides 문구 자체가
// 시술별 특성을 반영 못 하고 모든 시술에 공통되는 일반론이 섞여있는 문제가 확인돼(예: botox
// care_type이 근육 주입형/피부층 주입형 두 시술을 동일 문구로 묶는 등) — 이제는 시술·환자
// 정보를 근거로 LLM이 직접 종합하는 방식으로 전환한다. reference_guides는 더 이상 이 프롬프트의
// 입력으로 쓰이지 않는다(LLM 실패 시 폴백 용도로만 aftercare.service.ts에서 별도 사용).
export const DAILY_GUIDE_SYSTEM_PROMPT = `당신은 AAC 웰니스 클리닉의 사후관리 안내 도우미입니다.
아래 "시술 정보"와 "환자 정보"를 바탕으로, 해당 환자의 현재 경과일에 맞는 사후관리 정보를
안내하세요.

규칙:
- 시술 종류와 현재 경과일을 가장 우선적으로 고려하세요.
- 질환을 진단하거나, 회복 완료를 의학적으로 판정하거나, 약물을 처방하지 마세요.
- 확실하지 않은 내용은 단정하거나 구체적인 수치·기간을 임의로 만들어내지 마세요.
- 환자의 알러지/기저질환 정보가 질문 및 사후관리와 관련이 있다면 반드시 반영하세요.
- 사후관리가 필요한 기간이라면 현재 시점에서 중요한 내용만 선별하세요.
- 단순한 상식이나 모든 시술에 공통으로 적용되는 일반론은 우선순위에서 제외하세요.
  예: "시술 부위를 압박하지 마세요", "청결을 유지하세요", "무리하지 마세요"
- 사용자가 별도로 안내받지 않으면 놓치기 쉬운 실제 생활 관련 내용을 우선하세요.
- 시술 특성상 주요 사후관리 기간이 지난 시점이라고 판단되는 경우, 억지로 항목을 생성하지
  마세요. 이 경우 keyCare에는 현재 일상생활 복귀가 가능한 시점이라는 내용을 간단히 안내하고,
  aftercare와 precautions는 빈 배열 []로 반환하세요. 단, 회복이 완전히 끝났다고 단정하지
  마세요.

사후관리가 필요한 경우:
- aftercare는 현재 경과일에 가장 중요한 사후관리 방법 정확히 3개를 작성하세요.
- precautions는 현재 경과일에 가장 중요한 주의사항 정확히 3개를 작성하세요.
- 각 항목은 서로 겹치지 않게 작성하세요.
- keyCare는 오늘 가장 중요하게 기억해야 할 내용을 한 문장으로 요약하세요.
- 각 문장은 짧고 구체적으로 작성하세요.

반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.`;

export const DAILY_GUIDE_TOOL_NAME = "submit_daily_guide";

export const DAILY_GUIDE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    aftercare: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "오늘 경과일에 가장 중요한 사후관리 방법. 정확히 3개, 회복 주요 기간이 지났으면 빈 배열",
    },
    precautions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "오늘 경과일에 가장 중요한 주의사항. 정확히 3개, 회복 주요 기간이 지났으면 빈 배열",
    },
    keyCare: {
      type: "string",
      description: "오늘 가장 중요하게 기억해야 할 내용 한 문장 요약",
    },
  },
  required: ["aftercare", "precautions", "keyCare"],
} as const;

export function buildDailyGuideUserMessage(ctx: DailyGuideContext): string {
  return JSON.stringify({
    care: {
      careName: ctx.careName,
      careDate: ctx.careDate,
      daysElapsed: ctx.daysElapsed,
      partOfBody: ctx.partOfBody,
      brand: ctx.brand,
      doctorComment: ctx.doctorComment,
    },
    patient: {
      allergies: ctx.medicalProfile.allergies,
      chronicConditions: ctx.medicalProfile.chronicConditions,
      doctorGeneralComment: ctx.medicalProfile.doctorGeneralComment,
    },
  });
}

export interface DailyGuideLlmOutput {
  aftercare: string[];
  precautions: string[];
  keyCare: string;
}
