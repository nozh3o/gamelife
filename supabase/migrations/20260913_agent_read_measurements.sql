-- Замеры для ассистента: полный набор обхватов и посчитанные показатели.
--
-- Две части: функция расчёта показателей из обхватов и пересозданная
-- gamelife_agent_read, которая теперь эти показатели отдаёт.

-- Показатели, которые считаются из обхватов. Живут в базе, а не в ассистенте,
-- по той же причине, по которой они посчитаны в приложении: формула должна быть
-- одна. Если ассистент будет считать процент жира сам, его число рано или
-- поздно разойдётся с тем, что человек видит на экране, и доверять перестанут
-- обоим.
--
-- V-taper (плечи ÷ талия) осмыслен у мужчин: он растёт, когда талия уходит,
-- а плечи держатся. У женщин плечи почти не меняются, и отношение мёртвое —
-- там считается талия ÷ бёдра, которое, наоборот, должно падать.
--
-- Процент жира — формула US Navy, мужской и женский варианты. Это оценка
-- с погрешностью в несколько процентов, а не измерение: значение имеет
-- направление от замера к замеру. Границы 0-70 отсекают не тело, а кривой
-- ввод: на бессмысленных обхватах формула выдаёт бессмысленное число,
-- и лучше не вернуть ничего, чем вернуть его.
create or replace function public.gamelife_body_metrics(
  b        jsonb,
  p_sex    text,
  p_height numeric
)
returns jsonb
language sql
immutable
as $function$
  with v as (
    select nullif(b->>'waist', '')::numeric     as waist,
           nullif(b->>'neck', '')::numeric      as neck,
           nullif(b->>'hips', '')::numeric      as hips,
           nullif(b->>'shoulders', '')::numeric as shoulders
  ),
  calc as (
    select waist, neck, hips, shoulders,
      case
        when p_height is null or p_height <= 0 then null
        when waist is null or neck is null or waist <= neck then null
        when p_sex = 'female' then
          case when hips is null then null else
            495 / (1.29579 - 0.35004 * log(waist + hips - neck) + 0.22100 * log(p_height)) - 450
          end
        else
          495 / (1.0324 - 0.19077 * log(waist - neck) + 0.15456 * log(p_height)) - 450
      end as fat
    from v
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'vTaper', case when p_sex is distinct from 'female' and shoulders > 0 and waist > 0
                   then round(shoulders / waist, 2) end,
    'waistToHip', case when p_sex = 'female' and waist > 0 and hips > 0
                   then round(waist / hips, 2) end,
    'bodyFat', case when fat > 0 and fat < 70 then round(fat, 1) end
  ))
  from calc;
$function$;

-- Чтение профиля ассистентом (MCP-коннектор) — версия с замерами целиком.
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
  v_from := coalesce(nullif(p_from, ''), to_char(now(), 'YYYY-MM-DD'));
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
      'today', to_char(now(), 'YYYY-MM-DD'),
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object('title', t->>'title', 'date', t->>'date', 'done', t->'done')
               order by t->>'date')
        from jsonb_array_elements(coalesce(v_data->'todos', '[]'::jsonb)) t
        where coalesce((t->>'done')::boolean, false) = false
          and coalesce(t->>'date', '') <= to_char(now(), 'YYYY-MM-DD')
      ), '[]'::jsonb)
    );

  elsif p_what = 'measurements' then
    -- у истории замеров умолчание своё: мерят раз в неделю-две, и «сегодня»
    -- вернуло бы пустой список почти всегда. Полгода — это 15-25 точек,
    -- достаточно, чтобы увидеть тренд, и не настолько много, чтобы платить
    -- за это размером ответа
    if coalesce(p_from, '') = '' then
      v_from := to_char(now() - interval '180 days', 'YYYY-MM-DD');
      v_to   := coalesce(nullif(p_to, ''), to_char(now(), 'YYYY-MM-DD'));
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
