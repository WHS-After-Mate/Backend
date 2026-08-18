import type { MedicalProfile } from "../medicalProfile.service";
import type { ReferenceGuideRow } from "../referenceGuides.service";

export interface DailyGuideContext {
  careName: string;
  careDate: string;
  daysElapsed: number;
  partOfBody: string[];
  brand: string | null;
  doctorComment: string | null;
  medicalProfile: MedicalProfile;
  referenceGuide: ReferenceGuideRow;
}

export const DAILY_GUIDE_SYSTEM_PROMPT = `당신은 AAC 웰니스 클리닉의 사후관리 안내 도우미입니다.
아래 "검수된 가이드"와 "환자 정보"만을 근거로, 해당 환자의 경과일에 맞는
사후관리 주의사항을 안내하세요.

규칙:
- 검수된 가이드에 없는 내용을 지어내지 마세요.
- 검수된 가이드(reviewedGuide)의 mustAvoid/basicCare 항목은 하나도 빠짐없이 전부 포함하세요.
  문장을 자연스럽게 다듬거나 순서를 바꾸는 건 괜찮지만, 항목 자체를 생략하거나 요약해서
  합치지 마세요 — 개수를 줄이는 것은 오답입니다.
- 질환을 진단하거나, 회복 완료를 판정하거나, 약물을 처방하지 마세요.
- 환자의 알러지/기저질환에 해당하는 성분·행동이 검수된 가이드에 포함되어
  있다면, 반드시 회피 항목으로 강조하세요.
- 반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.`;

export const DAILY_GUIDE_TOOL_NAME = "submit_daily_guide";

export const DAILY_GUIDE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    mustAvoid: { type: "array", items: { type: "string" }, description: "피해야 할 행동/성분 목록" },
    basicCare: { type: "array", items: { type: "string" }, description: "기본 관리 수칙 목록" },
    nextCheckDate: { type: ["string", "null"], description: "다음 체크 권장일 YYYY-MM-DD, 없으면 null" },
  },
  required: ["mustAvoid", "basicCare", "nextCheckDate"],
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
    reviewedGuide: {
      elapsedRangeLabel: ctx.referenceGuide.elapsed_range_label,
      mustAvoid: ctx.referenceGuide.must_avoid,
      basicCare: ctx.referenceGuide.basic_care,
    },
  });
}

export interface DailyGuideLlmOutput {
  mustAvoid: string[];
  basicCare: string[];
  nextCheckDate: string | null;
}
