// 영수증 읽기 Edge Function
// 앱에서 보낸 영수증 사진을 Claude가 읽어서 날짜, 사용처, 금액, 부서, 결제수단을 돌려줘요.
// 필요한 비밀값: ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets 에 등록)
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.4";

const MODEL = "claude-opus-5-5"; // 비용을 줄이려면 "claude-haiku-5-5" 로 바꾸세요

const DEPTS = {
  food: "식품(장보기): 마트, 시장, 식재료",
  dine: "외식/배달: 식당, 카페, 배달앱, 간식",
  baby: "육아용품: 기저귀, 분유, 아기 옷, 장난감",
  choa: "초아비용: 강아지 사료, 간식, 동물병원, 펫용품",
  home: "생필품: 세제, 휴지, 주방/욕실 용품, 다이소",
  car: "교통: 주유, 주차, 톨비, 택시, 대중교통",
  med: "의료/약국: 병원, 약국",
  self: "의류/미용/운동: 옷, 미용실, 화장품, 헬스",
  gift: "경조사/선물: 선물, 축의금, 꽃",
  etc: "예비비용: 위에 해당하지 않는 것",
} as const;
const METHODS = ["하나카드", "토스뱅크", "우리은행", "기업은행"];

const Receipt = z.object({
  is_receipt: z.boolean(),
  date: z.string().nullable(),
  place: z.string(),
  amount: z.number().int(),
  category: z.enum(Object.keys(DEPTS) as [keyof typeof DEPTS, ...(keyof typeof DEPTS)[]]),
  method: z.string().nullable(),
  memo: z.string(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// 사원 명부(members)에 있는 로그인 사용자만 쓸 수 있게 확인
async function isMember(req: Request): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const auth = req.headers.get("authorization");
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !auth) return false;
  const r = await fetch(`${url}/rest/v1/members?select=email`, { headers: { apikey, Authorization: auth } });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await isMember(req))) return json({ error: "not_member" }, 401);

  let body: { image?: string; media_type?: string; today?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const image = body.image ?? "";
  const media = body.media_type === "image/png" ? "image/png" : "image/jpeg";
  if (!image || image.length > 7_000_000) return json({ error: "bad_image" }, 400);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10);

  const instructions = `한국 가계부 앱에 입력할 영수증(또는 카드 청구서, 결제 화면 캡처)입니다. 사진을 읽고 아래 항목을 채워주세요.

- is_receipt: 영수증/결제 내역 사진이면 true, 아니면 false
- date: 결제 날짜 YYYY-MM-DD. 연도가 안 보이면 오늘(${today}) 기준으로 가장 가까운 과거 날짜. 날짜가 전혀 없으면 null
- place: 상호명 (지점명은 짧게 포함 가능, 예: "하나로마트 광양점"). 사업자번호, 주소는 빼기
- amount: 실제 결제된 최종 합계 금액 (원, 정수). 할인 후, 부가세 포함 최종 금액. "받을금액", "결제금액", "합계" 중 실제 결제액
- category: 아래 중 가장 알맞은 하나의 id
${Object.entries(DEPTS).map(([k, v]) => `  - ${k}: ${v}`).join("\n")}
- method: 결제수단이 보이면 다음 중 하나로: ${METHODS.join(", ")} (하나카드/하나은행 카드 → 하나카드, 토스 → 토스뱅크, 우리카드/우리은행 → 우리은행, IBK/기업 → 기업은행). 그 밖의 카드나 현금이면 그 이름 그대로 (예: "현금", "신한카드"). 안 보이면 null
- memo: 대표 품목을 짧게 (예: "기저귀, 물티슈 외 3개"). 없으면 빈 문자열`;

  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Receipt) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media, data: image } },
            { type: "text", text: instructions },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const out = response.parsed_output;
    if (!out) return json({ error: "parse_failed" }, 502);
    if (!out.is_receipt) return json({ error: "not_receipt" }, 422);
    return json({ ...out, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "api_key" }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.BadRequestError) return json({ error: "bad_request", detail: e.message }, 400);
    if (e instanceof Anthropic.APIError) return json({ error: "api_error", status: e.status }, 502);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
