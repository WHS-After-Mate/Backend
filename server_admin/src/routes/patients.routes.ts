import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as patientsService from "../services/patients.service";
import {
  createCareRecordSchema,
  createMembershipSchema,
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from "../validators/patients.validators";

export const patientsRouter = Router();

// 환자 등록 — 이름/생년월일/전화번호 + (선택) 알러지·기저질환·의사 소견을 받아 환자번호를 발급한다.
patientsRouter.post(
  "/patients",
  asyncHandler(async (req, res) => {
    const input = createPatientSchema.parse(req.body);
    const patient = await patientsService.createPatient(input);
    res.status(201).json(patient);
  }),
);

// 환자 목록/검색 (이름·전화번호·환자번호 부분일치)
patientsRouter.get(
  "/patients",
  asyncHandler(async (req, res) => {
    const { search } = listPatientsQuerySchema.parse(req.query);
    const patients = await patientsService.listPatients(search);
    res.status(200).json({ patients });
  }),
);

// 환자 상세 — 프로필 + 시술기록 + 이용권 + 발급된 인증코드 이력
patientsRouter.get(
  "/patients/:patientId",
  asyncHandler(async (req, res) => {
    const result = await patientsService.getPatient(req.params.patientId);
    res.status(200).json(result);
  }),
);

// 환자 프로필 수정
patientsRouter.patch(
  "/patients/:patientId",
  asyncHandler(async (req, res) => {
    const input = updatePatientSchema.parse(req.body);
    const patient = await patientsService.updatePatient(req.params.patientId, input);
    res.status(200).json(patient);
  }),
);

// 시술 기록 추가 — "기록" 버튼
patientsRouter.post(
  "/patients/:patientId/care-records",
  asyncHandler(async (req, res) => {
    const input = createCareRecordSchema.parse(req.body);
    const careRecord = await patientsService.addCareRecord(req.params.patientId, input);
    res.status(201).json(careRecord);
  }),
);

patientsRouter.delete(
  "/care-records/:careRecordId",
  asyncHandler(async (req, res) => {
    await patientsService.deleteCareRecord(req.params.careRecordId);
    res.status(204).send();
  }),
);

// 이용권 추가
patientsRouter.post(
  "/patients/:patientId/memberships",
  asyncHandler(async (req, res) => {
    const input = createMembershipSchema.parse(req.body);
    const membership = await patientsService.addMembership(req.params.patientId, input);
    res.status(201).json(membership);
  }),
);

patientsRouter.delete(
  "/memberships/:membershipId",
  asyncHandler(async (req, res) => {
    await patientsService.deleteMembership(req.params.membershipId);
    res.status(204).send();
  }),
);

// 가입 인증코드 발급 — 24시간 유효. 실제 SMS 발송 없이 이 응답의 code를 admin-web 화면에 표시해
// 데스크에서 환자에게 안내하는 방식(server/README의 SMS 미구현 방침과 동일한 결).
patientsRouter.post(
  "/patients/:patientId/signup-code",
  asyncHandler(async (req, res) => {
    const result = await patientsService.issueSignupCode(req.params.patientId);
    res.status(201).json({ code: result.code, expiresAt: result.expires_at, issuedAt: result.created_at });
  }),
);
