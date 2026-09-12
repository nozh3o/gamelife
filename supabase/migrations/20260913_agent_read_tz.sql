-- Даты в чтении считаются по времени Райымбека (UTC+5), а не по UTC.
--
-- Функции жили на now() без часового пояса, то есть на UTC. С полуночи до
-- пяти утра по местному «сегодня» у базы — это ещё вчера: замер или задача,
-- поставленные ночью, в срез по умолчанию не попадали, а get_day молча
-- показывал вчерашний день. Приложение всё это время считало дату локально,
-- поэтому расходились не только ответы ассистента, но и ответы ассистента
-- с экраном.
--
-- Etc/GMT-5 — это ровно UTC+5 без перехода на летнее время (знак в названии
-- зоны обратный, так устроен стандарт). Казахстан на постоянном +5, так что
-- фиксированное смещение здесь честнее именованной зоны: оно не поедет,
-- если правила зоны когда-нибудь поменяют.
--
-- Что изменилось против 20260910: срез дня отдавал из замера только вес, талию
-- и плечи, поэтому шея, грудь и бицепс, появившиеся в приложении 13.09, до
-- ассистента не доезжали, а процент жира он не мог посчитать вовсе — рост
-- лежит в профиле, то есть в другом запросе. Теперь замер отдаётся целиком
-- и с уже посчитанными показателями, плюс появился отдельный срез
-- «measurements» — история замеров за период, чтобы смотреть динамику
-- одним запросом, а не выкачивать состояние целиком.
--
-- Зеркало gamelife_agent_add: тот же способ проверки токена, тот же
-- SECURITY DEFINER. Доступ не расширяется — токен и раньше позволял писать
-- в профиль, теперь позволяет и прочитать его. Ничего существующего функция
-- не трогает: только SELECT.
--
-- Отдаём не весь state (18 kB на каждый вопрос — расточительно), а срез
-- под конкретный вопрос: день, приёмы за период, профиль, задачи.

