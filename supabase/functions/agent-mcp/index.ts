// =============================================================================
// agent-mcp — маленький MCP-сервер для записи в приложение One прямо
// из переписки с Клодом (custom connector).
//
// Личный токен приходит в самом адресе подключения:
//   https://ТВОЙ-ПРОЕКТ.supabase.co/functions/v1/agent-mcp/<личный-токен>
// (токен выдаётся в Настройках приложения → Синхронизация → «Запись из Клода»)
//
// Эта функция ничего не знает о том, чей это токен и что можно писать —
// вся проверка токена и сама запись происходят внутри Postgres-функции
// gamelife_agent_add (SQL — там же, в Настройках, кнопка «Скопировать код»).
// Функция здесь — только переводчик протокола MCP в вызов этой функции.
//
// ВАЖНО при создании функции в Supabase (Edge Functions → Deploy a new
// function): выключить переключатель "Verify JWT". Иначе платформа будет
// требовать настоящий Supabase-JWT ещё до того, как код функции вообще
// запустится — а у Клода такого JWT нет и быть не может.
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// эти переменные Supabase подставляет в каждую Edge Function сама,
// вручную ничего прописывать не нужно
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TOOLS = [
  {
    name: "add_transaction",
    description: "Добавить трату или доход в приложение One (вкладка «Финансы»).",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Сумма, положительное число" },
        type: { type: "string", enum: ["expense", "income"], description: "Расход или доход" },
        category: { type: "string", description: "Категория, например «Еда», «Транспорт», «Развлечения»" },
        note: { type: "string", description: "Комментарий, необязательно" },
        date: { type: "string", description: "Дата в формате YYYY-MM-DD, по умолчанию сегодня" },
        account: { type: "string", description: "Название счёта, если их несколько; по умолчанию основной" },
      },
      required: ["amount", "type"],
    },
  },
  {
    name: "add_workout",
    description: "Записать тренировку в приложение One (вкладка «Тренировки»): упражнения, подходы, вес и повторы.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Название тренировки, например «Верх тела»" },
        date: { type: "string", description: "Дата YYYY-MM-DD, по умолчанию сегодня" },
        note: { type: "string", description: "Заметка, необязательно" },
        exercises: {
          type: "array",
          description: "Список упражнений",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Название упражнения" },
              sets: {
                type: "array",
                description: "Подходы",
                items: {
                  type: "object",
                  properties: {
                    weight: { type: "number", description: "Вес в кг, 0 или не указывать, если без веса" },
                    reps: { type: "number", description: "Число повторов" },
                  },
                  required: ["reps"],
                },
              },
            },
            required: ["name", "sets"],
          },
        },
      },
      required: ["title", "exercises"],
    },
  },
  {
    name: "add_meal",
    description: "Добавить приём пищи в дневник питания приложения One (КБЖУ).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Название блюда" },
        grams: { type: "number", description: "Примерный вес порции в граммах" },
        kcal: { type: "number", description: "Калории во всей порции" },
        protein: { type: "number", description: "Белки в граммах" },
        fat: { type: "number", description: "Жиры в граммах" },
        carbs: { type: "number", description: "Углеводы в граммах" },
        time: { type: "string", description: "Время ЧЧ:ММ, необязательно" },
      },
      required: ["title", "kcal"],
    },
  },
  {
    name: "add_task",
    description: "Добавить задачу на день в приложение One (вкладка «Задачи»).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Что нужно сделать" },
        date: { type: "string", description: "Дата YYYY-MM-DD, по умолчанию сегодня" },
        note: { type: "string", description: "Заметка, необязательно" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_journal_entry",
    description: "Сделать запись в дневник дня приложения One: настроение, победы, благодарности, текст. Если запись на этот день уже есть — дополняет её.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Дата YYYY-MM-DD, по умолчанию сегодня" },
        mood: { type: "number", description: "Настроение от 1 (плохо) до 5 (отлично)" },
        text: { type: "string", description: "Свободный текст о дне" },
        wins: { type: "array", items: { type: "string" }, description: "Список побед за день" },
        gratitude: { type: "array", items: { type: "string" }, description: "За что благодарен сегодня" },
      },
    },
  },
  {
    name: "add_goal",
    description: "Создать цель в приложении One. Если указано число (target) — цель числовая (копить прогресс), иначе простая (сделано/не сделано).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Название цели" },
        note: { type: "string", description: "Зачем эта цель, необязательно" },
        target: { type: "number", description: "Числовая цель, например 500000 — необязательно" },
        unit: { type: "string", description: "Единица измерения: ₸, км, книг — вместе с target" },
        moneyReward: { type: "number", description: "Денежная награда за достижение, необязательно" },
        deadline: { type: "string", description: "Дедлайн YYYY-MM-DD, необязательно" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_wish",
    description: "Добавить желание в карту желаний приложения One.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Что хочется" },
        note: { type: "string", description: "Зачем это, необязательно" },
      },
      required: ["title"],
    },
  },
  {
    name: "log_habit",
    description: "Отметить привычку в приложении One по названию — привычка должна уже существовать в приложении.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Точное или похожее название привычки, как она называется в приложении" },
        direction: { type: "string", enum: ["up", "down"], description: "up — сделал (по умолчанию), down — сорвался" },
      },
      required: ["name"],
    },
  },
  {
    name: "complete_daily",
    description: "Отметить ежедневку выполненной на сегодня в приложении One по названию — ежедневка должна уже существовать в приложении.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Точное или похожее название ежедневки, как она называется в приложении" },
      },
      required: ["name"],
    },
  },
];

