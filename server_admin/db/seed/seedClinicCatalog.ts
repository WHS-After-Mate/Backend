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

// 2026-08-17 사용자가 전달한 실제 사업장 데이터(엠레드/더나 시술 5종씩 + 의료진).
// 윔 클리닉은 의료진 정보를 받지 못해 사용자 요청대로 임의 이름 6명을 넣어둔다(placeholder — 실명 아님).
// 카카오톡/전화번호는 여기서 다시 넣지 않는다 — server/db/seed/seedCareCatalog.ts가 채운
// public.businesses에 이미 3개 클리닉 전부 들어있어(clinic.service.ts가 그 테이블을 재사용).
const DOCTORS: { brand: string; name: string }[] = [
  ...["이정일", "홍서영", "이철희", "정준범", "김민선"].map((name) => ({ brand: "AMRED CLINIC", name })),
  ...["김윤석", "고범준", "김지현", "조형규", "권주현"].map((name) => ({ brand: "DERNA CLINIC", name })),
  // 윔 클리닉 — 실제 의료진 정보 없음, 사용자 요청으로 임의 이름만 채움(placeholder)
  ...["박도윤", "최서현", "정하람", "강태민", "윤소율", "임재현"].map((name) => ({ brand: "WIM Clinic", name })),
];

interface TreatmentSeed {
  careName: string;
  careType: string;
  bodyParts: string[];
  description: string;
}

const AMRED_TREATMENTS: TreatmentSeed[] = [
  {
    careName: "튠 콩피에르®",
    careType: "energy_lifting",
    bodyParts: ["얼굴 전체", "턱선", "이중턱"],
    description:
      "피부층에 콜라겐을 생성하여 탄력 증가와 리프팅 효과를 주는 강력한 고주파 시술입니다. 이상적인 주파수와 아이스 컨택쿨링 방식으로 통증없이 편안하게 시술이 가능하며, 프락셔널 방식으로 짧은 시술 시간에도 보다 강력한 효과를 볼 수 있는 리프팅 시술 중 하나입니다.",
  },
  {
    careName: "울쎄라피 프라임",
    careType: "energy_lifting",
    bodyParts: ["얼굴 전체", "턱선", "목"],
    description:
      "고강도 집속형 초음파(HIFU, High-Intensity Focused Ultrasound) 기술을 활용하여 피부 깊은 층까지 정밀하게 에너지를 전달하는 비수술적 리프팅 시술입니다. 피부 속 진피층과 SMAS층을 타겟으로 65~70°C의 열 에너지를 조사하여 콜라겐 생성을 촉진하고 시간이 지나면서 피부 탄력 개선 및 리프팅 효과를 제공합니다. 기존 울쎄라보다 정밀한 초음파 진단 기술이 적용되어 더욱 세밀한 맞춤 시술이 가능합니다.",
  },
  {
    careName: "티타늄 리프팅",
    careType: "energy_lifting",
    bodyParts: ["얼굴 전체", "볼", "턱선"],
    description:
      "티타늄 리프팅은 기존 리프팅 장비와 달리 빠른 속도, 낮은 통증, 강력한 효과를 갖춘 프리미엄 올인원 리프팅 솔루션입니다. 단 한 번의 시술로 리프팅, 타이트닝, 모공 개선, 피부 톤 및 색소 개선까지 동시에 기대할 수 있습니다. 세계 최초로 3가지 파장(755nm + 810nm + 1064nm)을 동시에 조사하는 다이오드 레이저 방식을 적용하여, 피부 전 층에 에너지를 균일하게 전달해 탄력 개선과 윤곽 정리, 피부 톤 및 모공 개선 효과를 제공합니다. 기존보다 향상된 기술력과 넓어진 시술 면적으로 보다 빠르고 효과적인 리프팅이 가능합니다.",
  },
  {
    careName: "써마지 FLX",
    careType: "energy_lifting",
    bodyParts: ["얼굴 전체", "눈가", "턱선"],
    description:
      "써마지 FLX(써마지 4세대 장비)는 고주파 에너지(RF: Radio Frequency)를 활용하여 피부 깊숙한 층까지 열에너지를 전달하는 비수술적 리프팅 시술입니다. 피부 진피층과 피하 지방층을 집중적으로 자극해 콜라겐 재생을 활성화하고 피부 탄력을 강화하며, 특히 잔주름 개선과 피부결 정돈에 탁월한 효과를 제공합니다. 기존보다 향상된 기술력과 넓어진 시술 면적으로 보다 빠르고 효과적인 리프팅이 가능합니다.",
  },
  {
    careName: "초음파™ 보톡스",
    careType: "botox",
    bodyParts: ["턱", "이마"],
    description:
      "초음파 진단™ 보톡스는 정밀 초음파 진단 기술을 활용한 개인 맞춤형 보톡스 시술입니다. 기존 보톡스가 손으로 근육을 만져 확인하는 방식에 의존했던 것과 달리, 정밀 초음파를 통해 근육의 크기와 상태를 실시간으로 확인한 후 최적의 용량을 정밀하게 주입합니다. 이를 통해 불필요한 근육 이완을 방지하고 자연스러운 표정과 얼굴 균형을 유지하면서도 원하는 부위만 선택적으로 개선할 수 있습니다.",
  },
];

