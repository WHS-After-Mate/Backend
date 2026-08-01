// 위험 신호 키워드 — POST /aftercare/questions 규칙 기반 사전 필터.
// docs/llm-prompt-design.md "미확정 사항": 전문가(의료진) 검수 필요한 초안 목록.
// 매칭되면 LLM 호출 없이 status: "expert_required"로 즉시 응답한다.
export const RISK_KEYWORDS: readonly string[] = [
  // 통증/출혈
  "통증이 심해",
  "통증이 심함",
  "극심한 통증",
  "참을 수 없는 통증",
  "출혈",
  "피가 나",
  "피가 멈추지",
  // 감염/염증 징후
  "고름",
  "진물",
  "화농",
  "심한 부기",
  "붓기가 심해",
  "열이 나",
  "고열",
  // 시야/신경계
  "시야 이상",
  "눈이 안 보",
  "시력 저하",
  "마비",
  "감각이 없",
  // 호흡/전신 반응
  "호흡곤란",
  "숨쉬기 힘들",
  "알레르기 반응",
  "아나필락시스",
  "실신",
  "어지러움이 심",
  // 상처 악화
  "괴사",
  "검게 변",
  "물집이 심",
];

export function containsRiskKeyword(text: string): boolean {
  return RISK_KEYWORDS.some((keyword) => text.includes(keyword));
}

// 출력 검증 단계 금지어(의료적 진단/처방/완치 판정) — LLM 응답에 이 표현이 섞이면 재시도/폴백
export const FORBIDDEN_OUTPUT_PATTERNS: readonly RegExp[] = [
  /진단(?:합니다|됩니다|해드|입니다)/,
  /처방(?:합니다|해드|드립니다)/,
  /완치(?:되었|입니다|됩니다)/,
  /(약|연고|항생제)\s*(을|를)?\s*(드세요|바르세요|복용하세요)/,
];

export function violatesOutputPolicy(text: string): boolean {
  return FORBIDDEN_OUTPUT_PATTERNS.some((pattern) => pattern.test(text));
}
