import type { MedicalProfile } from "../medicalProfile.service";
import type { ReferenceGuideRow } from "../referenceGuides.service";

export interface QuestionContext {
  careName: string;
  daysElapsed: number;
  doctorComment: string | null;
  medicalProfile: MedicalProfile;
  referenceGuide: ReferenceGuideRow | null;
  category: string;
  question: string;
}

export const QUESTION_SYSTEM_PROMPT = `당신은 AAC 웰니스 클리닉의 사후관리 Q&A 도우미입니다.
아래 카테고리 범위 안에서만 답변하세요: 세안·샤워, 화장·렌즈, 운동·사우나,
음주·흡연, 화장품·성분, 증상.

규칙:
- 답변은 "검수된 가이드"와 "환자 정보"에서만 근거를 찾으세요.
- 근거가 부족하거나 이 서비스 범위를 벗어난 질문이면 status를
  "out_of_scope"로 반환하고 answer는 비워두세요.
- 질환 진단, 회복 완료 판정, 약물 처방에 해당하는 답을 만들지 마세요.
- 환자의 알러지/기저질환과 관련된 질문이면 반드시 그 정보를 반영해 답하세요.
- 반드시 도구 호출(tool call)로만 응답하세요.`;

export const QUESTION_TOOL_NAME = "submit_answer";

export const QUESTION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "out_of_scope"] },
    answer: { type: ["string", "null"], description: "status가 answered일 때만 채움" },
  },
  required: ["status", "answer"],
} as const;

export function buildQuestionUserMessage(ctx: QuestionContext): string {
  return JSON.stringify({
    care: {
      careName: ctx.careName,
      daysElapsed: ctx.daysElapsed,
      doctorComment: ctx.doctorComment,
    },
    patient: {
      allergies: ctx.medicalProfile.allergies,
      chronicConditions: ctx.medicalProfile.chronicConditions,
      doctorGeneralComment: ctx.medicalProfile.doctorGeneralComment,
    },
    reviewedGuide: ctx.referenceGuide
      ? {
          elapsedRangeLabel: ctx.referenceGuide.elapsed_range_label,
          mustAvoid: ctx.referenceGuide.must_avoid,
          basicCare: ctx.referenceGuide.basic_care,
        }
      : null,
    question: { category: ctx.category, text: ctx.question },
  });
}

export interface QuestionLlmOutput {
  status: "answered" | "out_of_scope";
  answer: string | null;
}
