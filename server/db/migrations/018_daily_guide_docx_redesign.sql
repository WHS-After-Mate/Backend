-- WHS After Mate — aftercare_guides를 dailyGuide.prompt 재설계(docs/prompt.docx, 2026-08-19)에 맞춰
-- 컬럼 재정의. 기존엔 LLM 출력이 reference_guides 원문(must_avoid/basic_care)을 그대로 재서술하는
-- 구조였는데, 이제는 시술·환자 정보를 근거로 LLM이 직접 종합한 aftercare(사후관리 방법)/
-- precautions(주의사항)/key_care(오늘 가장 중요한 한 줄 요약) 구조로 바뀐다 — 이름이 바뀐 두
-- 컬럼은 값 의미도 함께 바뀐다(must_avoid→precautions, basic_care→aftercare 그대로 1:1 대응).
-- next_check_date는 그대로 유지(여전히 reference_guides.next_check_offset_days 기반 서버 계산값,
-- LLM이 만드는 값 아님 — dailyGuide.prompt.ts 참고).

alter table public.aftercare_guides rename column must_avoid to precautions;
alter table public.aftercare_guides rename column basic_care to aftercare;
alter table public.aftercare_guides add column if not exists key_care text not null default '';

comment on column public.aftercare_guides.aftercare is
  '오늘 경과일에 맞는 사후관리 방법(정확히 3개, 회복 주요 기간이 지났으면 빈 배열). LLM이 시술
   정보+환자 정보를 근거로 직접 생성 — reference_guides 원문을 그대로 옮기지 않는다(docx 재설계).';
comment on column public.aftercare_guides.precautions is
  '오늘 경과일에 맞는 주의사항(정확히 3개, 회복 주요 기간이 지났으면 빈 배열). 위 aftercare와 동일한
   생성 방식.';
comment on column public.aftercare_guides.key_care is
  '오늘 가장 중요하게 기억해야 할 내용 한 줄 요약. 회복 주요 기간이 지난 시점이면 "일상생활 복귀
   가능" 취지의 안내가 담기고, 이때 aftercare/precautions는 빈 배열이 된다.';
