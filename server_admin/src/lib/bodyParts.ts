// 시술기록의 관리 부위(part_of_body) 고정 목록 — 중복 선택 가능(배열 컬럼).
// reference_guides처럼 DB에 검수 등록하는 값이 아니라 고정된 신체 부위 분류라 상수로 관리한다.
export const BODY_PARTS = [
  "얼굴 전체",
  "이마",
  "미간",
  "관자",
  "눈가",
  "눈밑",
  "코",
  "볼",
  "앞볼",
  "심부볼",
  "팔자",
  "입가",
  "입술",
  "턱",
  "턱선",
  "이중턱",
  "목",
  "데콜테",
  "팔",
  "복부",
  "허벅지",
  "종아리",
  "기타",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];
