// =============================================================================
// analyze-food — Edge Function для Supabase.
//
// Стоит между приложением и сервисом распознавания: ключ хранится здесь
// в секретах проекта и в браузер никогда не попадает.
//
// Два режима, оба через POST:
//   { "image": "<base64>" }            — оценка КБЖУ по фотографии еды
//   { "text": "фраза", "context": "" } — разбор фразы быстрого ввода
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

const TEXT_PROMPT = `Ты разбираешь короткую фразу из личного трекера и превращаешь её
в готовые записи. Отвечай ТОЛЬКО одним объектом JSON, без пояснений и без markdown:

{ "actions": [ ... ] }

Элементом массива может быть:
{ "kind": "expense" | "income", "amount": число, "category": "строка", "account": "строка или пусто", "note": "строка" }
{ "kind": "meal", "items": [ { "title": "", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число } ] }
{ "kind": "workout", "exercises": [ { "name": "", "sets": [ { "weight": число в кг, "reps": число } ] } ] }
{ "kind": "todo", "title": "", "date": "ГГГГ-ММ-ДД" }
{ "kind": "journal", "mood": 1..5, "text": "" }

Важно:
- Это часто голосовая диктовка, а не аккуратно составленный текст — расшифровка может быть
  разговорной, без знаков препинания, с оговорками и словами-паразитами. Понимай смысл фразы
  целиком, а не отдельные ключевые слова: «мне на каспи скинули пять тысяч» — это доход 5000
  на счёт «Каспи»; «закинул на кредитку косарь» — это доход 1000 на кредитную карту;
  «слетело с карты за такси двести» — это расход 200 с карты на такси.
- Во фразе может быть сразу несколько дел — тогда в массиве несколько элементов. Если называют
  подряд НЕСКОЛЬКО дел одного рода — например список задач или покупок — заведи отдельный
  элемент массива на каждое, не сливай их в один текст через запятую.
- "account" в expense/income заполняй, только если в фразе явно назван счёт (например
  «на каспи», «с кредитки», «наличными») — сверяй с списком «Счета пользователя» в контексте
  и бери название максимально близкое к тому, что там есть; иначе оставляй "account" пустым.
- Направление денег определяй по смыслу, а не по одному слову: «пополнили», «закинули»,
  «пришло», «перевели мне» — доход; «потратил», «оплатил», «списали», «улетело» — расход.
- КБЖУ считай на всю порцию, а не на 100 грамм; вес порции оценивай по еде.
- Категорию бери из списка в контексте, а если ничего не подходит — "Прочее".
- Вес в подходах — в килограммах; для упражнений с своим весом ставь 0.
- Если фраза непонятна, верни { "actions": [] } и ничего не выдумывай.`

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

  let image = "";
  let text = "";
  let context = "";
  try {
    const body = await req.json();
    image = String(body.image || "");
    text = String(body.text || "").slice(0, 600);
    context = String(body.context || "").slice(0, 600);
    if (!image && !text) throw new Error("нечего разбирать");
  } catch {
    return jsonResponse({ error: "ожидалось поле image с картинкой в base64 или text с фразой" }, 400);
  }
  const isText = !image;
  const textPrompt = `${TEXT_PROMPT}

${context}

Фраза: ${text}`;

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
      max_tokens: isText ? 1000 : 700,
      messages: [{
        role: "user",
        content: isText
          ? [{ type: "text", text: textPrompt }]
          : [
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
      max_tokens: isText ? 1000 : 700,
      messages: [{
        role: "user",
        content: isText
          ? [{ type: "text", text: textPrompt }]
          : [
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

  let answer = "";
  try {
    const data = JSON.parse(raw);
    answer = format === "openai"
      ? (data.choices?.[0]?.message?.content ?? "")
      : (data.content ?? []).filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text).join("\n");
  } catch {
    return jsonResponse({ error: "не удалось разобрать ответ сервиса" }, 502);
  }

  try {
    const parsed = extractJson(answer);
    if (isText) {
      return jsonResponse({ actions: Array.isArray(parsed.actions) ? parsed.actions : [] });
    }
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
    console.error("parse error", answer.slice(0, 500));
    return jsonResponse({ error: (e as Error).message }, 502);
  }
});
