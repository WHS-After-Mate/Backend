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

// 2026-08-17 사용자가 전달한 docs/care_procedure_template.xlsx(사업장 3곳 + 실시술 46개)를 그대로 옮긴
// 것 — 관리 추천(recommendations.service.ts)이 참조하는 실데이터 카탈로그.
const BUSINESSES = [
  {
    id: "amred",
    name: "엠레드 클리닉",
    brand: "AMRED CLINIC",
    talkChannelLabel: "엠레드 클리닉",
    talkChannelUrl: "https://pf.kakao.com/_jyzAT/chat",
    phone: "02-543-3110",
  },
  {
    id: "derna",
    name: "더나 의원",
    brand: "DERNA CLINIC",
    talkChannelLabel: "더나 의원",
    talkChannelUrl: "https://pf.kakao.com/_AxjDxcn/chat",
    phone: "02-3478-8970",
  },
  {
    id: "wim",
    name: "윔 센터",
    brand: "WIM Clinic",
    talkChannelLabel: "윔 센터",
    talkChannelUrl: "https://pf.kakao.com/_cCxbuG/chat",
    phone: "02-0811-2061",
  },
];

interface ProcedureSeed {
  businessId: string;
  name: string;
  tags: string[];
  description: string | null;
}

const PROCEDURES: ProcedureSeed[] = [
  // 엠레드 클리닉 (19)
  { businessId: "amred", name: "튠 콩피에르(Tune Confier)", tags: ["리프팅·탄력"], description: "피부층에 콜라겐을 생성하여 탄력 증가와 리프팅 효과를 주는 강력한 고주파 시술입니다. 이상적인 주파수와 아이스 컨택쿨링 방식으로 통증없이 편안하게 시술이 가능하며, 프락셔널 방식으로 짧은 시술 시간에도 보다 강력한 효과를 볼 수 있는 리프팅 시술 중 하나입니다." },
  { businessId: "amred", name: "울쎄라피 프라임", tags: ["리프팅·탄력"], description: "고강도 집속형 초음파(HIFU, High-Intensity Focused Ultrasound) 기술을 활용하여 피부 깊은 층까지 정밀하게 에너지를 전달하는 비수술적 리프팅 시술입니다. 피부 속 진피층과 SMAS층을 타겟으로 65~70°C의 열 에너지를 조사하여 콜라겐 생성을 촉진하고 시간이 지나면서 피부 탄력 개선 및 리프팅 효과를 제공합니다. 기존 울쎄라보다 정밀한 초음파 진단 기술이 적용되어 더욱 세밀한 맞춤 시술이 가능합니다." },
  { businessId: "amred", name: "티타늄 리프팅", tags: ["리프팅·탄력", "모공·피지 관리", "색소침착 개선"], description: "티타늄 리프팅은 기존 리프팅 장비와 달리 빠른 속도, 낮은 통증, 강력한 효과를 갖춘 프리미엄 올인원 리프팅 솔루션입니다. 단 한 번의 시술로 리프팅, 타이트닝, 모공 개선, 피부 톤 및 색소 개선까지 동시에 기대할 수 있습니다. 세계 최초로 3가지 파장(755nm + 810nm + 1064nm)을 동시에 조사하는 다이오드 레이저 방식을 적용하여, 피부 전 층에 에너지를 균일하게 전달해 탄력 개선과 윤곽 정리, 피부 톤 및 모공 개선 효과를 제공합니다." },
  { businessId: "amred", name: "써마지 FLX", tags: ["리프팅·탄력"], description: "써마지 FLX(써마지 4세대 장비)는 고주파 에너지(RF: Radio Frequency)를 활용하여 피부 깊숙한 층까지 열에너지를 전달하는 비수술적 리프팅 시술입니다. 피부 진피층과 피하 지방층을 집중적으로 자극해 콜라겐 재생을 활성화하고 피부 탄력을 강화하며, 특히 잔주름 개선과 피부결 정돈에 탁월한 효과를 제공합니다. 기존보다 향상된 기술력과 넓어진 시술 면적으로 보다 빠르고 효과적인 리프팅이 가능합니다." },
  { businessId: "amred", name: "초음파™ 보톡스", tags: ["얼굴 윤곽·볼륨"], description: "초음파 진단™ 보톡스는 정밀 초음파 진단 기술을 활용한 개인 맞춤형 보톡스 시술입니다. 기존 보톡스가 손으로 근육을 만져 확인하는 방식에 의존했던 것과 달리, 정밀 초음파를 통해 근육의 크기와 상태를 실시간으로 확인한 후 최적의 용량을 정밀하게 주입합니다. 이를 통해 불필요한 근육 이완을 방지하고 자연스러운 표정과 얼굴 균형을 유지하면서도 원하는 부위만 선택적으로 개선할 수 있습니다." },
  { businessId: "amred", name: "프로파운드", tags: ["리프팅·탄력", "모공·피지 관리"], description: null },
  { businessId: "amred", name: "실리프팅", tags: ["리프팅·탄력"], description: null },
  { businessId: "amred", name: "엘란쎄 윤곽고정술", tags: ["리프팅·탄력"], description: null },
  { businessId: "amred", name: "리쥬란", tags: ["보습·장벽 강화"], description: null },
  { businessId: "amred", name: "쥬베룩", tags: ["보습·장벽 강화"], description: null },
  { businessId: "amred", name: "포텐자", tags: ["리프팅·탄력", "모공·피지 관리"], description: null },
  { businessId: "amred", name: "엑소좀", tags: ["보습·장벽 강화"], description: null },
  { businessId: "amred", name: "스컬트라", tags: ["리프팅·탄력"], description: null },
  { businessId: "amred", name: "스킨바이브", tags: ["보습·장벽 강화"], description: null },
  { businessId: "amred", name: "온다리프팅", tags: ["리프팅·탄력", "바디라인·체형 관리"], description: null },
  { businessId: "amred", name: "슈링크 유니버스", tags: ["리프팅·탄력"], description: null },
  { businessId: "amred", name: "피코웨이", tags: ["모공·피지 관리", "색소침착 개선"], description: null },
  { businessId: "amred", name: "초음파 바디 보톡스", tags: ["바디라인·체형 관리"], description: null },
  { businessId: "amred", name: "바디 갭주사", tags: ["바디라인·체형 관리"], description: null },

  // 더나 의원 (20)
  { businessId: "derna", name: "슈링크 유니버스", tags: ["리프팅·탄력"], description: null },
  { businessId: "derna", name: "스킨 보톡스", tags: ["모공·피지 관리"], description: null },
  { businessId: "derna", name: "쥬비덤 필러", tags: ["리프팅·탄력"], description: null },
  { businessId: "derna", name: "더나부스터", tags: ["보습·장벽 강화"], description: "피부 재생 효과로 잘 알려진 리쥬란 힐러에, 즉각적인 수분감을 채우는 물광주사(HA)와 잔주름 및 모공을 개선하는 더모톡신의 핵심 성분을 더나만의 최적의 비율로 배합한 시그니처 스킨부스터예요. 리쥬란의 강력한 재생 효과는 그대로 누리면서, 특유의 통증은 줄이고 즉각적인 물광 효과는 더한, 가장 진보된 형태의 올인원 피부 솔루션이에요." },
  { businessId: "derna", name: "레이저 제모", tags: ["제모"], description: null },
  { businessId: "derna", name: "인모드 리프팅", tags: ["리프팅·탄력", "바디라인·체형 관리"], description: null },
  { businessId: "derna", name: "소프웨이브", tags: ["리프팅·탄력"], description: null },
  { businessId: "derna", name: "볼뉴머", tags: ["보습·장벽 강화"], description: null },
  // 원본 엑셀 비고란에 "더나 IV 솔루션" 설명이 이 행(레디어스)에 들어있어 그대로 옮김(교정하지 않음).
  { businessId: "derna", name: "레디어스", tags: ["리프팅·탄력"], description: "더나 IV 솔루션은 바쁜 일상과 스트레스, 불균형한 식단으로 지친 현대인의 몸에 필요한 필수 영양소를 더나의 의료진이 직접 설계하여 혈관으로 빠르게 공급하는 세포 단위 1:1 맞춤 웰니스 프로그램이에요. 단순한 영양 공급을 넘어, 수많은 임상 경험과 데이터 분석을 통해 완성된 더나만의 독자적인 레시피로, 지금 내 몸이 가장 필요로 하는 최적의 솔루션을 만나보세요." },
  { businessId: "derna", name: "더나 IV 솔루션", tags: ["컨디션·대사 관리"], description: null },
  { businessId: "derna", name: "얼굴 보톡스", tags: ["얼굴 윤곽·볼륨"], description: null },
  { businessId: "derna", name: "얼굴 윤곽 주사", tags: ["바디라인·체형 관리"], description: null },
  { businessId: "derna", name: "브이올렛", tags: ["보습·장벽 강화"], description: null },
  { businessId: "derna", name: "물광 톡신", tags: ["모공·피지 관리", "보습·장벽 강화"], description: null },
  { businessId: "derna", name: "스킨 바이브", tags: ["보습·장벽 강화"], description: null },
  { businessId: "derna", name: "메디컬 헤드스파", tags: ["두피 관리"], description: null },
  { businessId: "derna", name: "올타이트", tags: ["리프팅·탄력"], description: null },
  { businessId: "derna", name: "고우리 스킨부스터", tags: ["보습·장벽 강화"], description: null },
  { businessId: "derna", name: "리투오", tags: ["리프팅·탄력", "모공·피지 관리", "보습·장벽 강화"], description: "RE2O 리투오(RE2O)는 의료용으로 안전하게 가공된 '인체 유래 진피'를 미세 입자로 만든 스킨부스터예요. 우리 피부의 핵심 구성 성분인 콜라겐, 엘라스틴 등 세포외기질(ECM)을 피부에 직접 보충하여, 피부의 근본적인 구조를 재건하고 건강한 피부 환경을 만들어줘요. 피부 스스로 회복할 힘을 길러주어, 탄력, 잔주름, 모공, 보습 등 복합적인 피부 고민을 함께 개선하는 신개념 재생 솔루션이에요." },
  { businessId: "derna", name: "쿨소닉", tags: ["리프팅·탄력"], description: "COOLSONIQ 쿨소닉은 피부 표면을 영하 10도~15도로 냉각시키며 고강도 집속 초음파(HIFU) 기술을 이용해 피부 안쪽 근막층(SMAS)에 열 응고점을 만들어 피부 조직을 응고시키고, 이를 통해 콜라겐 생성을 촉진하며 피부 리프팅 효과를 유도해요. 시간이 지나면서 피부 탄력과 타이트닝 효과를 기대할 수 있으며, 더나에서는 정교한 개인 분석 시스템을 통해 더욱 세밀한 맞춤 시술을 제공해요." },

  // 윔 센터 (7)
  { businessId: "wim", name: "크라이오 테라피", tags: ["바디라인·체형 관리"], description: "대사 활성화 및 지방 연소 효과로 다이어트 효율을 높입니다. 항염증 작용으로 저속노화 효과를 유도합니다. 교감신경 자극으로 대사 활성화 및 지방 소비 증가, 기초대사량 증가 및 에너지 소비 향상, 전신 염증 조절 및 인슐린 민감도 개선." },
  { businessId: "wim", name: "적외선 캡슐", tags: ["바디라인·체형 관리", "붓기 케어"], description: "심부 체온을 높여 에너지 소비를 늘리고 호르몬과 대사 시스템 전반을 자극합니다. 심부 체온 상승으로 대사율 및 칼로리 소모 증가, 혈류 및 림프순환 개선·노폐물 배출 촉진, 자율신경 안정화 및 이완 효과로 스트레스 호르몬 조절." },
  { businessId: "wim", name: "옥시젠 챔버", tags: ["바디라인·체형 관리"], description: "고압 산소 테라피로 조직에 산소를 공급하여 체지방과 염증을 감소시킵니다. 미토콘드리아 기능 개선과 항산화, 항염증 작용을 통해 저속노화를 유도합니다. 조직 산소 포화도 증가로 미토콘드리아 기능 촉진, 혈당 대사 개선·인슐린 저항성 완화, 산화스트레스 및 염증 감소로 항노화 효과." },
  { businessId: "wim", name: "에어프레셔", tags: ["바디라인·체형 관리", "붓기 케어"], description: "혈액 순환 촉진 및 셀룰라이트 케어로 균형 잡힌 바디라인을 형성합니다. 림프 순환 개선, 붓기 완화 및 노폐물 배출, 바디라인 정돈 효과." },
  { businessId: "wim", name: "WIM 메이트", tags: ["바디라인·체형 관리"], description: "개인의 체력, 유연성을 측정하여 꼭 필요한 운동을 효과적으로 할 수 있도록, 맞춤형 운동 프로그램을 제공합니다. 칼로리 소모 증가, 신체 대사 증가, 스트레스 감소." },
  { businessId: "wim", name: "인프라레드", tags: ["바디라인·체형 관리", "붓기 케어"], description: "관리 순간부터 몸이 빠르게 풀리는 느낌. 따뜻함이 스며들며 긴장이 자연스럽게 완화됨. 전신 체온 상승 → 대사 촉진, 땀 배출 + 림프 순환 증가, 근육 이완 & 피로 회복, 부교감 신경 활성 → 스트레스 완화." },
  { businessId: "wim", name: "윔펄스테라피", tags: ["붓기 케어"], description: "직접 운동하지 않아도 느껴지는 자극. 전담 매니저가 원하는 부위를 집중 케어. 저주파 EMS로 깊은 근육 이완, 어깨·등·하체 피로 완화, 혈류 개선·통증 감소, 마사지 + 신경자극 효과 동시 제공." },
];

async function main() {
  console.log("[seedCareCatalog] businesses upsert 중...");
  for (const b of BUSINESSES) {
    const { error } = await supabase.from("businesses").upsert(
      {
        id: b.id,
        name: b.name,
        brand: b.brand,
        talk_channel_label: b.talkChannelLabel,
        talk_channel_url: b.talkChannelUrl,
        phone: b.phone,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`[businesses:${b.id}] 실패: ${error.message}`);
    console.log(`  - ${b.name} (${b.brand})`);
  }

  console.log(`[seedCareCatalog] procedures upsert 중... (${PROCEDURES.length}건)`);
  for (const p of PROCEDURES) {
    const { error } = await supabase.from("procedures").upsert(
      {
        business_id: p.businessId,
        name: p.name,
        category_tags: p.tags,
        description: p.description,
      },
      { onConflict: "business_id,name" },
    );
    if (error) throw new Error(`[procedures:${p.businessId}/${p.name}] 실패: ${error.message}`);
  }
  console.log(`  - ${PROCEDURES.length}건 완료`);

  console.log("[seedCareCatalog] 완료");
}

main().catch((err) => {
  console.error("[seedCareCatalog] 실패:", err);
  process.exit(1);
});
