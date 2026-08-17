import { z } from "zod";
import { BODY_PARTS } from "../lib/bodyParts";

// 하이픈 없는 숫자만(seed.ts/emr_patients 저장 관례와 동일) 9~11자리 — 국내 유선(9~10자리)·휴대폰(10~11자리) 포괄
const phoneSchema = z.string().regex(/^\d{9,11}$/);

// 알러지/기저질환/의사소견은 별도 필드로 나누지 않고 notes(기타사항) 하나로 합쳐서 받는다.
export const createPatientSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: phoneSchema,
  notes: z.string().optional(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  phone: phoneSchema.optional(),
  notes: z.string().optional(),
});

// brand는 더 이상 여기서 받지 않는다 — 로그인한 클리닉 계정(req.admin.brand)에서 그대로 가져온다
// (수동 선택 시 실수로 다른 클리닉을 고를 여지를 없애기 위함). store는 클리닉당 지점이 1곳뿐이라
// brand와 항상 1:1이었던 중복 정보라 제거했다(009 마이그레이션).
//
// 시술과 이용권은 항상 1:1로 묶인다(별도 "이용권 추가" API 없음) — 시술기록을 추가할 때 라디오로
// (1) 이미 갖고 있는 이용권 중 하나를 골라 그 자리에서 1회 차감(membershipId)하거나
// (2) 새 이용권 자체를 여기서 만들면서 그 1회차를 바로 소비(totalSessions)하는 것, 둘 중 하나만 고른다.
export const createCareRecordSchema = z
  .object({
    careName: z.string().min(1),
    // /aftercare/daily-guide가 reference_guides에서 찾는 키. 목록 밖 값도 저장은 되지만
    // claim 이후 daily-guide 조회 시 404 GUIDE_NOT_AVAILABLE로 폴백된다(server-code-guide.html 참고).
    careType: z.string().min(1),
    careDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // 관리 상세 화면(와이어프레임 11번)처럼 한 시술에 여러 부위가 동시에 해당할 수 있어 중복 선택 가능.
    // 고정 목록(GET /body-parts) 밖의 값은 거부한다.
    partOfBody: z.array(z.enum(BODY_PARTS)).default([]),
    practitioner: z.string().optional(),
    basicAftercareGuide: z.array(z.string()).default([]),
    doctorComment: z.string().optional(),
    // 라디오: 기존 이용권에서 차감
    membershipId: z.string().uuid().optional(),
    // 라디오: 직접 입력(새 이용권을 이 총 횟수로 생성하고 1회차를 바로 사용 처리)
    totalSessions: z.number().int().positive().optional(),
  })
  .refine((data) => (data.membershipId ? !data.totalSessions : !!data.totalSessions), {
    message: "membershipId(기존 이용권 선택)와 totalSessions(직접 입력) 중 하나만 입력해야 합니다.",
    path: ["membershipId"],
  });

export const listPatientsQuerySchema = z.object({
  search: z.string().optional(),
});

// 미지정 시 오늘(KST) — getVisitStats의 어제/오늘/내일 카드 중 하나를 클릭해 그 날짜의
// 예약(=그 날짜 careDate를 가진 시술기록) 목록을 펼쳐보는 용도.
export const listReservationsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