const DERNA_TREATMENTS: TreatmentSeed[] = [
  {
    careName: "슈링크 유니버스",
    careType: "energy_lifting",
    bodyParts: ["얼굴 전체", "턱선"],
    description:
      "기존 슈링크에서 한 단계 진화한 2세대 HIFU 리프팅이에요. 2.5배 빨라진 속도로 통증과 시술 시간을 대폭 줄이고, 피부 굴곡면에 맞춰 부드럽게 에너지를 전달하는 선(Line) 타입의 MP 모드를 탑재했어요. 끊김 없는 선 타입의 에너지 조사를 통해 굴곡진 부위까지 빈틈없이 시술이 가능하며, 빠르고 편안하게 균일한 리프팅 효과를 경험할 수 있어요.",
  },
  {
    careName: "스킨 보톡스",
    careType: "botox",
    bodyParts: ["얼굴 전체"],
    description:
      "기존 보톡스와 달리, 보툴리눔 톡신을 근육이 아닌 피부의 얕은 층에 소량씩 촘촘하게 주입하여 피부결 자체를 개선하는 시술이에요. 피부 진피층에 작용하여 늘어진 모공을 조여주고, 피지 분비를 줄이며, 잔주름을 개선해 마치 다림질한 듯 매끄럽고 쫀쫀한 피부를 만들어줘요. 표정 변화 없이 피부 표면 전체의 컨디션을 끌어올리는, 가장 효과적인 '더모톡신' 시술이에요.",
  },
  {
    careName: "쥬비덤 필러",
    careType: "filler",
    bodyParts: ["팔자", "입술", "볼"],
    description:
      "전 세계적으로 가장 널리 사용되는 히알루론산(HA) 필러의 대표 주자인 쥬비덤은, 특허받은 바이크로스™(VYCROSS™) 기술로 만들어져 부드러우면서도 뛰어난 응집력을 자랑해요. 피부 조직에 자연스럽게 밀착되어, 표정을 짓거나 움직일 때도 이물감 없이 내 얼굴 같은 자연스러운 볼륨을 만들어줘요. 오랜 시간 동안 전 세계적으로 안전성과 효과를 입증받은 명품 필러로, 가장 만족스럽고 자연스러운 결과를 원하는 분들을 위한 솔루션이에요.",
  },
  {
    careName: "더나부스터",
    careType: "skin_booster",
    bodyParts: ["얼굴 전체"],
    description:
      "피부 재생 효과로 잘 알려진 리쥬란 힐러에, 즉각적인 수분감을 채우는 물광주사(HA)와 잔주름 및 모공을 개선하는 더모톡신의 핵심 성분을 더나만의 최적의 비율로 배합한 시그니처 스킨부스터예요. 리쥬란의 강력한 재생 효과는 그대로 누리면서, 특유의 통증은 줄이고 즉각적인 물광 효과는 더한, 가장 진보된 형태의 올인원 피부 솔루션이에요.",
  },
  {
    careName: "레이저 제모 솔루션",
    careType: "hair_removal",
    bodyParts: ["팔", "허벅지", "종아리"],
    description:
      "레이저 제모는 단순한 털 제거가 아니라, 모낭을 파괴해 재성장을 막는 정교한 의학 시술이에요. 더나는 고객님의 피부톤과 모발 굵기에 딱 맞는 전용 장비로 안전하고 섬세하게 시술해 드려요. 매일 반복되는 면도의 번거로움과 피부 자극, 더나의 솔루션으로 말끔히 지워 드릴게요. 가장 효과적인 맞춤 시술로 매끄러운 피부와 여유로운 아침을 선물해 드릴게요.",
  },
];

const TREATMENTS = [...AMRED_TREATMENTS, ...DERNA_TREATMENTS];

async function main() {
  console.log("[seedClinicCatalog] clinic_doctors upsert 중...");
  for (const doctor of DOCTORS) {
    const { error } = await supabase
      .from("clinic_doctors")
      .upsert({ brand: doctor.brand, name: doctor.name }, { onConflict: "brand,name" });
    if (error) throw new Error(`[clinic_doctors:${doctor.brand}/${doctor.name}] 실패: ${error.message}`);
  }
  console.log(`  - ${DOCTORS.length}명 완료`);

  console.log("[seedClinicCatalog] treatment_catalog upsert 중...");
  for (const t of TREATMENTS) {
    const { error } = await supabase.from("treatment_catalog").upsert(
      {
        care_name: t.careName,
        care_type: t.careType,
        body_parts: t.bodyParts,
        description: t.description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "care_name" },
    );
    if (error) throw new Error(`[treatment_catalog:${t.careName}] 실패: ${error.message}`);
    console.log(`  - ${t.careName} (${t.careType})`);
  }

  console.log("[seedClinicCatalog] 완료");
}

main()
  .catch((err) => {
    console.error("[seedClinicCatalog] 실패:", err.message);
    process.exit(1);
  })
  .finally(() => process.exit(0));