create or replace function public.gamelife_agent_read(
  p_token text,
  p_what  text,
  p_from  text default null,
  p_to    text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_user_id uuid;
  v_hash    text;
  v_data    jsonb;
  v_from    text;
  v_to      text;
  v_result  jsonb;
  -- «сегодня» глазами человека, а не сервера
  v_today   text := to_char(now() at time zone 'Etc/GMT-5', 'YYYY-MM-DD');
  -- пол и рост решают, что вообще можно посчитать из обхватов, а лежат они
  -- в профиле питания — достаём один раз, дальше нужны всем срезам с замерами
  v_sex     text;
  v_height  numeric;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select user_id into v_user_id from public.agent_tokens where token_hash = v_hash;
  if v_user_id is null then
    raise exception 'invalid token';
  end if;

  update public.agent_tokens set last_used_at = now() where token_hash = v_hash;

  select data into v_data from public.gamelife_saves where user_id = v_user_id;
  if v_data is null then
    return jsonb_build_object('empty', true);
  end if;

  v_sex    := coalesce(v_data->'nutrition'->'profile'->>'sex', 'male');
  v_height := nullif(v_data->'nutrition'->'profile'->>'height', '')::numeric;

  -- пустой период = сегодня; одна дата без второй = один день
  v_from := coalesce(nullif(p_from, ''), v_today);
  v_to   := coalesce(nullif(p_to, ''), v_from);

  if p_what = 'meals' then
    v_result := jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'meals', coalesce((
        select jsonb_agg(e order by e->>'date', e->>'time')
        from jsonb_array_elements(coalesce(v_data->'nutrition'->'entries', '[]'::jsonb)) e
        where e->>'date' between v_from and v_to
      ), '[]'::jsonb)
    );

  elsif p_what = 'day' then
    v_result := jsonb_build_object(
      'date', v_from,
      'meals', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'title', e->>'title', 'grams', e->'grams', 'time', e->>'time',
                 'kcal', e->'kcal', 'protein', e->'protein', 'fat', e->'fat', 'carbs', e->'carbs')
               order by e->>'time')
        from jsonb_array_elements(coalesce(v_data->'nutrition'->'entries', '[]'::jsonb)) e
        where e->>'date' = v_from
      ), '[]'::jsonb),
      'totals', coalesce((
        select jsonb_build_object(
                 'kcal',    round(sum((e->>'kcal')::numeric)),
                 'protein', round(sum((e->>'protein')::numeric)),
                 'fat',     round(sum((e->>'fat')::numeric)),
                 'carbs',   round(sum((e->>'carbs')::numeric)))
        from jsonb_array_elements(coalesce(v_data->'nutrition'->'entries', '[]'::jsonb)) e
        where e->>'date' = v_from
      ), jsonb_build_object('kcal', 0, 'protein', 0, 'fat', 0, 'carbs', 0)),
      'targets', coalesce(v_data->'nutrition'->'targets', '{}'::jsonb),
      'workouts', coalesce((
        select jsonb_agg(jsonb_build_object('title', w->>'title', 'note', w->>'note'))
        from jsonb_array_elements(coalesce(v_data->'workouts', '[]'::jsonb)) w
        where w->>'date' = v_from
      ), '[]'::jsonb),
      'sleep', (
        select jsonb_build_object('durationMin', sl->'durationMin', 'score', sl->'score')
        from jsonb_array_elements(coalesce(v_data->'sleep'->'entries', '[]'::jsonb)) sl
        where sl->>'date' = v_from limit 1
      ),
      'measurement', (
        select (b - 'id' - 'createdAt') || public.gamelife_body_metrics(b, v_sex, v_height)
        from jsonb_array_elements(coalesce(v_data->'body'->'entries', '[]'::jsonb)) b
        where b->>'date' = v_from limit 1
      ),
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object('title', t->>'title', 'done', t->'done'))
        from jsonb_array_elements(coalesce(v_data->'todos', '[]'::jsonb)) t
        where t->>'date' = v_from
      ), '[]'::jsonb)
    );

  elsif p_what = 'profile' then
    v_result := jsonb_build_object(
      'profile', coalesce(v_data->'nutrition'->'profile', '{}'::jsonb),
      'targets', coalesce(v_data->'nutrition'->'targets', '{}'::jsonb),
      -- последний замер: сортируем по дате убыв., берём первый
      'lastMeasurement', (
        select (b - 'id' - 'createdAt') || public.gamelife_body_metrics(b, v_sex, v_height)
        from jsonb_array_elements(coalesce(v_data->'body'->'entries', '[]'::jsonb)) b
        order by b->>'date' desc limit 1
      ),
      'measureEveryDays', coalesce(v_data->'body'->'settings'->'everyDays', to_jsonb(0)),
      'accounts', coalesce((
        select jsonb_agg(jsonb_build_object('name', a->>'name', 'balance', a->'balance'))
        from jsonb_array_elements(coalesce(v_data->'finance'->'accounts', '[]'::jsonb)) a
      ), '[]'::jsonb)
    );

  elsif p_what = 'tasks' then
    v_result := jsonb_build_object(
      'today', v_today,
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object('title', t->>'title', 'date', t->>'date', 'done', t->'done')
               order by t->>'date')
        from jsonb_array_elements(coalesce(v_data->'todos', '[]'::jsonb)) t
        where coalesce((t->>'done')::boolean, false) = false
          and coalesce(t->>'date', '') <= v_today
      ), '[]'::jsonb)
    );

  elsif p_what = 'measurements' then
    -- у истории замеров умолчание своё: мерят раз в неделю-две, и «сегодня»
    -- вернуло бы пустой список почти всегда. Полгода — это 15-25 точек,
    -- достаточно, чтобы увидеть тренд, и не настолько много, чтобы платить
    -- за это размером ответа
    if coalesce(p_from, '') = '' then
      v_from := to_char((now() at time zone 'Etc/GMT-5') - interval '180 days', 'YYYY-MM-DD');
      v_to   := coalesce(nullif(p_to, ''), v_today);
    end if;

    v_result := jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'sex', v_sex,
      'height', v_height,
      'measurements', coalesce((
        select jsonb_agg((b - 'id' - 'createdAt') || public.gamelife_body_metrics(b, v_sex, v_height)
               order by b->>'date')
        from jsonb_array_elements(coalesce(v_data->'body'->'entries', '[]'::jsonb)) b
        where b->>'date' between v_from and v_to
      ), '[]'::jsonb)
    );

  else
    raise exception 'unknown read kind: %', p_what;
  end if;

  return v_result;
end;
$function$;

-- Вызывать функцию может только сам сервис коннектора (анонимная роль),
-- и только предъявив валидный токен — проверка внутри.
grant execute on function public.gamelife_agent_read(text, text, text, text) to anon;
