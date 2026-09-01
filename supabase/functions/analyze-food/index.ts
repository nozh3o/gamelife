// =============================================================================
// analyze-food — Edge Function для Supabase.
//
// Стоит между приложением и сервисом распознавания: ключ хранится здесь
// в секретах проекта и в браузер никогда не попадает.
//
// Секреты (Settings → Edge Functions → Secrets):
//   FOOD_API_URL    базовый адрес сервиса, например https://api.example.com/v1
//   FOOD_API_KEY    твой ключ
//   FOOD_API_FORMAT "anthropic" (по умолчанию) или "openai"
//   FOOD_MODEL      идентификатор модели, по умолчанию claude-opus-5
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Ты помогаешь вести дневник питания. На фотографии — еда.

Определи блюдо и оцени его пищевую ценность. Отвечай ТОЛЬКО одним объектом JSON,
без пояснений и без markdown-обёртки:

{
  "title": "название блюда по-русски",
  "grams": примерный вес порции в граммах (число),
  "kcal": калории во всей порции (число),
  "protein": белки в граммах во всей порции (число),
  "fat": жиры в граммах во всей порции (число),
  "carbs": углеводы в граммах во всей порции (число),
  "note": "короткое предупреждение, если оценка ненадёжна, иначе пустая строка"
}

Важно:
- Значения указывай для ВСЕЙ порции на фото, а не на 100 грамм.
- Учитывай масло и заправки, даже если их не видно напрямую.
- Если на фото несколько блюд, объедини их в одну запись и перечисли в названии.
- Если понять, что это за еда, невозможно, верни "title": "Не удалось распознать" и нули.
- В "note" честно предупреждай, когда размер порции или состав определить трудно.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Модель иногда оборачивает JSON в текст или ```-блок — достаём его аккуратно. */
function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("модель вернула не JSON");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "нужен POST" }, 405);

  // Функцию может вызывать только авторизованный пользователь этого проекта
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ error: "не авторизован" }, 401);
  }

  const apiUrl = Deno.env.get("FOOD_API_URL");
  const apiKey = Deno.env.get("FOOD_API_KEY");
  if (!apiUrl || !apiKey) {
    return jsonResponse({ error: "на сервере не заданы FOOD_API_URL или FOOD_API_KEY" }, 500);
  }
  const format = (Deno.env.get("FOOD_API_FORMAT") || "anthropic").toLowerCase();
  const model = Deno.env.get("FOOD_MODEL") || "claude-opus-5";

  let image: string;
  try {
    const body = await req.json();
    image = String(body.image || "");
    if (!image) throw new Error("нет изображения");
  } catch {
    return jsonResponse({ error: "ожидалось поле image с картинкой в base64" }, 400);
  }

  const base = apiUrl.replace(/\/+$/, "");
  let endpoint: string;
  let headers: Record<string, string>;
  let payload: unknown;

  if (format === "openai") {
    endpoint = `${base}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    payload = {
      model,
      max_tokens: 700,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
          { type: "text", text: PROMPT },
        ],
      }],
    };
  } else {
    endpoint = `${base}/messages`;
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    payload = {
      model,
      max_tokens: 700,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: PROMPT },
        ],
      }],
    };
  }

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return jsonResponse({ error: `сервис недоступен: ${(e as Error).message}` }, 502);
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    // наружу не отдаём тело ответа целиком — в нём могут быть служебные данные
    console.error("upstream error", upstream.status, raw.slice(0, 500));
    return jsonResponse({ error: `сервис распознавания ответил ${upstream.status}` }, 502);
  }

  let text = "";
  try {
    const data = JSON.parse(raw);
    text = format === "openai"
      ? (data.choices?.[0]?.message?.content ?? "")
      : (data.content ?? []).filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text).join("\n");
  } catch {
    return jsonResponse({ error: "не удалось разобрать ответ сервиса" }, 502);
  }

  try {
    const parsed = extractJson(text);
    return jsonResponse({
      title: parsed.title ?? "Блюдо",
      grams: Number(parsed.grams) || 100,
      kcal: Number(parsed.kcal) || 0,
      protein: Number(parsed.protein) || 0,
      fat: Number(parsed.fat) || 0,
      carbs: Number(parsed.carbs) || 0,
      note: parsed.note ?? "",
    });
  } catch (e) {
    console.error("parse error", text.slice(0, 500));
    return jsonResponse({ error: (e as Error).message }, 502);
  }
});
