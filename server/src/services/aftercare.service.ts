import { supabaseAdmin } from "../config/supabase";
import { isSupportedCategory } from "../lib/categories";
import { Errors } from "../lib/errors";
import { containsRiskKeyword, violatesOutputPolicy } from "../lib/riskKeywords";
import { sanitizeLlmText, sanitizeLlmTextArray } from "../lib/sanitizeLlmText";
import {
  daysElapsedSince,
  getCareRecordById,
  getLatestCareRecord,
  type CareRecordRow,
} from "./careRecords.service";
import {
  DAILY_GUIDE_INPUT_SCHEMA,
  DAILY_GUIDE_SYSTEM_PROMPT,
  DAILY_GUIDE_TOOL_NAME,
  buildDailyGuideUserMessage,
  type DailyGuideLlmOutput,
} from "./llm/dailyGuide.prompt";
import { callStructuredLlm } from "./llm/client";
import {
  QUESTION_INPUT_SCHEMA,
  QUESTION_SYSTEM_PROMPT,
  QUESTION_TOOL_NAME,
  buildQuestionUserMessage,
  type QuestionLlmOutput,
} from "./llm/questions.prompt";
import { getMedicalProfileForLlmContext } from "./medicalProfile.service";
import { findReferenceGuide, type ReferenceGuideRow } from "./referenceGuides.service";

function todayKst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function nextMidnightKstIso(): string {
  const now = new Date();
  const kstNowStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const kstNow = new Date(kstNowStr);
  kstNow.setHours(24, 0, 0, 0);
  return kstNow.toISOString();
}

interface CachedGuideRow {
  id: string;
  care_record_id: string;
  days_elapsed: number;
  elapsed_range: string | null;
  must_avoid: string[];
  basic_care: string[];
  next_check_date: string | null;
  generated_at: string;
  generated_by: string;
  cache_expires_at: string;
}

async function getCachedGuide(careRecordId: string): Promise<CachedGuideRow | null> {
  const { data } = await supabaseAdmin
    .from("aftercare_guides")
    .select(
      "id, care_record_id, days_elapsed, elapsed_range, must_avoid, basic_care, next_check_date, generated_at, generated_by, cache_expires_at",
    )
    .eq("care_record_id", careRecordId)
    .eq("generated_date", todayKst())
    .maybeSingle();
  return data as CachedGuideRow | null;
}

