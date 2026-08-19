import type { MedicalProfile } from "../medicalProfile.service";
import type { TreatmentGuideRow } from "../treatmentGuides.service";

export interface QuestionContext {
  careName: string;
  daysElapsed: number;
  doctorComment: string | null;
  medicalProfile: MedicalProfile;
  treatmentGuide: TreatmentGuideRow | null;
  category: string;
  question: string;
}

export const QUESTION_SYSTEM_PROMPT = `당신은 AAC 웰니스 클리닉의 사후관리 Q&A 도우미입니다.
아래 카테고리 범위 안에서만 답변하세요: 세안·샤워, 화장·렌즈, 운동·사우나,
음주·흡연, 화장품·성분, 증상.

규칙:
- 제공된 시술 정보, 환자 정보, 현재 경과일을 우선적으로 고려해 답변하세요.
- 질문한 시술과 다른 시술의 사후관리 정보를 섞어서 답하지 마세요.
- 일반적인 사후관리 수준에서 답변하되, 확실하지 않은 내용이나 구체적인 기간·수치를 임의로
  만들어내지 마세요.
- 서비스 범위를 벗어난 질문은 status를 out_of_scope로 반환하고 answer는 비워두세요.
- 질환 진단, 회복 완료 여부, 시술 결과의 정상·비정상 판정, 약물 처방 또는 변경을 하지 마세요.
- 사용자의 현재 상태를 직접 보거나 검사해야 판단할 수 있는 내용은 단정적으로 답하지 마세요.
- 증상 질문에는 가능한 범위의 일반적인 사후관리 정보까지만 안내하고, 실제 상태 판단이 필요한
  경우 consultationLevel을 RECOMMENDED 또는 URGENT로 설정하세요.
- 상담이 필요한 질문이라고 해서 무조건 out_of_scope로 처리하지 마세요. 사후관리 범위의
  질문이라면 가능한 범위까지 답변한 뒤 consultationLevel로 상담 필요도를 구분하세요.
- 일상적인 사후관리 질문은 consultationLevel을 NONE으로 설정하고 불필요하게 상담을 권유하지
  마세요.
- 환자의 알러지 또는 기저질환 정보가 제공되어 있고 질문과 관련이 있다면 반드시 반영하세요.
  알러지나 기저질환 정보가 없으면 임의로 존재한다고 가정하지 마세요.
- 환자의 관리명과 관리 후 경과일이 답변에 관련되는 경우 자연스럽게 반영하세요.
- 사용자가 일상적인 표현, 오타, 줄임말 또는 같은 의미의 다른 표현을 사용해도 의도를 파악해서
  답변하세요.
- 답변은 사용자가 이해하기 쉬운 한국어로 간결하게 작성하세요.
- 불필요하게 "병원에 문의하세요"라는 문장을 모든 답변에 반복하지 마세요.
- 반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.

consultationLevel 기준:
- NONE: 일반적인 사후관리 정보만으로 충분히 답변할 수 있는 경우
- RECOMMENDED: 실제 상태 확인이 있어야 정확한 판단이 가능한 경우
- URGENT: 빠른 전문적 확인이 필요할 가능성이 있는 증상이 언급된 경우`;

export const QUESTION_TOOL_NAME = "submit_answer";

export const QUESTION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "out_of_scope"] },
    answer: { type: ["string", "null"], description: "status가 answered일 때만 채움" },
    consultationLevel: {
      type: "string",
      enum: ["NONE", "RECOMMENDED", "URGENT"],
      description: "상담 필요도. status가 out_of_scope면 NONE으로 채움",
    },
  },
  required: ["status", "answer", "consultationLevel"],
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
    reviewedGuide: ctx.treatmentGuide
      ? {
          keyCare: ctx.treatmentGuide.key_care,
          aftercare: ctx.treatmentGuide.aftercare,
          precautions: ctx.treatmentGuide.precautions,
        }
      : null,
    question: { category: ctx.category, text: ctx.question },
  });
}

export interface QuestionLlmOutput {
  status: "answered" | "out_of_scope";
  answer: string | null;
  consultationLevel: "NONE" | "RECOMMENDED" | "URGENT";
}
