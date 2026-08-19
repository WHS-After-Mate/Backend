import { isSupportedCategory } from "../lib/categories";
import { Errors } from "../lib/errors";
import { containsRiskKeyword, violatesOutputPolicy } from "../lib/riskKeywords";
import { sanitizeLlmText } from "../lib/sanitizeLlmText";
import {
  daysElapsedSince,
  getCareRecordById,
  getLatestCareRecord,
  type CareRecordRow,
} from "./careRecords.service";
import { supabaseAdmin } from "../config/supabase";
import { callStructuredLlm } from "./llm/client";
import {
  QUESTION_INPUT_SCHEMA,
  QUESTION_SYSTEM_PROMPT,
  QUESTION_TOOL_NAME,
  buildQuestionUserMessage,
  type QuestionLlmOutput,
} from "./llm/questions.prompt";
import { getMedicalProfileForLlmContext } from "./medicalProfile.service";
import { findTreatmentGuide, type TreatmentGuideRow } from "./treatmentGuides.service";

// treatment_guides(care_name+day 1/3/5/7/14 고정 콘텐츠, 46개 시술 전체 커버)를 그대로 반환한다.
// 2026-08-19 — LLM 폴백을 완전히 제거했다: 이제 모든 실제 시술이 treatment_guides에 있어서(팀이
// 직접 작성) 매칭 실패는 곧 "그 시술/일차 콘텐츠가 아직 없다"는 뜻이라 404가 정확한 응답이다.
// care_type/reference_guides 경로도 함께 걷어냈다 — Q&A(submitQuestion)도 이제 treatment_guides를
// 근거로 쓴다.
function fromTreatmentGuide(careRecord: CareRecordRow, guide: TreatmentGuideRow, isToday: boolean) {
  return {
    guideId: guide.id,
    careRecordId: careRecord.id,
    careName: careRecord.care_name,
    daysElapsed: guide.day,
    elapsedRange: null,
    isToday,
    aftercare: guide.aftercare,
    precautions: guide.precautions,
    keyCare: guide.key_care,
    nextCheckDate: null,
    generatedAt: new Date().toISOString(),
    generatedBy: "treatment_guide",
    cacheExpiresAt: null,
  };
}

export async function getOrGenerateDailyGuide(userId: string, careRecordId?: string, elapsedDay?: number) {
  const careRecord = careRecordId
    ? await getCareRecordById(userId, careRecordId)
    : await getLatestCareRecord(userId);

  if (!careRecord) throw Errors.guideNotAvailable();

  const actualDaysElapsed = daysElapsedSince(careRecord.care_date);
  const isToday = elapsedDay === undefined || elapsedDay === actualDaysElapsed;
  const day = elapsedDay ?? actualDaysElapsed;

  const treatmentGuide = await findTreatmentGuide(careRecord.care_name, day);
  if (!treatmentGuide) throw Errors.guideNotAvailable();

  return fromTreatmentGuide(careRecord, treatmentGuide, isToday);
}

export function listQuestionCategories() {
  return { categories: ["세안·샤워", "화장·렌즈", "운동·사우나", "음주·흡연", "화장품·성분", "증상"] };
}

interface SubmitQuestionInput {
  careRecordId?: string;
  category: string;
  question: string;
}

export async function submitQuestion(userId: string, input: SubmitQuestionInput) {
  if (!isSupportedCategory(input.category)) throw Errors.unsupportedCategory();

  const careRecord = input.careRecordId
    ? await getCareRecordById(userId, input.careRecordId)
    : await getLatestCareRecord(userId);

  const daysElapsed = careRecord ? daysElapsedSince(careRecord.care_date) : 0;

  // 위험 신호는 LLM 호출 전 규칙 기반으로 우선 차단
  if (containsRiskKeyword(input.question)) {
    const { data: saved } = await supabaseAdmin
      .from("questions")
      .insert({
        user_id: userId,
        care_record_id: careRecord?.id ?? null,
        category: input.category,
        question: input.question,
        status: "expert_required",
        expert_contact_required: true,
      })
      .select("id")
      .single();

    return {
      questionId: saved?.id as string,
      status: "expert_required" as const,
      message: "해당 질문은 전문가 상담이 필요한 내용입니다. 클리닉으로 문의해주세요.",
      expertContactRequired: true,
    };
  }

  const medicalProfile = await getMedicalProfileForLlmContext(userId, "POST /aftercare/questions");
  const treatmentGuide = careRecord ? await findTreatmentGuide(careRecord.care_name, daysElapsed) : null;

  let llmOutput: QuestionLlmOutput | null = null;
  for (let attempt = 0; attempt < 2 && !llmOutput; attempt++) {
    try {
      const output = await callStructuredLlm<QuestionLlmOutput>({
        system: QUESTION_SYSTEM_PROMPT,
        userMessage: buildQuestionUserMessage({
          careName: careRecord?.care_name ?? "관리 이력 없음",
          daysElapsed,
          doctorComment: careRecord?.doctor_comment ?? null,
          medicalProfile,
          treatmentGuide,
          category: input.category,
          question: input.question,
        }),
        toolName: QUESTION_TOOL_NAME,
        toolDescription: "질문에 대한 답변을 구조화된 형식으로 제출합니다.",
        inputSchema: QUESTION_INPUT_SCHEMA,
      });

      if (output.answer && violatesOutputPolicy(output.answer)) continue;
      llmOutput = output.answer ? { ...output, answer: sanitizeLlmText(output.answer) } : output;
    } catch {
      continue;
    }
  }

  if (!llmOutput) throw Errors.answerGenerationFailed();

  const status = llmOutput.status;
  const consultationLevel = status === "answered" ? llmOutput.consultationLevel : "NONE";
  const { data: saved, error: saveError } = await supabaseAdmin
    .from("questions")
    .insert({
      user_id: userId,
      care_record_id: careRecord?.id ?? null,
      category: input.category,
      question: input.question,
      status,
      answer: llmOutput.answer,
      answered_by: "llm",
      expert_contact_required: false,
      consultation_level: consultationLevel,
    })
    .select("id")
    .single();

  if (saveError || !saved) throw Errors.answerGenerationFailed();

  if (status === "out_of_scope") {
    return {
      questionId: saved.id as string,
      status: "out_of_scope" as const,
      message: "해당 질문은 앱에서 제공하는 정보 범위를 벗어나 전문가 상담이 필요합니다.",
      expertContactRequired: true,
    };
  }

  return {
    questionId: saved.id as string,
    status: "answered" as const,
    answer: llmOutput.answer as string,
    answeredBy: "llm" as const,
    consultationLevel,
    basedOn: {
      careRecordId: careRecord?.id ?? null,
      daysElapsed,
      guideId: treatmentGuide?.id ?? null,
    },
  };
}

export async function listQuestions(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select(
      "id, care_record_id, category, question, status, answer, answered_by, expert_contact_required, consultation_level, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw Errors.internal("질문 이력 조회에 실패했습니다.");

  return {
    items: (data ?? []).map((row) => ({
      questionId: row.id,
      careRecordId: row.care_record_id,
      category: row.category,
      question: row.question,
      status: row.status,
      answer: row.answer,
      answeredBy: row.answered_by,
      expertContactRequired: row.expert_contact_required,
      consultationLevel: row.consultation_level,
      createdAt: row.created_at,
    })),
  };
}