async function generateViaLlm(context: {
  careName: string;
  careDate: string;
  daysElapsed: number;
  partOfBody: string | null;
  brand: string | null;
  doctorComment: string | null;
  referenceGuide: ReferenceGuideRow;
  medicalProfile: Awaited<ReturnType<typeof getMedicalProfileForLlmContext>>;
}): Promise<DailyGuideLlmOutput | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const output = await callStructuredLlm<DailyGuideLlmOutput>({
        system: DAILY_GUIDE_SYSTEM_PROMPT,
        userMessage: buildDailyGuideUserMessage(context),
        toolName: DAILY_GUIDE_TOOL_NAME,
        toolDescription: "일차별 사후관리 가이드를 구조화된 형식으로 제출합니다.",
        inputSchema: DAILY_GUIDE_INPUT_SCHEMA,
      });

      const combinedText = [...output.mustAvoid, ...output.basicCare].join(" ");
      if (violatesOutputPolicy(combinedText)) continue;

      return {
        mustAvoid: sanitizeLlmTextArray(output.mustAvoid),
        basicCare: sanitizeLlmTextArray(output.basicCare),
        nextCheckDate: output.nextCheckDate,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// elapsedDay가 지정되고 오늘 실제 경과일과 다르면(1/3/5/7/10일차 탭 선택) 개인화 LLM 호출 없이
// reference_guides 원문을 그대로 반환한다. 가상의 경과일에 대해 매번 LLM을 호출하는
// 비용·안전 부담을 피하기 위함 — api-spec.md v0.5 GET /aftercare/daily-guide?elapsedDay= 참고
async function getReferenceGuidePreview(careRecord: CareRecordRow, elapsedDay: number) {
  const referenceGuide = await findReferenceGuide(careRecord.care_type, elapsedDay);
  if (!referenceGuide) throw Errors.guideNotAvailable();

  const careDateMs = new Date(`${careRecord.care_date}T00:00:00+09:00`).getTime();
  const nextCheckDate = referenceGuide.next_check_offset_days
    ? new Date(careDateMs + (elapsedDay + referenceGuide.next_check_offset_days) * 86400000)
        .toISOString()
        .slice(0, 10)
    : null;

  return {
    guideId: referenceGuide.id,
    careRecordId: careRecord.id,
    careName: careRecord.care_name,
    daysElapsed: elapsedDay,
    elapsedRange: referenceGuide.elapsed_range_label,
    isToday: false,
    mustAvoid: referenceGuide.must_avoid,
    basicCare: referenceGuide.basic_care,
    nextCheckDate,
    generatedAt: new Date().toISOString(),
    generatedBy: "reference_guide",
    cacheExpiresAt: nextMidnightKstIso(),
  };
}

export async function getOrGenerateDailyGuide(userId: string, careRecordId?: string, elapsedDay?: number) {
  const careRecord = careRecordId
    ? await getCareRecordById(userId, careRecordId)
    : await getLatestCareRecord(userId);

  if (!careRecord) throw Errors.guideNotAvailable();

  const actualDaysElapsed = daysElapsedSince(careRecord.care_date);
  const isToday = elapsedDay === undefined || elapsedDay === actualDaysElapsed;

  if (!isToday) {
    return getReferenceGuidePreview(careRecord, elapsedDay!);
  }

  const cached = await getCachedGuide(careRecord.id);
  if (cached) {
    return {
      guideId: cached.id,
      careRecordId: careRecord.id,
      careName: careRecord.care_name,
      daysElapsed: cached.days_elapsed,
      elapsedRange: cached.elapsed_range,
      isToday: true,
      mustAvoid: cached.must_avoid,
      basicCare: cached.basic_care,
      nextCheckDate: cached.next_check_date,
      generatedAt: cached.generated_at,
      generatedBy: cached.generated_by,
      cacheExpiresAt: cached.cache_expires_at,
    };
  }

  const daysElapsed = actualDaysElapsed;
  const referenceGuide = await findReferenceGuide(careRecord.care_type, daysElapsed);
  if (!referenceGuide) throw Errors.guideNotAvailable();

  const medicalProfile = await getMedicalProfileForLlmContext(userId, "GET /aftercare/daily-guide");

  const llmOutput = await generateViaLlm({
    careName: careRecord.care_name,
    careDate: careRecord.care_date,
    daysElapsed,
    partOfBody: careRecord.part_of_body,
    brand: careRecord.brand,
    doctorComment: careRecord.doctor_comment,
    referenceGuide,
    medicalProfile,
  });

  // LLM 생성 실패 시 검수된 가이드 원문으로 폴백 — LLM 없이도 최소 안전한 답을 보장한다 (llm-prompt-design.md)
  // 폴백 시에도 이 시술 건의 doctor_comment는 개인화 정보로 남겨둔다 (없으면 검수 가이드 원문만 사용)
  const mustAvoid = llmOutput?.mustAvoid ?? referenceGuide.must_avoid;
  const basicCare = llmOutput
    ? llmOutput.basicCare
    : careRecord.doctor_comment
      ? [...referenceGuide.basic_care, `담당의 코멘트: ${careRecord.doctor_comment}`]
      : referenceGuide.basic_care;
  const nextCheckDate =
    llmOutput?.nextCheckDate ??
    (referenceGuide.next_check_offset_days
      ? new Date(Date.now() + referenceGuide.next_check_offset_days * 86400000)
          .toISOString()
          .slice(0, 10)
      : null);
  const generatedBy = llmOutput ? "llm" : "reference_guide";

  const cacheExpiresAt = nextMidnightKstIso();
  const generatedAt = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("aftercare_guides")
    .insert({
      user_id: userId,
      care_record_id: careRecord.id,
      days_elapsed: daysElapsed,
      elapsed_range: referenceGuide.elapsed_range_label,
      must_avoid: mustAvoid,
      basic_care: basicCare,
      next_check_date: nextCheckDate,
      generated_at: generatedAt,
      generated_by: generatedBy,
      cache_expires_at: cacheExpiresAt,
    })
    .select("id")
    .single();

  // 동시 요청으로 unique(care_record_id, generated_date) 충돌 시 이미 생성된 캐시를 재조회
  if (insertError || !inserted) {
    const raceCache = await getCachedGuide(careRecord.id);
    if (raceCache) {
      return {
        guideId: raceCache.id,
        careRecordId: careRecord.id,
        careName: careRecord.care_name,
        daysElapsed: raceCache.days_elapsed,
        elapsedRange: raceCache.elapsed_range,
        isToday: true,
        mustAvoid: raceCache.must_avoid,
        basicCare: raceCache.basic_care,
        nextCheckDate: raceCache.next_check_date,
        generatedAt: raceCache.generated_at,
        generatedBy: raceCache.generated_by,
        cacheExpiresAt: raceCache.cache_expires_at,
      };
    }
    throw Errors.guideGenerationFailed();
  }

  return {
    guideId: inserted.id as string,
    careRecordId: careRecord.id,
    careName: careRecord.care_name,
    daysElapsed,
    elapsedRange: referenceGuide.elapsed_range_label,
    isToday: true,
    mustAvoid,
    basicCare,
    nextCheckDate,
    generatedAt,
    generatedBy,
    cacheExpiresAt,
  };
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
  const referenceGuide = careRecord ? await findReferenceGuide(careRecord.care_type, daysElapsed) : null;

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
          referenceGuide,
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
    basedOn: {
      careRecordId: careRecord?.id ?? null,
      daysElapsed,
      guideId: referenceGuide?.id ?? null,
    },
  };
}

export async function listQuestions(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("id, care_record_id, category, question, status, answer, answered_by, expert_contact_required, created_at")
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
      createdAt: row.created_at,
    })),
  };
}
