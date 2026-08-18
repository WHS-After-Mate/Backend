// LLM이 함수 호출 입력 필드 안에 XML 태그 흔적(예: </answer>, </invoke>)을 흘리는 경우가 있어
// 사용자에게 노출되는 모든 LLM 생성 텍스트는 응답 직전에 이 함수로 정리한다.
export function sanitizeLlmText(text: string): string {
  return text
    .replace(/<\/?[a-zA-Z_][\w:-]*\s*\/?>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function sanitizeLlmTextArray(items: string[]): string[] {
  return items.map(sanitizeLlmText).filter((item) => item.length > 0);
}
