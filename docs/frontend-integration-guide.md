# WHS After Mate — 프론트엔드(Android) 연동 가이드

Android Studio에서 이 백엔드(`server/`)를 로컬로 띄우고 API를 호출하기 위한 안내 문서. API 자체의 요청/응답 스펙은 [`api-spec.md`](./api-spec.md)를 참고하고, 이 문서는 **"서버를 켜고 앱에서 연결하는 절차"**에 집중한다.

## 0. 배포된 서버 쓰기 (추천 — 2026-08-18부터, 로컬에서 서버 안 띄워도 됨)

가비아 클라우드에 서버가 상시로 떠있다(해커톤 기간 8/28까지). **더 이상 프론트 담당자 컴퓨터에서 서버를 직접 띄울 필요 없이**, 아래 주소로 바로 호출하면 된다:

```
baseUrl = http://1.201.116.115/api/v1/
```

HTTPS가 아니라서(도메인이 없어 SSL 인증서 발급 불가 — 해커톤 종료 후 필요해지면 추가 예정) 안드로이드 기본 정책상 그냥은 막힌다. 아래 4번의 `network_security_config.xml`에 이 IP(`1.201.116.115`)를 도메인 항목으로 추가해야 한다.

이 서버는 8/28(금) 23:59에 삭제될 예정(해커톤 지원 종료)이니 그 이후엔 다시 로컬 실행(1~3번) 또는 새 서버로 전환 필요.

**로컬에서 직접 서버를 띄워야 하는 경우**(예: 코드 수정하면서 즉시 반영해서 테스트하고 싶을 때)만 아래 1~3번을 따른다 — 배포된 서버를 쓸 거면 건너뛰어도 된다.

## 1. 저장소 준비

1. GitHub 저장소(`WHS-After-Mate/Backend`)는 private — Collaborator 초대를 받은 계정으로 로그인 후 접근
2. **이 리포는 안드로이드 프로젝트 폴더와 완전히 별개의 폴더에 clone한다.** Android Studio로 열 필요 없음 — 터미널(또는 Android Studio 내장 터미널)에서 서버만 띄우는 용도.

```bash
git clone <repo-url>
cd Backend/server
npm install
```

## 2. 환경변수 설정

`.env`는 git에 올라가지 않으므로(`.gitignore`) **별도 채널(카톡/슬랙 DM 등)로 전달받은 값**을 아래처럼 채워 넣는다.

```bash
cp .env.example .env
```

`.env`에 채울 값 (전달받은 것 그대로 사용 — **같은 Supabase 프로젝트 키를 써야 데모 계정 4개가 동일하게 보인다**):

| 변수 | 설명 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | 백엔드에서 이미 만든 Supabase 프로젝트 값 |
| `OPENAI_API_KEY` | Q&A 답변/추천 사유 생성용 OpenAI API 키 — **선택.** 없어도 서버는 정상 기동하고 회원가입/로그인/관리 이력 등 나머지 API는 그대로 동작한다. `GET /aftercare/daily-guide`는 `(v0.16)` OpenAI를 아예 쓰지 않아(DB 직접 조회) 이 키와 무관하게 항상 동작한다. 없을 때 `POST /aftercare/questions`는 `503 ANSWER_GENERATION_FAILED`를 응답하고, 다음 관리 추천의 `reasons`/`detailDescription`은 정적 템플릿 문구로 조용히 폴백한다(추천 자체는 계속 뜸) |

> ⚠️ **DB 마이그레이션과 시드(`npm run seed`)는 실행하지 않는다.** 이미 Supabase에 적용돼 있어서 재실행하면 데모 계정 중복 에러가 난다.

## 3. 서버 실행

```bash
npm run dev
```

`http://localhost:4000` 에서 기동되고, 콘솔에 `WHS After Mate API listening on :4000` 이 뜨면 정상. 브라우저로 `http://localhost:4000/health` 접속해서 `{"status":"ok"}` 나오는지로 1차 확인 가능.

**서버는 이 절차를 실행한 컴퓨터(=프론트 담당자 컴퓨터)에서 뜨는 것이며, 이 창을 켜둔 동안만 살아있다.** 터미널을 닫으면 서버도 꺼진다.

## 4. Android에서 접근하는 baseUrl

| 실행 환경 | baseUrl | 비고 |
|---|---|---|
| **배포된 서버(추천)** | `http://1.201.116.115/api/v1/` | 어디서나 접속 가능, 로컬 서버 실행 불필요(위 0번 참고) |
| 안드로이드 에뮬레이터(로컬 서버) | `http://10.0.2.2:4000/api/v1/` | 에뮬레이터 입장에서 자기 컴퓨터를 가리키는 특수 주소 |
| 같은 Wi-Fi의 실기기(로컬 서버) | `http://<서버 컴퓨터의 LAN IP>:4000/api/v1/` | `ipconfig`(Windows)로 LAN IP 확인, 컴퓨터 방화벽에서 4000 포트 허용 필요 |

http(비HTTPS)라서 안드로이드 기본 정책상 그냥은 막힌다. `network_security_config.xml`에 실제 쓸 주소를 도메인 항목으로 추가 필요(안 쓰는 환경은 빼도 됨):

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">1.201.116.115</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

```xml
<!-- AndroidManifest.xml의 <application> 태그에 -->
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="true"
    ...>
```

`AndroidManifest.xml`에 `<uses-permission android:name="android.permission.INTERNET" />` 도 필요.

## 5. 데모 계정 (공통 비밀번호 `Passw0rd!2024`)

| 이메일 | 시나리오 |
|---|---|
| `demo@whsaftermate.app` | 정상 케이스 (관리이력/이용권 있음) |
| `demo2@whsaftermate.app` | 이용권 만료 임박 + 알러지/기저질환 있음 |
| `demo3@whsaftermate.app` | 이용권 전량 소진 (추천 계산 엣지 케이스) |
| `demo4@whsaftermate.app` | 신규 고객 — 관리 이력/이용권 전혀 없음 (`latestCare: null`, 일부 API `204` 응답 케이스 테스트용) |

## 6. 호출 예시 (Retrofit)

```kotlin
interface WhsApi {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("home/summary")
    suspend fun getHomeSummary(@Header("Authorization") token: String): HomeSummaryResponse
}

val retrofit = Retrofit.Builder()
    .baseUrl("http://1.201.116.115/api/v1/") // 배포된 서버(추천). 로컬 서버 쓸 땐 "http://10.0.2.2:4000/api/v1/"
    .addConverterFactory(GsonConverterFactory.create())
    .build()

val api = retrofit.create(WhsApi::class.java)
```

요청/응답 필드 구조는 엔드포인트별로 [`api-spec.md`](./api-spec.md)에 전부 정리되어 있음 — 데이터 클래스(`LoginRequest`, `HomeSummaryResponse` 등)는 그 문서의 JSON 예시를 그대로 옮기면 된다.

## 7. 자주 막히는 지점

- **`Connection refused`**: 서버가 안 떠 있거나(터미널 확인), baseUrl이 `localhost`로 되어 있음(에뮬레이터에선 `10.0.2.2`로 바꿔야 함)
- **`Cleartext HTTP traffic not permitted`**: 위 4번 `network_security_config` 설정 누락
- **401 Unauthorized**: 로그인 응답의 `accessToken`을 `Authorization: Bearer <token>` 헤더로 안 붙였거나 만료됨
- **실기기에서 접속 안 됨**: 컴퓨터와 폰이 같은 Wi-Fi인지, 컴퓨터 방화벽이 4000번 포트를 막고 있지 않은지 확인