const TOOL_KIND: Record<string, string> = {
  add_transaction: "transaction",
  add_workout: "workout",
  add_meal: "meal",
  add_task: "task",
  add_journal_entry: "journal",
  add_goal: "goal",
  add_wish: "wish",
  log_habit: "habit_log",
  complete_daily: "daily_done",
};

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function callAgentAdd(token: string, kind: string, payload: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/gamelife_agent_add`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_kind: kind, p_payload: payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.includes("invalid token")
      ? "неверный или отозванный личный токен"
      : `не удалось сохранить (сервер ответил ${res.status})`);
  }
}

function toolResultText(name: string, args: Record<string, unknown>) {
  if (name === "add_transaction") {
    return `${args.type === "income" ? "Доход" : "Расход"} ${args.amount}${args.category ? " · " + args.category : ""}`;
  }
  if (name === "add_workout") return `Тренировка «${args.title}»`;
  if (name === "add_meal") return `Приём пищи «${args.title}»`;
  if (name === "add_task") return `Задача «${args.title}»`;
  if (name === "add_journal_entry") return `Запись в дневнике`;
  if (name === "add_goal") return `Цель «${args.title}»`;
  if (name === "add_wish") return `Желание «${args.title}»`;
  if (name === "log_habit") return `Привычка «${args.name}»`;
  if (name === "complete_daily") return `Ежедневка «${args.name}»`;
  return String(args.title || args.name || "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return respond({ error: "нужен POST" }, 405);
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const token = last === "agent-mcp" ? "" : last;

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return respond(rpcError(null, -32700, "parse error"), 400);
  }
  if (!body || typeof body !== "object") {
    return respond(rpcError(null, -32700, "parse error"), 400);
  }

  const { id, method, params } = body as {
    id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> };
  };

  // уведомления (без ответа) — просто подтверждаем приём
  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 202, headers: CORS });
  }

  if (method === "initialize") {
    return respond(rpcResult(id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "one-agent", version: "1.0.0" },
    }));
  }

  if (method === "tools/list") {
    return respond(rpcResult(id, { tools: TOOLS }));
  }

  if (method === "tools/call") {
    const name = params?.name || "";
    const args = params?.arguments || {};
    const kind = TOOL_KIND[name];

    if (!kind) {
      return respond(rpcResult(id, {
        content: [{ type: "text", text: `Неизвестный инструмент: ${name}` }],
        isError: true,
      }));
    }
    if (!token) {
      return respond(rpcResult(id, {
        content: [{ type: "text", text: "В адресе подключения нет личного токена — пересоздай коннектор с полной ссылкой из Настроек приложения." }],
        isError: true,
      }));
    }
    try {
      await callAgentAdd(token, kind, args);
      return respond(rpcResult(id, {
        content: [{
          type: "text",
          text: `Готово — добавлено в One: ${toolResultText(name, args)}. Появится в приложении при следующей синхронизации (обычно в течение минуты).`,
        }],
      }));
    } catch (e) {
      return respond(rpcResult(id, {
        content: [{ type: "text", text: `Не получилось: ${(e as Error).message}` }],
        isError: true,
      }));
    }
  }

  return respond(rpcError(id, -32601, `метод не поддерживается: ${method}`));
});
