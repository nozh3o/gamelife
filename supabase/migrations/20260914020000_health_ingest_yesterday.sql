-- Приём здоровья понимает слова today и yesterday в поле date.
--
-- Что изменилось против 20260914010000: дата разбирается, а не берётся
-- как есть. Утренняя команда шлёт срез за вчера, и вычислять дату на
-- телефоне пришлось бы через «Adjust Date» и «Format Date» — три действия,
-- в которых легко промахнуться форматом и молча записать данные не в тот
-- день. Слово yesterday решает это на сервере, где часовой пояс уже известен.
--
-- Строка, не похожая на дату и не равная одному из двух слов, теперь
-- отвергается явно. Раньше она доехала бы до insert и упала там с невнятной
-- ошибкой приведения типа.

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

  -- дата может прийти тремя способами: явным YYYY-MM-DD, словом today
  -- или yesterday, либо не прийти вовсе. Слова нужны утренней команде:
  -- вычислять вчерашнюю дату в «Командах» — это три лишних действия
  -- с форматированием, а промах в формате тихо запишет данные не в тот день.
  v_date := nullif(lower(trim(coalesce(p_payload->>'date', ''))), '');

  if v_date is null or v_date = 'today' then
    v_date := to_char(now() at time zone 'Etc/GMT-5', 'YYYY-MM-DD');
  elsif v_date = 'yesterday' then
    v_date := to_char((now() at time zone 'Etc/GMT-5') - interval '1 day', 'YYYY-MM-DD');
  elsif v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'bad date: %', v_date;
  end if;

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

grant execute on function public.gamelife_health_ingest(text, jsonb) to anon;
