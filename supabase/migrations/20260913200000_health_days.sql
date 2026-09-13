-- Данные Apple Health для ассистента: своя таблица и приём из «Команд».
--
-- Почему отдельная таблица, а не состояние приложения: всё состояние One
-- лежит одним jsonb в gamelife_saves.data, и приложение переписывает его
-- целиком при каждом сохранении. Любая запись туда мимо очереди либо будет
-- затёрта синхронизацией, либо затрёт состояние. Здоровье живёт отдельно,
-- приложение о нём не знает — и сломать его этим нечем.
--
-- Айфон ходит в gamelife_health_ingest напрямую по REST, минуя agent-mcp:
-- код, который каждый день пишет задачи и еду, эта миграция не трогает.

create table if not exists public.health_days (
  user_id        uuid        not null,
  date           text        not null,
  active_kcal    numeric,
  exercise_min   numeric,
  stand_hours    numeric,
  steps          numeric,
  resting_hr     numeric,
  hr_max         numeric,
  hr_workout_avg numeric,
  sleep_min      numeric,
  weight         numeric,
  watch_worn     boolean     not null default false,
  updated_at     timestamptz not null default now(),
  primary key (user_id, date)
);

-- Политик нет намеренно: в таблицу ходят только функции с security definer,
-- как и в остальной агентской части. RLS включён, чтобы анонимная роль
-- не могла читать таблицу напрямую через REST.
alter table public.health_days enable row level security;

-- Приём суточного среза из «Команд».
--
-- Проверка токена — зеркало gamelife_agent_read: sha256 от токена, поиск
-- в agent_tokens, отметка last_used_at. Доступ не расширяется: тот же токен,
-- что уже есть у коннектора.
--
-- Поля, которых в payload нет, при повторной отправке НЕ обнуляются:
-- утренний запуск досылает сон и уточнённые цифры и не должен стирать то,
-- что вечерний уже записал.
--
-- watch_worn считается здесь, а не присылается: часы стоя и минуты
-- тренировки физически не появляются без часов на руке, а шаги пишет айфон
-- в кармане и мерилом ношения быть не могут. Признак нужен, чтобы день без
-- часов не выглядел в базе днём полного бездействия — иначе через месяц
-- любой вывод о динамике будет сделан из дырок в данных.
create or replace function public.gamelife_health_ingest(
  p_token   text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_user_id uuid;
  v_hash    text;
  v_date    text;
  v_worn    boolean;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select user_id into v_user_id from public.agent_tokens where token_hash = v_hash;
  if v_user_id is null then
    raise exception 'invalid token';
  end if;

  update public.agent_tokens set last_used_at = now() where token_hash = v_hash;

  -- дата не передана = сегодня глазами человека, а не сервера
  v_date := coalesce(nullif(p_payload->>'date', ''),
                     to_char(now() at time zone 'Etc/GMT-5', 'YYYY-MM-DD'));

  v_worn := nullif(p_payload->>'stand_hours', '') is not null
         or nullif(p_payload->>'exercise_min', '') is not null;

  insert into public.health_days as h (
    user_id, date,
    active_kcal, exercise_min, stand_hours, steps,
    resting_hr, hr_max, hr_workout_avg, sleep_min, weight,
    watch_worn, updated_at
  ) values (
    v_user_id, v_date,
    nullif(p_payload->>'active_kcal', '')::numeric,
    nullif(p_payload->>'exercise_min', '')::numeric,
    nullif(p_payload->>'stand_hours', '')::numeric,
    nullif(p_payload->>'steps', '')::numeric,
    nullif(p_payload->>'resting_hr', '')::numeric,
    nullif(p_payload->>'hr_max', '')::numeric,
    nullif(p_payload->>'hr_workout_avg', '')::numeric,
    nullif(p_payload->>'sleep_min', '')::numeric,
    nullif(p_payload->>'weight', '')::numeric,
    v_worn, now()
  )
  on conflict (user_id, date) do update set
    active_kcal    = coalesce(excluded.active_kcal,    h.active_kcal),
    exercise_min   = coalesce(excluded.exercise_min,   h.exercise_min),
    stand_hours    = coalesce(excluded.stand_hours,    h.stand_hours),
    steps          = coalesce(excluded.steps,          h.steps),
    resting_hr     = coalesce(excluded.resting_hr,     h.resting_hr),
    hr_max         = coalesce(excluded.hr_max,         h.hr_max),
    hr_workout_avg = coalesce(excluded.hr_workout_avg, h.hr_workout_avg),
    sleep_min      = coalesce(excluded.sleep_min,      h.sleep_min),
    weight         = coalesce(excluded.weight,         h.weight),
    watch_worn     = h.watch_worn or excluded.watch_worn,
    updated_at     = now();

  return jsonb_build_object('ok', true, 'date', v_date, 'watchWorn', v_worn);
end;
$function$;

-- Вызывать может анонимная роль, но только предъявив валидный токен —
-- проверка внутри функции.
grant execute on function public.gamelife_health_ingest(text, jsonb) to anon;
