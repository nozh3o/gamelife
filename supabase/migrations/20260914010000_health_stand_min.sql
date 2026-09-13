-- Приём здоровья по факту того, что Команды реально отдают.
--
-- Две правки, обе вскрылись на сборке автоматизации.
--
-- 1. Часов стоя в Health нет. Кольцо «Стоя» считает часы, в которых человек
--    хоть раз встал, а наружу HealthKit отдаёт только Stand Minutes —
--    суммарные минуты стоя. Одно из другого не выводится, поэтому колонка
--    называется stand_min и хранит минуты. stand_hours остаётся на случай,
--    если источник часов когда-нибудь появится, но никем не пишется.
--
-- 2. Числа приезжают из Команд текстом в локальном формате: «612,5» с
--    запятой, «7 430» с неразрывным пробелом, иногда «7,430.5». Прямое
--    приведение ::numeric на таком падало бы с ошибкой, и весь суточный
--    срез терялся бы целиком из-за одного поля. gamelife_num разбирает
--    все три формы и возвращает null на том, чего не понял, — потерять
--    одно поле лучше, чем весь день.

alter table public.health_days add column if not exists stand_min numeric;

create or replace function public.gamelife_num(t text)
returns numeric
language plpgsql
immutable
as $function$
declare
  s text;
begin
  -- пробелы любой природы: обычный, неразрывный, узкий неразрывный
  s := regexp_replace(coalesce(t, ''), '[\s  ]', '', 'g');
  if s = '' then
    return null;
  end if;

  if position(',' in s) > 0 and position('.' in s) > 0 then
    -- есть и то и другое: запятая — разделитель тысяч
    s := replace(s, ',', '');
  else
    -- только запятая: она десятичная
    s := replace(s, ',', '.');
  end if;

  s := regexp_replace(s, '[^0-9.\-]', '', 'g');
  if s !~ '^-?[0-9]*\.?[0-9]+$' then
    return null;
  end if;

  return s::numeric;
end;
$function$;

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

  v_date := coalesce(nullif(p_payload->>'date', ''),
                     to_char(now() at time zone 'Etc/GMT-5', 'YYYY-MM-DD'));

  -- минуты стоя и минуты тренировки не появляются без часов на руке;
  -- шаги пишет айфон в кармане и мерилом ношения быть не могут
  v_worn := public.gamelife_num(p_payload->>'stand_min') is not null
         or public.gamelife_num(p_payload->>'exercise_min') is not null;

  insert into public.health_days as h (
    user_id, date,
    active_kcal, exercise_min, stand_min, steps,
    resting_hr, hr_max, hr_workout_avg, sleep_min, weight,
    watch_worn, updated_at
  ) values (
    v_user_id, v_date,
    public.gamelife_num(p_payload->>'active_kcal'),
    public.gamelife_num(p_payload->>'exercise_min'),
    public.gamelife_num(p_payload->>'stand_min'),
    public.gamelife_num(p_payload->>'steps'),
    public.gamelife_num(p_payload->>'resting_hr'),
    public.gamelife_num(p_payload->>'hr_max'),
    public.gamelife_num(p_payload->>'hr_workout_avg'),
    public.gamelife_num(p_payload->>'sleep_min'),
    public.gamelife_num(p_payload->>'weight'),
    v_worn, now()
  )
  on conflict (user_id, date) do update set
    active_kcal    = coalesce(excluded.active_kcal,    h.active_kcal),
    exercise_min   = coalesce(excluded.exercise_min,   h.exercise_min),
    stand_min      = coalesce(excluded.stand_min,      h.stand_min),
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

grant execute on function public.gamelife_num(text) to anon;
grant execute on function public.gamelife_health_ingest(text, jsonb) to anon;
