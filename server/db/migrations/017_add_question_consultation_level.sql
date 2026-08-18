-- WHS After Mate — questions에 consultation_level(상담 필요도) 컬럼 추가
-- 지금까지는 status(answered/out_of_scope/expert_required)만으로 "답변했는지 여부"만 구분했고,
-- 위험 신호 키워드에 안 걸린 애매한 증상 질문(예: "며칠째 붓기가 안 빠지는데 괜찮은 걸까요?")은
-- LLM이 무조건 답변하거나(status: answered) 무조건 범위 밖 처리(out_of_scope)하는 이분법밖에
-- 없었다. consultation_level은 status와 별개 축으로, "답변은 했지만 실제 상태 확인이 필요한
-- 정도"를 LLM이 함께 판단해 알려주기 위한 필드다(questions.prompt.ts 참고).
--
-- NONE: 일반적인 사후관리 정보만으로 충분 / RECOMMENDED: 실제 상태 확인이 있어야 정확한 판단 가능
-- / URGENT: 빠른 전문적 확인이 필요할 가능성 있는 증상 언급됨.
-- status가 out_of_scope/expert_required인 행은 LLM이 이 필드를 채울 계기가 없으므로 NONE 기본값.

alter table public.questions
  add column if not exists consultation_level text not null default 'NONE'
    check (consultation_level in ('NONE', 'RECOMMENDED', 'URGENT'));

comment on column public.questions.consultation_level is
  'LLM이 판단한 상담 필요도(NONE/RECOMMENDED/URGENT) — status와 별개 축. status: answered일 때만
   LLM이 실제로 채우고, out_of_scope/expert_required는 기본값 NONE 그대로 저장됨.';
