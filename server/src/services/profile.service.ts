import { supabaseAdmin, supabaseAnon } from "../config/supabase";
import { Errors } from "../lib/errors";

export async function getProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("name, birth_date, phone, interest_goals")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) throw Errors.noActiveCustomerProfile();

  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    userId,
    name: profile.name,
    birthDate: profile.birth_date,
    email: userResult?.user?.email ?? "",
    phone: profile.phone,
    interestGoals: profile.interest_goals as string[],
  };
}

export async function updateProfile(userId: string, patch: { name?: string; birthDate?: string }) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.birthDate !== undefined && { birth_date: patch.birthDate }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("name, birth_date, phone, interest_goals")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();

  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    userId,
    name: data.name,
    birthDate: data.birth_date,
    email: userResult?.user?.email ?? "",
    phone: data.phone,
    interestGoals: data.interest_goals as string[],
  };
}

// 내 정보 화면의 비밀번호 변경 — 현재 비밀번호를 재검증(signInWithPassword)한 뒤에만 갱신한다 (v0.5)
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userResult?.user?.email;
  if (!email) throw Errors.invalidCurrentPassword();

  const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw Errors.invalidCurrentPassword();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (updateError) throw Errors.internal("비밀번호 변경에 실패했습니다.");
}

// 탈퇴 시 앱 가입 이후 병원에서 쌓인 시술기록/이용권(care_records/memberships)을
// emr_care_records/emr_memberships로 되돌려 병원 원본 데이터로 보존한다.
// external_record_id(migrateEmrDataToApp이 이관 시 원본 emr_*.id를 그대로 채워둠, 027 마이그레이션)
// 로 "이미 emr에 원본이 있는 이관분"과 "가입 후 새로 생긴 분"을 구분한다 — 이관분을 그대로
// 다시 insert하면 emr 쪽에 중복 행이 생기므로, 이관분은 원본을 최신 상태로 갱신만 하고 신규분만
// 새 행으로 되돌린다. brand로 어느 클리닉(emr_patients 행) 소속인지 판별하고, 매칭 실패 시(구
// 데모 데이터 등 brand 누락)엔 이 유저에게 연결된 첫 번째 환자 행에 붙인다.
async function rehydrateEmrData(userId: string, patients: { id: string; brand: string | null }[]) {
  const brandToPatientId = new Map(patients.filter((p) => p.brand).map((p) => [p.brand as string, p.id]));
  const fallbackPatientId = patients[0].id;
  const resolvePatientId = (brand: string | null) => (brand && brandToPatientId.get(brand)) || fallbackPatientId;

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("memberships")
    .select(
      "id, product_name, total_count, used_count, expires_at, last_used_at, available_care_names, brand, external_record_id",
    )
    .eq("user_id", userId);
  if (membershipsError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");

  // memberships.id -> emr_memberships.id (이관분은 원본 id 그대로, 신규분은 방금 만든 id)
  const membershipIdMap = new Map<string, string>();
  const migratedMemberships = (memberships ?? []).filter((m) => m.external_record_id);
  const newMemberships = (memberships ?? []).filter((m) => !m.external_record_id);

  // 이관분: emr_memberships 원본을 최신 소비 상태로 갱신(remaining_count는 generated라 제외, 007)
  for (const m of migratedMemberships) {
    const { error: updateError } = await supabaseAdmin
      .from("emr_memberships")
      .update({ used_count: m.used_count, expires_at: m.expires_at, last_used_at: m.last_used_at })
      .eq("id", m.external_record_id as string);
    if (updateError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");
    membershipIdMap.set(m.id, m.external_record_id as string);
  }

  // 신규분: 새 emr_memberships 행 생성
  if (newMemberships.length > 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("emr_memberships")
      .insert(
        newMemberships.map((m) => ({
          patient_id: resolvePatientId(m.brand),
          product_name: m.product_name,
          total_count: m.total_count,
          used_count: m.used_count,
          expires_at: m.expires_at,
          last_used_at: m.last_used_at,
          available_care_names: m.available_care_names,
          brand: m.brand,
        })),
      )
      .select("id");
    if (insertError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");
    newMemberships.forEach((m, i) => membershipIdMap.set(m.id, inserted![i].id));
  }

  const { data: careRecords, error: careRecordsError } = await supabaseAdmin
    .from("care_records")
    .select(
      "care_name, care_date, part_of_body, brand, practitioner, basic_aftercare_guide, doctor_comment, session_number, total_sessions, membership_id, session_consumed, external_record_id",
    )
    .eq("user_id", userId);
  if (careRecordsError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");

  const migratedCareRecords = (careRecords ?? []).filter((r) => r.external_record_id);
  const newCareRecords = (careRecords ?? []).filter((r) => !r.external_record_id);

  // 이관분: emr_care_records 원본의 회차 번호/소비 상태만 최신화(나머지 필드는 애초에 안 바뀜)
  for (const r of migratedCareRecords) {
    const { error: updateError } = await supabaseAdmin
      .from("emr_care_records")
      .update({ session_number: r.session_number, session_consumed: r.session_consumed })
      .eq("id", r.external_record_id as string);
    if (updateError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");
  }

  // 신규분: 새 emr_care_records 행 생성
  if (newCareRecords.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("emr_care_records").insert(
      newCareRecords.map((r) => ({
        patient_id: resolvePatientId(r.brand),
        care_name: r.care_name,
        care_date: r.care_date,
        part_of_body: r.part_of_body,
        brand: r.brand,
        practitioner: r.practitioner,
        basic_aftercare_guide: r.basic_aftercare_guide,
        doctor_comment: r.doctor_comment,
        session_number: r.session_number,
        total_sessions: r.total_sessions,
        membership_id: r.membership_id ? (membershipIdMap.get(r.membership_id) ?? null) : null,
        session_consumed: r.session_consumed,
      })),
    );
    if (insertError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");
  }
}

// 설정 화면의 회원 탈퇴 — 현재 비밀번호 재확인 후 앱 계정만 삭제한다. emr_patients(병원 환자
// 등록 원본)와 그 위에 쌓인 시술기록/이용권은 rehydrateEmrData로 emr_* 테이블에 되돌려 보존하고,
// claim만 풀어(claimed_user_id/claimed_at null) 나중에 같은 환자번호로 재가입할 수 있게 한다.
export async function withdraw(userId: string, password: string) {
  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userResult?.user?.email;
  if (!email) throw Errors.invalidCurrentPassword();

  const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (verifyError) throw Errors.invalidCurrentPassword();

  const { data: claimedPatients, error: claimedError } = await supabaseAdmin
    .from("emr_patients")
    .select("id, brand")
    .eq("claimed_user_id", userId);
  if (claimedError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");

  if (claimedPatients && claimedPatients.length > 0) {
    await rehydrateEmrData(userId, claimedPatients);
  }

  // claimed_user_id는 auth.users FK가 on delete set null이라 계정 삭제만으로도 자동으로 풀리지만,
  // claimed_at은 그대로 남아 "가입 이력은 있는데 계정은 없는" 애매한 상태가 되므로 미리 명시적으로
  // 둘 다 초기화해 완전한 미가입 상태로 되돌린다. 다른 클리닉에 연결된 형제 행(다중 클리닉 자동
  // 연결, auth.service.ts의 signup() 참고)도 claimed_user_id가 같은 값이라 한 번의 update로 함께 풀린다.
  const { error: unclaimError } = await supabaseAdmin
    .from("emr_patients")
    .update({ claimed_user_id: null, claimed_at: null })
    .eq("claimed_user_id", userId);
  if (unclaimError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");

  // profiles/medical_profiles/care_records/memberships/membership_usages/device_tokens/
  // notification_log/questions/medical_data_access_log는 전부 auth.users FK CASCADE로 함께 삭제된다
  // (시술기록/이용권은 위에서 이미 emr_*로 사본을 남겨뒀으니 원본 삭제는 의도된 정리).
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) throw Errors.internal("회원 탈퇴 처리에 실패했습니다.");
}

export async function updateInterestGoals(userId: string, goals: string[]) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ interest_goals: goals, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("interest_goals")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();
  return { interestGoals: data.interest_goals as string[] };
}

export async function getNotificationSettings(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("care_notification, marketing_notification")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) throw Errors.noActiveCustomerProfile();
  return {
    careNotification: data.care_notification as boolean,
    marketingNotification: data.marketing_notification as boolean,
  };
}

export async function updateNotificationSettings(
  userId: string,
  patch: { careNotification?: boolean; marketingNotification?: boolean },
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      ...(patch.careNotification !== undefined && { care_notification: patch.careNotification }),
      ...(patch.marketingNotification !== undefined && {
        marketing_notification: patch.marketingNotification,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("care_notification, marketing_notification")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();
  return {
    careNotification: data.care_notification as boolean,
    marketingNotification: data.marketing_notification as boolean,
  };
}
