// 관리 추천 매칭용 고정 관심목표(concernTag) 10종 — docs/care_recommendation_data_guide.md,
// docs/care_data/care_data.json과 동일한 값이어야 한다. 앱의 "내 정보" 화면 관심목표 칩과도
// 같은 값을 써야 매칭이 되므로(가이드 명시), 여기서 임의로 늘리거나 표현을 바꾸지 않는다.
export const CONCERN_TAGS = [
  "리프팅·탄력",
  "모공·피지 관리",
  "보습·장벽 강화",
  "색소침착 개선",
  "얼굴 윤곽·볼륨",
  "제모",
  "두피 관리",
  "바디라인·체형 관리",
  "붓기 케어",
  "컨디션·대사 관리",
] as const;

export type ConcernTag = (typeof CONCERN_TAGS)[number];
