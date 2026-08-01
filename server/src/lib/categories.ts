export const SUPPORTED_QUESTION_CATEGORIES = [
  "세안·샤워",
  "화장·렌즈",
  "운동·사우나",
  "음주·흡연",
  "화장품·성분",
  "증상",
] as const;

export type SupportedQuestionCategory = (typeof SUPPORTED_QUESTION_CATEGORIES)[number];

export function isSupportedCategory(category: string): category is SupportedQuestionCategory {
  return (SUPPORTED_QUESTION_CATEGORIES as readonly string[]).includes(category);
}
