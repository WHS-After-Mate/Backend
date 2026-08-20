import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env에 설정되어 있어야 합니다.");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TreatmentRow {
  brand: string;
  careName: string;
  careType: string | null;
  bodyParts: string[];
  description?: string;
}

const AMRED = "AMRED CLINIC";
const DERNA = "DERNA CLINIC";
const WIM = "WIM Clinic";

// 엑셀 원본(docs/care_procedure_template.xlsx "시술" 시트) 46행 전체를 브랜드+시술명 기준으로
// 재시딩한다. care_type은 daily-guide에서 더 이상 필수가 아니라(treatment_guides로 대체),
// questions(Q&A) 쪽 참고용으로만 확실한 것만 채우고 애매한 건 null로 둔다.
const TREATMENTS: TreatmentRow[] = [
  // ── 엠레드 클리닉 (19) ──
  {
    brand: AMRED,
    careName: "튠 콩피에르®",
    careType: null,
    bodyParts: ["얼굴 전체", "턱선", "이중턱"],
    description:
      "피부층에 콜라겐을 생성하여 탄력 증가와 리프팅 효과를 주는 강력한 고주파 시술입니다. 이상적인 주파수와 아이스 컨택쿨링 방식으로 통증없이 편안하게 시술이 가능하며, 프락셔널 방식으로 짧은 시술 시간에도 보다 강력한 효과를 볼 수 있는 리프팅 시술 중 하나입니다.",
  },
  {
    brand: AMRED,
    careName: "울쎄라피 프라임",
    careType: null,
    bodyParts: ["얼굴 전체", "턱선", "목"],
    description:
      "고강도 집속형 초음파(HIFU) 기술을 활용하여 피부 깊은 층까지 정밀하게 에너지를 전달하는 비수술적 리프팅 시술입니다. 피부 속 진피층과 SMAS층을 타겟으로 65~70°C의 열 에너지를 조사하여 콜라겐 생성을 촉진하고 시간이 지나면서 피부 탄력 개선 및 리프팅 효과를 제공합니다.",
  },
  {
    brand: AMRED,
    careName: "티타늄 리프팅",
    careType: null,
    bodyParts: ["얼굴 전체", "볼", "턱선"],
    description:
      "빠른 속도, 낮은 통증, 강력한 효과를 갖춘 프리미엄 올인원 리프팅 솔루션입니다. 3가지 파장(755nm + 810nm + 1064nm)을 동시에 조사하는 다이오드 레이저 방식으로 리프팅, 타이트닝, 모공 개선, 피부 톤 및 색소 개선까지 기대할 수 있습니다.",
  },
  {
    brand: AMRED,
    careName: "써마지 FLX",
    careType: null,
    bodyParts: ["얼굴 전체", "눈가", "턱선"],
    description:
      "고주파 에너지(RF)를 활용해 피부 깊숙한 층까지 열에너지를 전달하는 비수술적 리프팅 시술입니다. 진피층과 피하 지방층을 자극해 콜라겐 재생을 활성화하고 탄력을 강화하며, 잔주름 개선과 피부결 정돈에 효과적입니다.",
  },
  {
    brand: AMRED,
    careName: "초음파™ 보톡스",
    careType: null,
    bodyParts: ["턱", "이마"],
    description:
      "정밀 초음파 진단 기술을 활용한 개인 맞춤형 보톡스 시술입니다. 초음파로 근육의 크기와 상태를 실시간 확인한 후 최적의 용량을 정밀 주입해, 불필요한 근육 이완을 방지하고 자연스러운 표정을 유지하면서 원하는 부위만 선택적으로 개선합니다.",
  },
  { brand: AMRED, careName: "프로파운드", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "실리프팅", careType: null, bodyParts: ["얼굴 전체", "턱선"] },
  { brand: AMRED, careName: "엘란쎄 윤곽고정술", careType: null, bodyParts: ["턱선", "볼"] },
  { brand: AMRED, careName: "리쥬란", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "쥬베룩", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "포텐자", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "엑소좀", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "스컬트라", careType: null, bodyParts: ["볼", "얼굴 전체"] },
  { brand: AMRED, careName: "스킨바이브", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "온다리프팅", careType: null, bodyParts: ["얼굴 전체", "턱선"] },
  { brand: AMRED, careName: "슈링크 유니버스", careType: null, bodyParts: ["얼굴 전체", "턱선"] },
  { brand: AMRED, careName: "피코웨이", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: AMRED, careName: "초음파 바디 보톡스", careType: null, bodyParts: ["종아리", "기타"] },
  { brand: AMRED, careName: "바디 갭주사", careType: null, bodyParts: ["복부", "기타"] },

  // ── 더나 의원 (20) ──
  { brand: DERNA, careName: "슈링크 유니버스", careType: null, bodyParts: ["얼굴 전체", "턱선"] },
  { brand: DERNA, careName: "스킨 보톡스", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "쥬비덤 필러", careType: null, bodyParts: ["팔자", "입술", "볼"] },
  {
    brand: DERNA,
    careName: "더나부스터",
    careType: null,
    bodyParts: ["얼굴 전체"],
    description:
      "리쥬란 힐러에 즉각적인 수분감을 채우는 물광주사(HA)와 잔주름·모공을 개선하는 더모톡신의 핵심 성분을 더나만의 최적 비율로 배합한 시그니처 스킨부스터입니다.",
  },
  { brand: DERNA, careName: "레이저 제모 솔루션", careType: null, bodyParts: ["팔", "허벅지", "종아리"] },
  { brand: DERNA, careName: "인모드 리프팅", careType: null, bodyParts: ["얼굴 전체", "턱선"] },
  { brand: DERNA, careName: "소프웨이브", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "볼뉴머", careType: null, bodyParts: ["볼"] },
  { brand: DERNA, careName: "레디어스", careType: null, bodyParts: ["볼", "턱선"] },
  {
    brand: DERNA,
    careName: "더나 IV 솔루션",
    careType: null,
    bodyParts: ["기타"],
    description:
      "바쁜 일상과 스트레스, 불균형한 식단으로 지친 몸에 필요한 필수 영양소를 의료진이 직접 설계해 혈관으로 공급하는 세포 단위 1:1 맞춤 웰니스 프로그램입니다.",
  },
  { brand: DERNA, careName: "얼굴 보톡스", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "얼굴 윤곽 주사", careType: null, bodyParts: ["턱선"] },
  { brand: DERNA, careName: "브이올렛", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "물광 톡신", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "스킨 바이브", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "메디컬 헤드스파", careType: null, bodyParts: ["기타"] },
  { brand: DERNA, careName: "올타이트", careType: null, bodyParts: ["얼굴 전체"] },
  { brand: DERNA, careName: "고우리 스킨부스터", careType: null, bodyParts: ["얼굴 전체"] },
  {
    brand: DERNA,
    careName: "리투오",
    careType: null,
    bodyParts: ["얼굴 전체"],
    description:
      "의료용으로 안전하게 가공된 인체 유래 진피를 미세 입자로 만든 스킨부스터입니다. 콜라겐, 엘라스틴 등 세포외기질(ECM)을 피부에 직접 보충해 피부의 근본적인 구조를 재건합니다.",
  },
  {
    brand: DERNA,
    careName: "쿨소닉",
    careType: null,
    bodyParts: ["얼굴 전체", "턱선"],
    description:
      "피부 표면을 영하 10~15도로 냉각시키며 HIFU 기술로 피부 안쪽 SMAS층에 열 응고점을 만들어 콜라겐 생성을 촉진하고 리프팅 효과를 유도합니다.",
  },

  // ── 윔 센터 (7) — 전부 웰니스 회복 기기, care_type 매칭 없음 ──
  {
    brand: WIM,
    careName: "크라이오 테라피",
    careType: null,
    bodyParts: ["기타"],
    description: "대사 활성화 및 지방 연소 효과로 다이어트 효율을 높이고, 항염증 작용으로 저속노화 효과를 유도합니다.",
  },
  {
    brand: WIM,
    careName: "적외선 캡슐",
    careType: null,
    bodyParts: ["기타"],
    description: "심부 체온을 높여 에너지 소비를 늘리고 호르몬과 대사 시스템 전반을 자극합니다.",
  },
  {
    brand: WIM,
    careName: "옥시젠 챔버",
    careType: null,
    bodyParts: ["기타"],
    description: "고압 산소 테라피로 조직에 산소를 공급해 체지방과 염증을 감소시키고 저속노화를 유도합니다.",
  },
  {
    brand: WIM,
    careName: "에어프레셔",
    careType: null,
    bodyParts: ["종아리", "기타"],
    description: "혈액 순환 촉진 및 셀룰라이트 케어로 균형 잡힌 바디라인을 형성합니다.",
  },
  {
    brand: WIM,
    careName: "WIM 메이트",
    careType: null,
    bodyParts: ["기타"],
    description: "개인의 체력·유연성을 측정해 꼭 필요한 운동을 효과적으로 할 수 있도록 맞춤형 운동 프로그램을 제공합니다.",
  },
  {
    brand: WIM,
    careName: "인프라레드",
    careType: null,
    bodyParts: ["기타"],
    description: "전신 체온 상승으로 대사를 촉진하고 근육 이완과 피로 회복, 스트레스 완화를 돕습니다.",
  },
  {
    brand: WIM,
    careName: "윔펄스테라피",
    careType: null,
    bodyParts: ["기타"],
    description: "저주파 EMS로 깊은 근육 이완을 유도해 어깨/등/하체 피로를 완화하고 혈류 개선, 통증 감소에 도움을 줍니다.",
  },
];

async function main() {
  console.log("[seedTreatmentCatalogFull] treatment_catalog upsert 중...");
  for (const t of TREATMENTS) {
    const { error } = await supabase.from("treatment_catalog").upsert(
      {
        brand: t.brand,
        care_name: t.careName,
        care_type: t.careType,
        body_parts: t.bodyParts,
        description: t.description ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand,care_name" },
    );
    if (error) throw new Error(`[treatment_catalog:${t.brand}/${t.careName}] 실패: ${error.message}`);
    console.log(`  - [${t.brand}] ${t.careName} (${t.careType ?? "care_type 없음"})`);
  }
  console.log(`[seedTreatmentCatalogFull] 완료 — ${TREATMENTS.length}개 행`);
}

main();
