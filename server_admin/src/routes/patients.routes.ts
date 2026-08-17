import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as patientsService from "../services/patients.service";
import {
  createCareRecordSchema,
  createPatientSchema,
  listPatientsQuerySchema,
  listReservationsQuerySchema,
  updatePatientSchema,
} from "../validators/patients.validators";

// 이 라우터 전체가 requireAdminAuth 뒤에 걸려있어(routes/index.ts) req.admin이 항상 채워져 있다.
export const patientsRouter = Router();

// 시술기록 추가(D) 화면의 careType select용 — reference_guides에 실제로 검수 등록된 값만 노출한다.
// (클리닉 공통 자료라 브랜드 격리 대상 아님)
patientsRouter.get(
  "/care-types",
  asyncHandler(async (_req, res) => {
    const careTypes = await patientsService.listCareTypes();
    res.status(200).json({ careTypes });
  }),
);

// 시술기록 추가(D) 화면의 관리 부위 다중선택용 — 고정 목록(클리닉 공통, 브랜드 격리 대상 아님)
patientsRouter.get(
  "/body-parts",
  asyncHandler(async (_req, res) => {
    const bodyParts = patientsService.listBodyParts();
    res.status(200).json({ bodyParts });
  }),
);

// 환자 등록 — 이름/생년월일/전화번호 + (선택) 기타사항을 받아 환자번호(patientNo)만 발급한다
// (인증코드는 발급하지 않음 — 회원가입은 patientNo+이름+생년월일 일치로 신원확인). 소속 클리닉(brand)은
// 로그인한 관리자 계정에서 그대로 기록된다. 이름+생년월일+전화번호가 이미 등록된 환자와 전부 일치하면
// 새로 만들지 않고 그 환자를 재사용한다(기타사항은 새 값으로 갱신) — 이 경우 201 대신 200 +
// duplicate: true로 응답해 "새로 만든 게 아니라 기존 환자였다"를 프론트가 구분할 수 있게 한다.
patientsRouter.post(
  "/patients",
  asyncHandler(async (req, res) => {
    const input = createPatientSchema.parse(req.body);
    const { patient, duplicate } = await patientsService.createPatient(input, req.admin!.brand);
    if (duplicate) {
      res.status(200).json({ ...patient, duplicate: true, message: "이미 등록된 환자입니다. 기존 환자 정보를 불러왔습니다." });
      return;
    }
    res.status(201).json(patient);
  }),
);

// 환자 목록/검색 (이름·전화번호·환자번호 부분일치) — 로그인한 클리닉이 등록한 환자만 나온다.
patientsRouter.get(
  "/patients",
  asyncHandler(async (req, res) => {
    const { search } = listPatientsQuerySchema.parse(req.query);
    const patients = await patientsService.listPatients(req.admin!.brand, search);
    res.status(200).json({ patients });
  }),
);

// 환자 상세 — 프로필 + 시술기록 + 이용권
patientsRouter.get(
  "/patients/:patientId",
  asyncHandler(async (req, res) => {
    const result = await patientsService.getPatient(req.params.patientId, req.admin!.brand);
    res.status(200).json(result);
  }),
);

// 환자 프로필 수정
patientsRouter.patch(
  "/patients/:patientId",
  asyncHandler(async (req, res) => {
    const input = updatePatientSchema.parse(req.body);
    const patient = await patientsService.updatePatient(req.params.patientId, input, req.admin!.brand);
    res.status(200).json(patient);
  }),
);

// 시술 기록 추가 — "기록" 버튼. 이용권 추가 API는 따로 없다: 여기서 membershipId(기존 이용권 차감)
// 또는 totalSessions(직접 입력 — 새 이용권 생성) 둘 중 하나를 받아 시술기록과 이용권을 함께 처리한다.
// brand는 클라이언트 입력이 아니라 로그인한 관리자 계정에서 그대로 가져온다.
patientsRouter.post(
  "/patients/:patientId/care-records",
  asyncHandler(async (req, res) => {
    const input = createCareRecordSchema.parse(req.body);
    const result = await patientsService.addCareRecord(req.params.patientId, input, req.admin!.brand);
    res.status(201).json(result);
  }),
);

// 삭제도 이용권 추가와 마찬가지로 따로 없다 — 시술기록을 지우면 그 이용권도 함께 정리된다
// (직접입력으로 막 만든 이용권이면 통째로 삭제, 기존 이용권에서 차감한 거였으면 차감만 1 되돌림).
patientsRouter.delete(
  "/care-records/:careRecordId",
  asyncHandler(async (req, res) => {
    await patientsService.deleteCareRecord(req.params.careRecordId, req.admin!.brand);
    res.status(204).send();
  }),
);

// 전날/금일 방문 + 익일 예약 고객 수(중복 제거) — emr_care_records(회원가입 전) + care_records(회원가입 후)
// 둘 다 합산한다. 대시보드류 화면에서 씀.
patientsRouter.get(
  "/visit-stats",
  asyncHandler(async (req, res) => {
    const stats = await patientsService.getVisitStats(req.admin!.brand);
    res.status(200).json(stats);
  }),
);

// visit-stats 카드(어제/오늘/내일)를 클릭했을 때 그 날짜의 예약 목록(careRecordId 포함)을 보여준다 —
// 예약 취소는 여기서 careRecordId를 골라 기존 DELETE /care-records/:careRecordId를 그대로 호출하면 된다.
patientsRouter.get(
  "/reservations",
  asyncHandler(async (req, res) => {
    const { date } = listReservationsQuerySchema.parse(req.query);
    const result = await patientsService.listReservations(req.admin!.brand, date);
    res.status(200).json(result);
  }),
);
