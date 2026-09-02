/* =========================================================================
   quick-add.js — быстрый ввод одной фразой.

   «Потратил 3500 на продукты картой», «съел 200 г гречки и 2 яйца»,
   «жим 80 на 8», «задача завтра забрать посылку» — приложение разбирает
   фразу и показывает готовую запись, которую остаётся проверить и записать.

   Разбор целиком локальный: словари ниже + встроенный справочник еды
   (food-db.js). Ничего никуда не отправляется. Если фразу понять не
   удалось, а ИИ-прокси из питания настроен, можно спросить его отдельной
   кнопкой — тогда текст уходит на ту же Edge Function, что и фото еды.

   Записи всегда проходят через окно проверки: сумма и особенно вес порции
   — это оценка по словам, а не факт, глазами их проверить обязательно.
   ========================================================================= */

const QA_EXAMPLES = [
  'Потратил 3500 на продукты картой',
  'Съел 200 г гречки и 2 яйца',
  'Жим лёжа 80 на 8',
  'Задача завтра забрать посылку',
];

/* ---- Нормализация ------------------------------------------------------- */
function qaNorm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}
function qaCap(s) {
  const t = String(s || '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/* ---- Слова-подсказки ---------------------------------------------------- */
const QA_MONEY_OUT = /(потрат|купил|купля|заплат|оплат|отдал|списал|спустил|расход|трата|ушло)/;
const QA_MONEY_IN = /(получил|заработал|зарплат|доход|пришло|пополнил|поступил|начислил|закинул|вернул|продал|преми|аванс)/;
const QA_CURRENCY = /(тг|тенге|₸|руб|рубл|₽|доллар|\$|евро|€|сом|тнг)/;
const QA_MEAL_RE = /(съел|съела|поел|покушал|скушал|перекус|выпил|выпила|позавтракал|пообедал|поужинал|на завтрак|на обед|на ужин|еда:)/;
const QA_WORKOUT_RE = /(тренировк|жим|присед|тяга|тяг[иу]|подтягив|отжим|планк|бицепс|трицепс|пресс|выпад|разгибан|сгибан|гантел|штанг|турник|скручиван|берпи|качал)/;
const QA_TODO_RE = /^(задача|задачу|таск|надо|нужно|напомнить|напомни|не забыть|todo|запланируй|добавь задачу)(?=\s|$|:)/;
const QA_JOURNAL_RE = /^(дневник|запиши|заметка|настроение)(?=\s|$|:)/;
const QA_CHECK_RE = /^(сделал[а-я]*|выполнил[а-я]*|отметь|отметить|готово|закрыл[а-я]*)(?=\s|$)/;

/* Категория расхода по словам в фразе — первое совпадение выигрывает */
const QA_EXPENSE_HINTS = [
  [/продукт|магаз|супермаркет|кафе|ресторан|кофе|доставк|пицц|бургер|суши|шаурм|фастфуд|столов|обед|ед[аеуы]|поесть/, 'Еда'],
  [/такси|бензин|заправ|метро|автобус|проезд|парков|каршер|indriver|яндекс го|транспорт|поезд|самолет|авиабилет/, 'Транспорт'],
  [/квартир|аренд|коммунал|жкх|ипотек|ремонт|мебел|электричеств/, 'Жильё'],
  [/кино|концерт|игр[еуы]|steam|стим|развлеч|клуб|боулинг|караоке|театр|бильярд/, 'Развлечения'],
  [/аптек|врач|лекарств|стоматолог|анализ|клиник|больниц|таблетк|витамин|массаж|психолог|зал(е|у)? ?абонемент|абонемент/, 'Здоровье'],
  [/одежд|обув|кроссов|футболк|джинс|куртк|плать|носк|бель/, 'Одежда'],
  [/курс|учеб|книг|обучен|репетитор|семинар|школ|универ/, 'Образование'],
  [/подписк|netflix|spotify|youtube|apple|chatgpt|claude|яндекс плюс|окко|иви|кинопоиск/, 'Подписки'],
  [/интернет|связ|мобильн|симк|тариф|роуминг/, 'Связь'],
];
const QA_INCOME_HINTS = [
  [/зарплат|оклад|аванс|получку/, 'Зарплата'],
  [/подработ|халтур/, 'Подработка'],
  [/фриланс|заказ|клиент/, 'Фриланс'],
  [/подар|презент/, 'Подарок'],
  [/дивиденд|инвест|акци|вклад|процент|кешбэк|кэшбэк/, 'Инвестиции'],
];

/* Домашние меры и штучные продукты — чтобы «стакан молока» и «2 яйца»
   превращались в граммы. Цифры типовые, их всегда можно поправить в окне. */
const QA_MEASURES = [
  ['столов[а-я]* ложк[а-я]*', 15], ['чайн[а-я]* ложк[а-я]*', 5], ['ложк[а-я]*', 15],
  ['стакан[а-я]*', 250], ['кружк[а-я]*', 250], ['чашк[а-я]*', 200], ['пиал[а-я]*', 250],
  ['тарелк[а-я]*', 300], ['миск[а-я]*', 300], ['порци[а-я]*', 250],
  ['банк[а-я]*', 330], ['бутылк[а-я]*', 500], ['пачк[а-я]*|упаковк[а-я]*', 100],
  ['ломтик[а-я]*|ломт[а-я]*', 30], ['кусоч[а-я]*|кусок|куск[а-я]*', 100], ['горст[а-я]*', 30],
];
const QA_PIECES = [
  [/яйц|яиц/, 55], [/банан/, 120], [/яблок/, 180], [/апельсин/, 150], [/мандарин/, 80],
  [/груш/, 170], [/киви/, 75], [/персик/, 130], [/абрикос/, 40], [/хурм/, 200],
  [/хлеб|тост/, 30], [/булочк|булк/, 80], [/круассан/, 60], [/печень|пряник/, 15],
  [/конфет/, 15], [/шоколадк|батончик/, 50], [/сосиск/, 50], [/сардельк/, 100],
  [/котлет/, 100], [/пельмен/, 12], [/вареник/, 25], [/мант/, 90], [/самс/, 120],
  [/пирожок|пирожк|пирожн/, 90], [/блин/, 50], [/сырник/, 70], [/оладь|олади/, 40],
  [/шаурм/, 300], [/бургер/, 200], [/пицц/, 120], [/суши/, 25], [/ролл/, 30],
  [/огурец|огурц/, 100], [/помидор/, 120], [/картофелин|картошин/, 100], [/морков/, 80],
];

/* Типовая порция, когда вес вообще не назван */
function qaDefaultGrams(title) {
  const t = qaNorm(title);
  if (/суп|борщ|щи |солянк|харчо|бульон|окрошк|уха|лагман|шурп/.test(t)) return 300;
  if (/чай|кофе|сок|молок|кефир|компот|морс|айран|вода|смузи|какао|лимонад|кола|пиво/.test(t)) return 250;
  if (/салат/.test(t)) return 150;
  if (/каш|рис|гречк|макарон|пюре|плов|паста|картоф/.test(t)) return 200;
  return 150;
}

/* =========================================================================
   Разбор фразы
   ========================================================================= */

/* Числа: «3 500», «3,5к», «15k», «2 тыс», а также разговорные «5 тыщ»,
   «косарь» (=1000) и «лям» (=1 000 000) — так в речи чаще всего и называют
   круглые суммы. */
const QA_THOUSAND_RE = /^(к|k|тыс[а-я.]*|тыщ[а-я]*|косар[а-я]*)/;
const QA_MILLION_RE = /^(млн|лям[а-я]*)/;

function qaNumbers(t) {
  const out = [];
  const re = /(\d[\d  ]*(?:[.,]\d+)?)\s*(к|k|тыс[а-я.]*|тыщ[а-я]*|косар[а-я]*|млн|лям[а-я]*)?/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    let value = Number(m[1].replace(/[\s ]/g, '').replace(',', '.'));
    if (!isFinite(value)) continue;
    const mult = m[2] || '';
    if (QA_THOUSAND_RE.test(mult)) value *= 1000;
    else if (QA_MILLION_RE.test(mult)) value *= 1000000;
    out.push({ value, raw: m[0].trim(), index: m.index, after: t.slice(m.index + m[0].length, m.index + m[0].length + 12) });
  }
  return out;
}

/* Сумма: сначала та, что стоит после «за» или перед валютой, иначе крупнейшая */
function qaAmount(t) {
  const nums = qaNumbers(t).filter(n => n.value > 0);
  if (!nums.length) return null;
  const byCurrency = nums.find(n => QA_CURRENCY.test(qaNorm(n.after)));
  if (byCurrency) return byCurrency;
  const byZa = nums.find(n => /(^|\s)за\s*$/.test(t.slice(0, n.index)));
  if (byZa) return byZa;
  return nums.reduce((best, n) => (n.value > best.value ? n : best), nums[0]);
}

function qaMatchHint(t, hints) {
  for (const [re, name] of hints) if (re.test(t)) return name;
  return null;
}

/* Ищем счёт по названию из фразы: не только целиком («Каспи Голд» в фразе
   «Каспи Голд»), но и по значимому слову счёта («каспи» находит «Каспи Голд»,
   «Каспи Gold» и т.п.) — иначе многословные названия почти никогда не совпадали бы. */
function qaFindAccount(t) {
  const words = t.split(/\s+/).filter(w => w.length > 2);
  let best = null, bestLen = 0;
  for (const a of state.finance.accounts) {
    const nameWords = qaNorm(a.name).split(/\s+/).filter(w => w.length > 2);
    if (!nameWords.length) continue;
    const hit = nameWords.some(nw => words.some(w => w === nw || w.startsWith(nw) || nw.startsWith(w)));
    if (hit && nameWords.join(' ').length > bestLen) { best = a; bestLen = nameWords.join(' ').length; }
  }
  if (best) return best;

  const byType = type => state.finance.accounts.find(a => a.type === type);
  if (/налич|кэш|cash/.test(t)) return byType('cash');
  if (/кредитк|кредитн/.test(t)) return byType('credit');
  if (/накопит|депозит|копилк|сбереж/.test(t)) return byType('savings');
  if (/карт|безнал|переводом/.test(t)) return byType('card');
  return null;
}

/* Служебные слова, которым нечего делать в заметке к операции */
const QA_NOTE_STOP = /^(мне|мной|потратил[а-я]*|купил[а-я]*|заплатил[а-я]*|оплатил[а-я]*|отдал[а-я]*|списал[а-я]*|спустил[а-я]*|получил[а-я]*|заработал[а-я]*|пополнил[а-я]*|поступил[а-я]*|начислил[а-я]*|закинул[а-я]*|пришло|вернул[а-я]*|продал[а-я]*|ушло|тг|тенге|₸|руб[а-я]*|₽|доллар[а-я]*|евро|сом|картой|карт[а-я]*|наличными|налич[а-я]*|налом|кэшем|безналом|переводом|кредитк[а-я]*|кредитн[а-я]*|г|гр|кг|мл|шт|на|за|в|из|с|по|у|и)$/;

function qaParseMoney(t) {
  const amount = qaAmount(t);
  if (!amount) return null;
  const isIncome = QA_MONEY_IN.test(t) || (/^\+/.test(t) && !QA_MONEY_OUT.test(t));
  const category = isIncome
    ? (qaMatchHint(t, QA_INCOME_HINTS) || 'Прочее')
    : (qaMatchHint(t, QA_EXPENSE_HINTS) || 'Прочее');
  const account = qaFindAccount(t);
  // слова самого названия счёта тоже незачем повторять в заметке — счёт уже
  // выбран отдельным полем («каспи» из «Каспи Голд» и т.п.)
  const accountWords = account ? new Set(qaNorm(account.name).split(/\s+/).filter(w => w.length > 2)) : null;

  // заметка — исходная фраза без глагола, суммы, валюты и слов про счёт
  const note = qaCap(t
    .replace(amount.raw, ' ')
    .replace(/^[+-]\s*/, '')
    .split(/\s+/)
    .filter(w => w && !QA_NOTE_STOP.test(w) && !(accountWords && [...accountWords].some(aw => w === aw || w.startsWith(aw) || aw.startsWith(w))))
    .join(' '));

  return {
    kind: isIncome ? 'income' : 'expense',
    amount: amount.value,
    category,
    accountId: account ? account.id : (state.finance.accounts[0] || {}).id,
    note: qaNorm(note) === qaNorm(category) ? '' : note,
  };
}

/* ---- Еда ---------------------------------------------------------------- */

/* Поиск блюда: сначала «Мои блюда», потом встроенный справочник.
   Русские окончания встроенный поиск не понимает («гречки» ≠ «Гречка»),
   поэтому пробуем ещё и усечённые основы слов — от длинных к коротким. */
function qaFoodLookup(name) {
  const q = qaNorm(name).replace(/[^а-яa-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  const words = q.split(' ').filter(w => w.length > 2);
  const stems = [];
  words.forEach(w => {
    for (let cut = 1; cut <= 3; cut++) if (w.length - cut >= 3) stems.push(w.slice(0, -cut));
  });
  stems.sort((a, b) => b.length - a.length);
  const variants = [...new Set([q, ...words, ...stems])];

  for (const v of variants) {
    const dish = (state.nutrition.dictionary || []).find(d => qaNorm(d.title).includes(v) && d.per100);
    if (dish) return { title: dish.title, per100: dish.per100 };

    const hits = searchLocalFoodDb(v, 6);
    if (!hits.length) continue;
    const starts = hits.find(h => qaNorm(h.title).startsWith(v));
    if (starts) return starts;
    // слово нашлось только в середине названий («масла» → «Шпроты в масле»)
    // — тогда берём самое простое блюдо, оно почти всегда и имелось в виду
    return hits.slice().sort((a, b) =>
      a.title.split(' ').length - b.title.split(' ').length || a.title.length - b.title.length)[0];
  }
  return null;
}

function qaPieceWeight(name) {
  const t = qaNorm(name);
  for (const [re, g] of QA_PIECES) if (re.test(t)) return g;
  return null;
}

function qaParseMealItem(chunk) {
  let t = qaNorm(chunk).replace(/^(и|а также|плюс|еще)\s+/, '').trim();
  if (!t) return null;

  let grams = null;
  let count = null;

  // домашняя мера: «стакан молока», «2 куска хлеба»
  for (const [pattern, g] of QA_MEASURES) {
    const m = t.match(new RegExp('(?:(\\d+(?:[.,]\\d+)?)\\s*)?(?:' + pattern + ')'));
    if (m) {
      grams = (m[1] ? Number(m[1].replace(',', '.')) : 1) * g;
      t = t.replace(m[0], ' ');
      break;
    }
  }
  if (grams === null) {
    // единица не должна оказаться началом другого слова: «200 г гречки» —
    // это граммы, а «2 яйца» — штуки, поэтому после единицы просмотр вперёд
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*(кг|грамм[а-я]*|гр|г|мл|литр[а-я]*|л)?(?![а-я])/);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      const unit = m[2] || '';
      if (/^(г|гр|грамм|мл)/.test(unit)) grams = n;
      else if (unit === 'кг' || /^(л|литр)/.test(unit)) grams = n * 1000;
      else count = n;
      t = t.replace(m[0], ' ');
    }
  }

  const name = t.replace(/(штук[а-я]*|порци[а-я]*|шт|раз)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name || name.length < 2) return null;

  const found = qaFoodLookup(name);
  const title = found ? found.title : qaCap(name);
  if (grams === null) {
    const piece = qaPieceWeight(name);
    if (count !== null) grams = piece ? count * piece : (count >= 20 ? count : count * qaDefaultGrams(title));
    else grams = piece || qaDefaultGrams(title);
  }
  grams = Math.max(1, Math.round(grams));

  const per100 = found ? found.per100 : null;
  const k = per100 ? grams / 100 : 0;
  return {
    title, grams, per100,
    kcal: per100 ? Math.round(per100.kcal * k) : 0,
    protein: per100 ? +(per100.protein * k).toFixed(1) : 0,
    fat: per100 ? +(per100.fat * k).toFixed(1) : 0,
    carbs: per100 ? +(per100.carbs * k).toFixed(1) : 0,
    unknown: !found,
  };
}

function qaMealTime(t) {
  if (/завтрак/.test(t)) return '08:30';
  if (/обед/.test(t)) return '13:00';
  if (/ужин/.test(t)) return '19:00';
  return new Date().toTimeString().slice(0, 5);
}

function qaParseMeal(t) {
  const body = t
    .replace(/(съел[а-я]*|поел[а-я]*|покушал[а-я]*|скушал[а-я]*|перекусил[а-я]*|выпил[а-я]*|позавтракал[а-я]*|пообедал[а-я]*|поужинал[а-я]*)/g, ' ')
    .replace(/(^|\s)(на|в)\s+(завтрак|обед|ужин)/g, ' ')
    .replace(/^(еда|завтрак|обед|ужин|перекус)\s*:?\s*/, '')
    .replace(/\s+/g, ' ').trim();
  const items = body.split(/[,;]|\+| и /)
    .map(qaParseMealItem)
    .filter(Boolean);
  if (!items.length) return null;
  return { kind: 'meal', time: qaMealTime(t), items };
}

/* ---- Тренировка --------------------------------------------------------- */
const QA_BODYWEIGHT = /подтягив|отжим|пресс|скручиван|планк|берпи|турник|брусь|выпад|приседани/;

function qaParseExercise(chunk) {
  const t = qaNorm(chunk).trim();
  const firstDigit = t.search(/\d/);
  if (firstDigit <= 0) return null;                       // нужно и название, и цифры
  const name = t.slice(0, firstDigit).replace(/\s+(по|на|х|x|\*)\s*$/, '').trim();
  if (!name) return null;
  const nums = t.slice(firstDigit);
  const bodyweight = QA_BODYWEIGHT.test(name);

  let weight = 0, reps = 0, setCount = 1;

  // «3 по 12» — подходы по повторам, вес не назван
  const byPo = nums.match(/^(\d+)\s*по\s*(\d+)/);
  // «80 на 8», «80х8х3», «100 x 5 x 3»
  const byX = nums.match(/^(\d+(?:[.,]\d+)?)\s*(?:кг)?\s*(?:х|x|\*|на)\s*(\d+)(?:\s*(?:х|x|\*|на|по)\s*(\d+))?/);
  const bare = nums.match(/^(\d+)/);

  if (byPo) {
    setCount = Number(byPo[1]); reps = Number(byPo[2]);
  } else if (byX) {
    const a = Number(String(byX[1]).replace(',', '.'));
    const b = Number(byX[2]);
    if (bodyweight && a <= 10 && b >= a) { setCount = a; reps = b; }
    else { weight = a; reps = b; if (byX[3]) setCount = Number(byX[3]); }
  } else if (bare) {
    reps = Number(bare[1]);
  } else {
    return null;
  }

  setCount = clamp(setCount || 1, 1, 20);
  if (!reps) return null;
  const sets = Array.from({ length: setCount }, () => ({ weight, reps }));
  return { name: qaCap(name), sets };
}

function qaParseWorkout(t) {
  const body = t.replace(/^(тренировка|записал тренировку|качал[а-я]*|сделал[а-я]*)\s*:?\s*/, '');
  const exercises = body.split(/[,;]| и /).map(qaParseExercise).filter(Boolean);
  return exercises.length ? { kind: 'workout', exercises } : null;
}

/* ---- Задача, отметка, журнал -------------------------------------------- */
function qaShiftDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

/* Возвращает МАССИВ задач — при диктовке часто называют сразу несколько
   подряд («задача помыть посуду, вынести мусор и полить цветы»), и каждая
   должна стать отдельной записью, а не одной длинной строкой. Запятая —
   надёжный признак перечисления, поэтому дробим по ней; последнее «и» в
   списке дробим только когда запятая уже была — без неё «и» скорее всего
   часть одного дела («сходить в магазин и купить хлеб»). */
function qaParseTodo(t) {
  let body = t.replace(QA_TODO_RE, '').replace(/^\s*(мне|что|бы|:)\s*/, '').trim();
  let date = todayStr();
  if (/послезавтра/.test(body)) { date = qaShiftDate(2); body = body.replace(/послезавтра/g, ' '); }
  else if (/завтра/.test(body)) { date = qaShiftDate(1); body = body.replace(/завтра/g, ' '); }
  else body = body.replace(/сегодня/g, ' ');

  const hasComma = /,/.test(body);
  const splitRe = hasComma ? /,+|(?:^|\s)и\s+(?=[а-яё])/ : /,+/;
  const items = body.split(splitRe).map(s => qaCap(s.replace(/\s+/g, ' ').trim())).filter(Boolean);
  return items.length ? items.map(title => ({ kind: 'todo', title, date })) : null;
}

/* «зарядку» должно совпадать с «Зарядка», поэтому сравниваем и основы слов */
function qaSimilar(a, b) {
  if (!a || !b || b.length < 4) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const stem = x => x.slice(0, Math.max(4, x.length - 2));
  return a.startsWith(stem(b)) || b.startsWith(stem(a));
}

/* Фраза совпала с названием ежедневки, привычки или открытой задачи —
   значит человек говорит «я это сделал», а не заводит что-то новое. */
function qaParseCheck(t) {
  const cleaned = qaNorm(t.replace(QA_CHECK_RE, '')).trim();
  if (cleaned.length < 4) return null;
  const daily = state.dailies.find(d => qaSimilar(qaNorm(d.title), cleaned));
  if (daily) return { kind: 'daily', id: daily.id, title: daily.title };
  const habit = state.habits.find(h => qaSimilar(qaNorm(h.title), cleaned));
  if (habit) return { kind: 'habit', id: habit.id, title: habit.title };
  const todo = state.todos.find(x => !x.done && qaSimilar(qaNorm(x.title), cleaned));
  if (todo) return { kind: 'todoDone', id: todo.id, title: todo.title };
  return null;
}

const QA_MOOD_WORDS = [[/отличн|супер|прекрасн/, 5], [/хорош/, 4], [/нормальн|норм|обычн/, 3], [/так себе|неважн|устал/, 2], [/плох|ужасн|отврат/, 1]];

function qaParseJournal(t) {
  const body = t.replace(QA_JOURNAL_RE, '').replace(/^\s*[:—-]\s*/, '').trim();
  let mood = null;
  const digit = body.match(/\b([1-5])\b/);
  if (digit) mood = Number(digit[1]);
  else for (const [re, m] of QA_MOOD_WORDS) if (re.test(body)) { mood = m; break; }
  const text = qaCap(body.replace(/^\s*[1-5]\s*/, '').trim());
  if (!text && !mood) return null;
  return { kind: 'journal', mood, text };
}

/* ---- Диспетчер ---------------------------------------------------------- */
function qaParseOne(raw) {
  const t = qaNorm(raw);
  if (!t) return null;

  if (QA_JOURNAL_RE.test(t)) { const a = qaParseJournal(t); if (a) return a; }
  if (QA_TODO_RE.test(t)) { const a = qaParseTodo(t); if (a) return a; }

  const looksLikeMoney = QA_MONEY_OUT.test(t) || QA_MONEY_IN.test(t) || QA_CURRENCY.test(t) || /^[+-]\s*\d/.test(t);
  if (looksLikeMoney) { const a = qaParseMoney(t); if (a) return a; }

  if (QA_WORKOUT_RE.test(t)) { const a = qaParseWorkout(t); if (a) return a; }
  if (QA_MEAL_RE.test(t)) { const a = qaParseMeal(t); if (a) return a; }

  const check = qaParseCheck(t);
  if (check) return check;

  // «2 стакана кефира» — глагола нет, но домашняя мера выдаёт еду с головой
  if (QA_MEASURE_ONLY_RE.test(t)) { const a = qaParseMeal(t); if (a) return a; }

  // цифры без слов-подсказок — почти всегда трата («3500 такси»)
  if (/\d/.test(t)) { const a = qaParseMoney(t); if (a) return a; }
  return null;
}

/* Домашняя мера в фразе без глагола — верный признак еды, а не траты */
const QA_MEASURE_ONLY_RE = new RegExp('(?:^|\\s)(?:' + QA_MEASURES.map(m => m[0]).join('|') + ')(?=\\s|$)');

/* Во фразе может быть сразу несколько дел — режем её перед каждым
   следующим глаголом-началом («потратил 3000 на еду и съел борщ»). */
const QA_SPLIT_RE = /(?=\s(?:потратил|потратила|купил|купила|заплатил|оплатил|получил|заработал|съел|съела|поел|выпил|выпила|перекусил|задача|надо|напомни|тренировка|дневник|запиши))/g;

function qaParse(text) {
  // точку между цифрами («3.5к») концом предложения не считаем
  const sentences = String(text || '').split(/[!?\n;]+|\.(?!\d)/).map(s => s.trim()).filter(Boolean);
  const chunks = [];
  sentences.forEach(s => {
    const parts = s.split(QA_SPLIT_RE).map(p => p.replace(/\s+и\s*$/, '').trim()).filter(Boolean);
    chunks.push(...(parts.length ? parts : [s]));
  });
  const actions = [];
  chunks.forEach(c => {
    const a = qaParseOne(c);
    if (!a) return;
    if (Array.isArray(a)) actions.push(...a);
    else actions.push(a);
  });
  return actions;
}

/* =========================================================================
   Окно проверки перед записью
   ========================================================================= */

function qaActionCardHtml(a, i) {
  const accounts = state.finance.accounts;
  if (a.kind === 'expense' || a.kind === 'income') {
    const cats = a.kind === 'income' ? incomeCats() : expenseCats();
    return `<div class="qa-card" data-qa="${i}">
      <div class="qa-head">${icon(a.kind === 'income' ? 'banknote' : 'wallet', 15)}
        <span>${a.kind === 'income' ? 'Доход' : 'Расход'}</span>
        <button type="button" class="qa-drop" data-qa-drop="${i}" title="Убрать">${icon('x', 12)}</button></div>
      <div class="qa-grid">
        <label class="field">Сумма (${esc(state.settings.currency)})
          <input type="number" step="0.01" min="0" data-f="amount" value="${a.amount}"></label>
        <label class="field">Категория
          <input type="text" data-f="category" list="qaCatList${i}" value="${esc(a.category)}">
          <datalist id="qaCatList${i}">${cats.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></label>
        <label class="field">Счёт
          <select data-f="accountId">${accounts.map(x => `<option value="${x.id}" ${x.id === a.accountId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="field">Заметка
          <input type="text" data-f="note" value="${esc(a.note || '')}" placeholder="необязательно"></label>
      </div>
    </div>`;
  }

  if (a.kind === 'meal') {
    return `<div class="qa-card" data-qa="${i}">
      <div class="qa-head">${icon('utensils', 15)}<span>Приём пищи</span>
        <button type="button" class="qa-drop" data-qa-drop="${i}" title="Убрать">${icon('x', 12)}</button></div>
      ${a.items.some(it => it.unknown) ? `<div class="warn-box" style="margin-top:0;">Часть блюд не нашлась в справочнике — впиши калории сам или уточни название.</div>` : ''}
      <div class="qa-items">
        ${a.items.map((it, j) => `<div class="qa-item" data-qa-item="${j}">
          <input type="text" class="qa-item-title" data-f="title" value="${esc(it.title)}">
          <input type="number" class="qa-item-num" data-f="grams" min="1" step="1" value="${it.grams}" title="Граммы">
          <span class="qa-unit">г</span>
          <input type="number" class="qa-item-num" data-f="kcal" min="0" step="1" value="${it.kcal}" title="Калории">
          <span class="qa-unit">ккал</span>
          <button type="button" class="qa-drop" data-qa-item-drop="${j}" title="Убрать">${icon('x', 12)}</button>
        </div>`).join('')}
      </div>
      <div class="qa-note">Вес порции — оценка по фразе. Проверь его: на цифры он влияет сильнее всего.</div>
    </div>`;
  }

  if (a.kind === 'workout') {
    return `<div class="qa-card" data-qa="${i}">
      <div class="qa-head">${icon('dumbbell', 15)}<span>Тренировка сегодня</span>
        <button type="button" class="qa-drop" data-qa-drop="${i}" title="Убрать">${icon('x', 12)}</button></div>
      <div class="qa-items">
        ${a.exercises.map(ex => `<div class="qa-item static">
          <span class="qa-item-title-text">${esc(ex.name)}</span>
          <span class="qa-sets">${ex.sets.map(s => `<span class="chip">${s.weight ? `${s.weight} × ` : ''}${s.reps}</span>`).join('')}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  if (a.kind === 'todo') {
    return `<div class="qa-card" data-qa="${i}">
      <div class="qa-head">${icon('check', 15)}<span>Задача</span>
        <button type="button" class="qa-drop" data-qa-drop="${i}" title="Убрать">${icon('x', 12)}</button></div>
      <div class="qa-grid">
        <label class="field" style="grid-column:1/-1;">Название
          <input type="text" data-f="title" value="${esc(a.title)}"></label>
        <label class="field">На день
          <input type="date" data-f="date" value="${a.date}"></label>
      </div>
    </div>`;
  }

  const marks = {
    daily: ['calendar', 'Отметить ежедневку'],
    habit: ['repeat', 'Отметить привычку'],
    todoDone: ['check', 'Закрыть задачу'],
    journal: ['book', 'Запись в журнал'],
  };
  const [ic, label] = marks[a.kind] || ['sparkle', 'Запись'];
  const body = a.kind === 'journal'
    ? `<div class="qa-grid">
        <label class="field" style="grid-column:1/-1;">Текст
          <input type="text" data-f="text" value="${esc(a.text || '')}"></label>
        <label class="field">Настроение
          <select data-f="mood">${MOODS.map(m => `<option value="${m.id}" ${(a.mood || 3) === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      </div>`
    : `<div class="qa-line">${esc(a.title)}</div>`;
  return `<div class="qa-card" data-qa="${i}">
    <div class="qa-head">${icon(ic, 15)}<span>${label}</span>
      <button type="button" class="qa-drop" data-qa-drop="${i}" title="Убрать">${icon('x', 12)}</button></div>
    ${body}
  </div>`;
}

function openQuickPreview(actions, sourceText) {
  let list = actions.slice();

  openModal('Проверь и запиши', `
    <div class="qa-source">${icon('sparkle', 13)} ${esc(sourceText)}</div>
    <div id="qaList">${list.map(qaActionCardHtml).join('')}</div>
    <div class="form-actions mt16">
      <button type="button" class="btn ghost" data-qa-cancel>Отмена</button>
      <button type="button" class="btn primary" data-qa-save>${icon('checkmark', 15)} Записать</button>
    </div>`, modal => {
    const listEl = modal.querySelector('#qaList');

    /* Пересчёт калорий при смене веса — только если известны цифры на 100 г */
    listEl.addEventListener('input', e => {
      const gramsInput = e.target.closest('[data-f=grams]');
      if (!gramsInput) return;
      const card = gramsInput.closest('.qa-card');
      const itemEl = gramsInput.closest('[data-qa-item]');
      const a = list[Number(card.dataset.qa)];
      const item = a && a.items && a.items[Number(itemEl.dataset.qaItem)];
      if (!item || !item.per100) return;
      const g = Number(gramsInput.value) || 0;
      itemEl.querySelector('[data-f=kcal]').value = Math.round(item.per100.kcal * g / 100);
    });

    listEl.addEventListener('click', e => {
      const dropItem = e.target.closest('[data-qa-item-drop]');
      if (dropItem) {
        const card = dropItem.closest('.qa-card');
        const a = list[Number(card.dataset.qa)];
        a.items.splice(Number(dropItem.dataset.qaItemDrop), 1);
        if (!a.items.length) list[Number(card.dataset.qa)] = null;
        rerender();
        return;
      }
      const drop = e.target.closest('[data-qa-drop]');
      if (drop) {
        list[Number(drop.dataset.qaDrop)] = null;
        rerender();
      }
    });

    function rerender() {
      list = list.filter(Boolean);
      if (!list.length) { closeModal(); return; }
      listEl.innerHTML = list.map(qaActionCardHtml).join('');
    }

    modal.querySelector('[data-qa-cancel]').addEventListener('click', closeModal);
    modal.querySelector('[data-qa-save]').addEventListener('click', () => {
      const ready = qaReadBack(listEl, list);
      if (!ready.length) { toast('Нечего записывать', 'red'); return; }
      applyQuickActions(ready);
      closeModal();
    });
  });
}

/* Собираем изменённые поля обратно в действия */
function qaReadBack(listEl, list) {
  const out = [];
  listEl.querySelectorAll('.qa-card').forEach(card => {
    const a = list[Number(card.dataset.qa)];
    if (!a) return;
    const val = f => {
      const el = card.querySelector(`:scope > .qa-grid [data-f=${f}], :scope > [data-f=${f}]`);
      return el ? el.value : null;
    };
    if (a.kind === 'expense' || a.kind === 'income') {
      a.amount = Math.abs(Number(val('amount')) || 0);
      a.category = String(val('category') || '').trim() || 'Прочее';
      a.accountId = val('accountId') || a.accountId;
      a.note = String(val('note') || '').trim();
      if (!a.amount) return;
    } else if (a.kind === 'meal') {
      const items = [];
      card.querySelectorAll('[data-qa-item]').forEach(row => {
        const src = a.items[Number(row.dataset.qaItem)] || {};
        const grams = Math.max(1, Number(row.querySelector('[data-f=grams]').value) || 1);
        const kcal = Math.max(0, Number(row.querySelector('[data-f=kcal]').value) || 0);
        const title = String(row.querySelector('[data-f=title]').value || '').trim() || 'Приём пищи';
        if (!kcal) return;                    // без калорий запись бессмысленна
        const k = src.per100 ? grams / 100 : 0;
        items.push({
          title, grams, kcal,
          protein: src.per100 ? +(src.per100.protein * k).toFixed(1) : (src.protein || 0),
          fat: src.per100 ? +(src.per100.fat * k).toFixed(1) : (src.fat || 0),
          carbs: src.per100 ? +(src.per100.carbs * k).toFixed(1) : (src.carbs || 0),
        });
      });
      if (!items.length) { toast('У блюда не указаны калории — впиши их', 'red'); return; }
      a.items = items;
    } else if (a.kind === 'todo') {
      a.title = String(val('title') || '').trim();
      a.date = val('date') || todayStr();
      if (!a.title) return;
    } else if (a.kind === 'journal') {
      a.text = String(val('text') || '').trim();
      a.mood = Number(val('mood')) || 3;
      if (!a.text) return;
    }
    out.push(a);
  });
  return out;
}

/* =========================================================================
   Запись
   ========================================================================= */
function applyQuickActions(list) {
  const done = [];
  mutate(() => {
    list.forEach(a => {
      if (a.kind === 'expense' || a.kind === 'income') {
        addTransaction(a.amount, a.kind, a.category, a.note, todayStr(), false, a.accountId);
        done.push(`${a.kind === 'income' ? 'доход' : 'расход'} ${fmtMoney(a.amount)}`);
      } else if (a.kind === 'meal') {
        a.items.forEach(it => addMealEntry({ ...it, time: a.time || '', source: 'quick' }));
        done.push(`${a.items.length} ${plural(a.items.length, 'блюдо', 'блюда', 'блюд')}`);
      } else if (a.kind === 'workout') {
        const today = todayStr();
        let w = state.workouts.find(x => x.date === today);
        if (!w) {
          w = { id: uid(), title: 'Тренировка', date: today, note: '', exercises: [], createdAt: nowISO() };
          state.workouts.push(w);
        }
        a.exercises.forEach(ex => w.exercises.push({ id: uid(), name: ex.name, sets: ex.sets }));
        addLog('🏋️', `Тренировка дополнена: ${a.exercises.map(e => e.name).join(', ')}`);
        done.push(`тренировка (${a.exercises.length})`);
      } else if (a.kind === 'todo') {
        state.todos.push({ id: uid(), title: a.title, date: a.date, done: false, doneAt: null, createdAt: nowISO() });
        addLog('➕', `Создано: ${a.title}`);
        done.push('задача');
      } else if (a.kind === 'daily') {
        const d = state.dailies.find(x => x.id === a.id);
        if (d && !d.history.includes(todayStr())) {
          d.history.push(todayStr());
          d.history.sort();
          recomputeStreak(d);
          addLog('📅', `Ежедневка выполнена: ${d.title} (стрик ${d.streak})`);
          done.push(d.title);
        }
      } else if (a.kind === 'habit') {
        const h = state.habits.find(x => x.id === a.id);
        if (h) {
          const today = todayStr();
          if (h.lastDay !== today) { h.lastDay = today; h.todayCount = 0; }
          h.upCount = (h.upCount || 0) + 1;
          h.todayCount = (h.todayCount || 0) + 1;
          h.history = h.history || [];
          h.history.push({ date: today, dir: 1 });
          addLog('🔁', `Привычка «${h.title}» отмечена`);
          done.push(h.title);
        }
      } else if (a.kind === 'todoDone') {
        const t = state.todos.find(x => x.id === a.id);
        if (t && !t.done) {
          t.done = true; t.doneAt = nowISO();
          addLog('✅', `Задача выполнена: ${t.title}`);
          done.push(t.title);
        }
      } else if (a.kind === 'journal') {
        const today = todayStr();
        const existing = state.journal.find(j => j.date === today);
        if (existing) {
          existing.text = existing.text ? existing.text + '\n' + a.text : a.text;
          if (a.mood) existing.mood = a.mood;
          existing.updatedAt = nowISO();
        } else {
          state.journal.unshift({ id: uid(), date: today, mood: a.mood || 3, wins: [], gratitude: [], text: a.text, createdAt: nowISO() });
          addLog('📔', 'Сделана запись в журнале');
        }
        done.push('журнал');
      }
    });
  });
  if (done.length) {
    SFX.complete();
    toast(`Записано: ${done.join(', ')}`, 'green');
  }
}

/* =========================================================================
   Помощь ИИ, когда фраза не разобралась
   ========================================================================= */
function qaAiAvailable() {
  return typeof foodApiConfigured === 'function' && foodApiConfigured();
}

async function qaAskAi(text) {
  const context = [
    `Сегодня ${todayStr()}.`,
    `Категории расходов: ${expenseCats().map(c => c.name).join(', ')}.`,
    `Категории доходов: ${incomeCats().map(c => c.name).join(', ')}.`,
    `Счета пользователя: ${state.finance.accounts.map(a => a.name).join(', ')}.`,
  ].join(' ');

  const res = await fetch(syncCfg.foodFn, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: syncCfg.anonKey,
      Authorization: 'Bearer ' + syncCfg.accessToken,
    },
    body: JSON.stringify({ text, context }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400) throw new Error('старая версия серверной функции — обнови analyze-food, см. SETUP-FOOD-AI.md');
    throw new Error(body.error || `сервер ответил ${res.status}`);
  }
  return qaNormalizeAiActions(body.actions || []);
}

/* Ответу модели не доверяем на слово — приводим к своим полям и типам */
function qaNormalizeAiActions(raw) {
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach(a => {
    const kind = String(a && a.kind || '');
    if (kind === 'expense' || kind === 'income') {
      const amount = Math.abs(Number(a.amount) || 0);
      if (!amount) return;
      const account = String(a.account || '').trim();
      const matched = account ? qaFindAccount(qaNorm(account)) : null;
      out.push({
        kind, amount,
        category: String(a.category || 'Прочее').slice(0, 40),
        accountId: (matched || state.finance.accounts[0] || {}).id,
        note: String(a.note || '').slice(0, 120),
      });
    } else if (kind === 'meal') {
      const items = (Array.isArray(a.items) ? a.items : []).map(it => ({
        title: String(it.title || 'Блюдо').slice(0, 80),
        grams: Math.max(1, Math.round(Number(it.grams) || 100)),
        kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
        protein: Math.max(0, +(Number(it.protein) || 0).toFixed(1)),
        fat: Math.max(0, +(Number(it.fat) || 0).toFixed(1)),
        carbs: Math.max(0, +(Number(it.carbs) || 0).toFixed(1)),
        per100: null,
        unknown: false,
      })).filter(it => it.kcal > 0);
      if (items.length) out.push({ kind: 'meal', time: new Date().toTimeString().slice(0, 5), items });
    } else if (kind === 'workout') {
      const exercises = (Array.isArray(a.exercises) ? a.exercises : []).map(ex => ({
        name: String(ex.name || 'Упражнение').slice(0, 60),
        sets: (Array.isArray(ex.sets) ? ex.sets : []).map(s => ({
          weight: Math.max(0, Number(s.weight) || 0),
          reps: Math.max(0, Math.round(Number(s.reps) || 0)),
        })).filter(s => s.reps > 0),
      })).filter(ex => ex.sets.length);
      if (exercises.length) out.push({ kind: 'workout', exercises });
    } else if (kind === 'todo') {
      const title = String(a.title || '').trim().slice(0, 120);
      if (title) out.push({ kind: 'todo', title, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : todayStr() });
    } else if (kind === 'journal') {
      const text = String(a.text || '').trim().slice(0, 500);
      if (text) out.push({ kind: 'journal', text, mood: clamp(Number(a.mood) || 3, 1, 5) });
    }
  });
  return out;
}

/* Фраза не разобралась: предлагаем ИИ (если настроен) и ручные формы */
function openQuickFallback(text) {
  openModal('Не понял фразу', `
    <div class="qa-source">${icon('sparkle', 13)} ${esc(text)}</div>
    <p class="text-dim" style="font-size:13.5px;line-height:1.5;margin:14px 0 16px;">
      Попробуй иначе: «потратил 3500 на продукты», «съел 200 г гречки», «жим 80 на 8»,
      «задача завтра забрать посылку». Или открой нужную форму — текст подставится.</p>
    <div class="add-row" style="margin-top:0;">
      ${qaAiAvailable() ? `<button class="btn primary" data-qa-ai>${icon('bot', 15)} Спросить ИИ</button>` : ''}
      <button class="btn" data-qa-open="expense">${icon('wallet', 15)} Трата</button>
      <button class="btn" data-qa-open="meal">${icon('utensils', 15)} Еда</button>
      <button class="btn" data-qa-open="todo">${icon('check', 15)} Задача</button>
    </div>`, modal => {
    const ai = modal.querySelector('[data-qa-ai]');
    if (ai) ai.addEventListener('click', async () => {
      ai.disabled = true;
      ai.innerHTML = `${icon('hourglass', 15)} Думает…`;
      try {
        const actions = await qaAskAi(text);
        closeModal();
        if (actions.length) openQuickPreview(actions, text);
        else toast('ИИ тоже не понял — запиши через форму', 'red');
      } catch (e) {
        ai.disabled = false;
        ai.innerHTML = `${icon('bot', 15)} Спросить ИИ`;
        toast('ИИ недоступен: ' + e.message, 'red');
      }
    });

    modal.querySelectorAll('[data-qa-open]').forEach(b => b.addEventListener('click', () => {
      const kind = b.dataset.qaOpen;
      closeModal();
      if (kind === 'expense') openTxForm(null, { note: qaCap(text) });
      else if (kind === 'meal') openMealForm(null, { title: qaCap(text) });
      else openTaskForm('todo');
    }));
  });
}

/* =========================================================================
   Строка ввода на главной
   ========================================================================= */
function quickBarHtml() {
  return `<form class="quick-bar" id="quickBar" autocomplete="off">
      <span class="qb-ic">${icon('sparkle', 16)}</span>
      <input type="text" id="quickInput" placeholder="Потратил 3500 на продукты…" aria-label="Быстрая запись">
      <button type="button" class="qb-btn" id="quickMic" title="Сказать голосом" aria-label="Сказать голосом">${icon('mic', 16)}</button>
      <button type="submit" class="qb-btn go" title="Разобрать" aria-label="Разобрать">${icon('checkmark', 15)}</button>
    </form>
    <div class="qb-hints" id="quickHints">
      ${QA_EXAMPLES.map(x => `<button type="button" class="chip-btn" data-qa-ex="${esc(x)}">${esc(x)}</button>`).join('')}
    </div>`;
}

let qaThinking = false;

function bindQuickBar() {
  const form = document.getElementById('quickBar');
  if (!form) return;
  const input = document.getElementById('quickInput');

  // печатать привычно продолжаем разбирать локальными шаблонами — это мгновенно
  // и работает офлайн, а шаблоны для набора текста ловят почти всё нужное
  const run = () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    const actions = qaParse(text);
    if (actions.length) openQuickPreview(actions, text);
    else openQuickFallback(text);
    input.value = '';
  };

  // а голос — фраза «любая», без подгонки под шаблон, поэтому сначала спрашиваем
  // ИИ (если он настроен): он понимает смысл целиком, а не ключевые слова, и не
  // путает «пополнили каспи на 5к» с тратой. Шаблоны — только запасной вариант,
  // если ИИ не настроен или не смог ответить.
  const runVoice = async () => {
    const text = input.value.trim();
    if (!text) return;

    if (qaAiAvailable()) {
      qaThinking = true;
      mic.classList.add('thinking');
      mic.innerHTML = icon('hourglass', 16);
      input.disabled = true;
      try {
        const actions = await qaAskAi(text);
        if (actions.length) { input.value = ''; openQuickPreview(actions, text); return; }
        toast('ИИ не понял фразу — пробую по шаблону', 'red');
      } catch (e) {
        // раньше ошибка тихо уходила только в консоль, и голос как будто «просто
        // не работал» без объяснения — теперь всегда показываем тост с причиной
        toast('ИИ недоступен: ' + e.message, 'red');
        console.warn('ИИ не смог разобрать голосовую фразу, пробуем локальный разбор:', e);
      } finally {
        qaThinking = false;
        mic.classList.remove('thinking');
        mic.innerHTML = icon('mic', 16);
        input.disabled = false;
      }
    }

    const actions = qaParse(text);
    input.value = '';
    if (actions.length) openQuickPreview(actions, text);
    else openQuickFallback(text);
  };

  form.addEventListener('submit', e => { e.preventDefault(); run(); });
  // на телефонной клавиатуре кнопка «Готово» не всегда отправляет форму сама
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); run(); }
  });
  document.querySelectorAll('[data-qa-ex]').forEach(b => b.addEventListener('click', () => {
    input.value = b.dataset.qaEx;
    input.focus();
  }));

  const mic = document.getElementById('quickMic');
  if (!qaSpeechSupported()) mic.style.display = 'none';
  else mic.addEventListener('click', () => { if (!qaThinking) qaListen(input, mic, runVoice); });
}

/* ---- Голос -------------------------------------------------------------- */
function qaSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

let qaRecognition = null;

function qaListen(input, mic, onDone) {
  if (qaRecognition) { qaRecognition.stop(); return; }
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Rec();
  rec.lang = 'ru-RU';
  rec.interimResults = true;
  rec.continuous = false;
  qaRecognition = rec;
  mic.classList.add('listening');
  input.placeholder = 'Слушаю…';

  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += chunk;
      else interim += chunk;
    }
    input.value = (finalText + interim).trim();
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed') toast('Микрофон запрещён в настройках браузера', 'red');
    else if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Не расслышал, попробуй ещё раз', 'red');
  };
  rec.onend = () => {
    qaRecognition = null;
    mic.classList.remove('listening');
    input.placeholder = 'Потратил 3500 на продукты…';
    // сказанное сразу отправляем в разбор — иначе пришлось бы жать ещё раз
    if (input.value.trim()) onDone();
  };

  try { rec.start(); }
  catch (e) { qaRecognition = null; mic.classList.remove('listening'); }
}
