/* =========================================================================
   food-db.js — встроенный справочник КБЖУ на русском языке.

   Работает полностью офлайн, без ключей и интернета: ввёл название —
   получил готовые значения на 100 г. Цифры — типовые справочные величины
   (усреднённые показатели по стандартным таблицам пищевой ценности),
   а не результат лабораторного анализа конкретного продукта, поэтому для
   фабричных продуктов точнее штрихкод — там данные прямо с этикетки.
   ========================================================================= */

// { id, title, alias — доп. слова для поиска, kcal/protein/fat/carbs — на 100 г }
const FOOD_DB = [
  // --- Крупы, каши, гарниры -------------------------------------------------
  { title: 'Гречка отварная', alias: 'гречневая каша',           kcal: 132, protein: 4.5, fat: 1.1, carbs: 25 },
  { title: 'Рис отварной',    alias: 'рисовая каша белый рис',   kcal: 116, protein: 2.2, fat: 0.5, carbs: 24 },
  { title: 'Рис бурый отварной',                                  kcal: 111, protein: 2.6, fat: 0.9, carbs: 23 },
  { title: 'Овсянка на воде', alias: 'овсяная каша геркулес',    kcal: 88,  protein: 3.0, fat: 1.7, carbs: 15 },
  { title: 'Овсянка на молоке',                                   kcal: 102, protein: 3.2, fat: 4.1, carbs: 14 },
  { title: 'Пшённая каша',                                        kcal: 135, protein: 4.7, fat: 2.3, carbs: 24 },
  { title: 'Перловая каша',                                       kcal: 106, protein: 3.1, fat: 0.4, carbs: 22 },
  { title: 'Манная каша на молоке',                               kcal: 98,  protein: 3.0, fat: 3.2, carbs: 15 },
  { title: 'Кускус отварной',                                     kcal: 112, protein: 3.8, fat: 0.2, carbs: 23 },
  { title: 'Булгур отварной',                                     kcal: 83,  protein: 3.1, fat: 0.2, carbs: 18 },
  { title: 'Киноа отварная',                                      kcal: 120, protein: 4.4, fat: 1.9, carbs: 21 },
  { title: 'Макароны отварные', alias: 'паста спагетти',         kcal: 112, protein: 3.5, fat: 0.4, carbs: 23 },
  { title: 'Картофель отварной', alias: 'картошка',              kcal: 82,  protein: 2.0, fat: 0.4, carbs: 16.7 },
  { title: 'Картофельное пюре',                                   kcal: 106, protein: 2.5, fat: 4.0, carbs: 14.7 },
  { title: 'Картофель жареный', alias: 'жареная картошка',       kcal: 192, protein: 2.8, fat: 10.2, carbs: 23.4 },
  { title: 'Картофель фри',                                       kcal: 312, protein: 3.4, fat: 15.5, carbs: 41.1 },

  // --- Мясо и птица ----------------------------------------------------------
  { title: 'Куриная грудка отварная', alias: 'варёная курица',   kcal: 137, protein: 29.8, fat: 1.8, carbs: 0 },
  { title: 'Куриная грудка жареная',                              kcal: 190, protein: 27, fat: 8.5, carbs: 1 },
  { title: 'Курица жареная (с кожей)',                            kcal: 218, protein: 20.5, fat: 15, carbs: 0 },
  { title: 'Куриные бёдра запечённые',                            kcal: 209, protein: 24, fat: 12, carbs: 0 },
  { title: 'Куриная котлета',                                     kcal: 175, protein: 17, fat: 9, carbs: 6 },
  { title: 'Индейка отварная',                                    kcal: 130, protein: 25, fat: 3, carbs: 0 },
  { title: 'Говядина отварная',                                   kcal: 254, protein: 25.8, fat: 16.8, carbs: 0 },
  { title: 'Говядина тушёная',                                    kcal: 232, protein: 22, fat: 16, carbs: 0 },
  { title: 'Говяжий стейк',                                       kcal: 250, protein: 26, fat: 16, carbs: 0 },
  { title: 'Свинина жареная',                                     kcal: 357, protein: 19.6, fat: 30.9, carbs: 0 },
  { title: 'Свиная отбивная',                                     kcal: 265, protein: 22, fat: 19, carbs: 1 },
  { title: 'Свиные рёбра',                                        kcal: 320, protein: 21, fat: 26, carbs: 0 },
  { title: 'Фарш говяжий жареный',                                kcal: 254, protein: 22, fat: 18, carbs: 0 },
  { title: 'Котлета мясная жареная',                              kcal: 220, protein: 15, fat: 15, carbs: 8 },
  { title: 'Плов с мясом',                                        kcal: 200, protein: 8.5, fat: 8.5, carbs: 24 },
  { title: 'Шашлык свиной',                                       kcal: 270, protein: 21, fat: 20, carbs: 1 },
  { title: 'Шаурма с курицей',                                    kcal: 210, protein: 11, fat: 9, carbs: 20 },
  { title: 'Пельмени отварные',                                   kcal: 220, protein: 11.5, fat: 9, carbs: 24 },
  { title: 'Голубцы с мясом',                                     kcal: 110, protein: 6, fat: 5.5, carbs: 9.5 },
  { title: 'Сосиски отварные',                                    kcal: 266, protein: 10.5, fat: 24, carbs: 1.5 },
  { title: 'Колбаса варёная',                                     kcal: 257, protein: 12, fat: 22.5, carbs: 1.5 },
  { title: 'Колбаса копчёная',                                    kcal: 420, protein: 17, fat: 39, carbs: 0 },
  { title: 'Бекон жареный',                                       kcal: 500, protein: 25, fat: 42, carbs: 1 },
  { title: 'Печень куриная тушёная',                              kcal: 166, protein: 20, fat: 7, carbs: 4 },

  // --- Рыба и морепродукты ---------------------------------------------------
  { title: 'Лосось запечённый', alias: 'сёмга',                  kcal: 208, protein: 22, fat: 13, carbs: 0 },
  { title: 'Форель запечённая',                                   kcal: 175, protein: 22, fat: 9, carbs: 0 },
  { title: 'Треска отварная',                                     kcal: 78,  protein: 17.8, fat: 0.7, carbs: 0 },
  { title: 'Минтай отварной',                                     kcal: 79,  protein: 17.1, fat: 0.9, carbs: 0 },
  { title: 'Тунец консервированный (в собств. соку)',             kcal: 96,  protein: 22, fat: 1, carbs: 0 },
  { title: 'Креветки отварные',                                   kcal: 95,  protein: 20, fat: 1.7, carbs: 0 },
  { title: 'Красная икра',                                        kcal: 250, protein: 32, fat: 13, carbs: 0 },
  { title: 'Рыба жареная в кляре',                                kcal: 230, protein: 15, fat: 15, carbs: 8 },
  { title: 'Роллы с лососем',                                     kcal: 176, protein: 7, fat: 5, carbs: 25 },
  { title: 'Суши сет',                                            kcal: 150, protein: 6.5, fat: 3, carbs: 24 },

  // --- Яйца и молочное --------------------------------------------------------
  { title: 'Яйцо варёное', alias: 'вкрутую',                     kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1 },
  { title: 'Яичница из 2 яиц',                                    kcal: 196, protein: 13, fat: 15, carbs: 1 },
  { title: 'Омлет из 2 яиц',                                      kcal: 184, protein: 12, fat: 14, carbs: 2 },
  { title: 'Молоко 3.2%',                                         kcal: 60,  protein: 2.9, fat: 3.2, carbs: 4.7 },
  { title: 'Молоко 1.5%',                                         kcal: 44,  protein: 3.0, fat: 1.5, carbs: 4.8 },
  { title: 'Кефир 2.5%',                                          kcal: 53,  protein: 2.9, fat: 2.5, carbs: 4.0 },
  { title: 'Йогурт натуральный без добавок',                     kcal: 66,  protein: 5,   fat: 3.2, carbs: 3.5 },
  { title: 'Йогурт греческий', alias: 'греческий йогурт',        kcal: 97,  protein: 9,   fat: 5,   carbs: 4 },
  { title: 'Творог 5%',                                           kcal: 121, protein: 17.2, fat: 5,  carbs: 1.8 },
  { title: 'Творог 9%',                                           kcal: 159, protein: 16.7, fat: 9,  carbs: 2.0 },
  { title: 'Творог обезжиренный',                                 kcal: 71,  protein: 16.5, fat: 0.6, carbs: 1.3 },
  { title: 'Сметана 20%',                                         kcal: 206, protein: 2.8, fat: 20,  carbs: 3.2 },
  { title: 'Сыр твёрдый (типа российского)',                     kcal: 363, protein: 24,  fat: 29,  carbs: 0.3 },
  { title: 'Сыр моцарелла',                                       kcal: 280, protein: 22, fat: 21, carbs: 2.2 },
  { title: 'Сыр фета',                                            kcal: 264, protein: 14, fat: 21, carbs: 4 },
  { title: 'Сливочное масло',                                     kcal: 748, protein: 0.5, fat: 82.5, carbs: 0.8 },
  { title: 'Мороженое пломбир',                                   kcal: 227, protein: 3.7, fat: 15,  carbs: 20 },

  // --- Хлеб, выпечка -----------------------------------------------------------
  { title: 'Хлеб белый', alias: 'батон',                         kcal: 265, protein: 7.7, fat: 2.4, carbs: 53.3 },
  { title: 'Хлеб чёрный ржаной',                                  kcal: 214, protein: 6.6, fat: 1.2, carbs: 40.7 },
  { title: 'Хлеб цельнозерновой',                                 kcal: 246, protein: 10.7, fat: 3.3, carbs: 43.3 },
  { title: 'Лаваш',                                                kcal: 236, protein: 7.9, fat: 1.0, carbs: 47.6 },
  { title: 'Блины',                                                kcal: 233, protein: 6.1, fat: 7.4, carbs: 34.7 },
  { title: 'Сырники',                                              kcal: 220, protein: 15, fat: 10, carbs: 18 },
  { title: 'Оладьи',                                               kcal: 217, protein: 6.4, fat: 6.5, carbs: 34 },
  { title: 'Круассан',                                             kcal: 406, protein: 8.2, fat: 21, carbs: 46 },
  { title: 'Пицца Маргарита (кусок)',                             kcal: 266, protein: 11,  fat: 10, carbs: 33 },
  { title: 'Пирожок с мясом жареный',                             kcal: 260, protein: 8,   fat: 12, carbs: 30 },
  { title: 'Торт бисквитный с кремом',                            kcal: 340, protein: 4.5, fat: 15, carbs: 48 },
  { title: 'Печенье песочное',                                    kcal: 435, protein: 6.5, fat: 18, carbs: 65 },
  { title: 'Вафли с начинкой',                                    kcal: 430, protein: 4,   fat: 20, carbs: 60 },
  { title: 'Шоколад молочный',                                    kcal: 534, protein: 6.9, fat: 30, carbs: 58 },
  { title: 'Шоколад тёмный 70%',                                  kcal: 546, protein: 7.8, fat: 38, carbs: 46 },

  // --- Супы --------------------------------------------------------------------
  { title: 'Борщ со сметаной',                                    kcal: 55,  protein: 2.2, fat: 2.5, carbs: 6.2 },
  { title: 'Щи',                                                   kcal: 41,  protein: 1.8, fat: 2.0, carbs: 4.3 },
  { title: 'Куриный суп с лапшой',                                kcal: 40,  protein: 3.2, fat: 1.5, carbs: 3.7 },
  { title: 'Солянка мясная',                                      kcal: 105, protein: 6.5, fat: 7.5, carbs: 3.5 },
  { title: 'Суп-пюре овощной',                                    kcal: 45,  protein: 1.5, fat: 1.8, carbs: 6 },
  { title: 'Харчо',                                                kcal: 75,  protein: 4.5, fat: 4.5, carbs: 5 },

  // --- Овощи -------------------------------------------------------------------
  { title: 'Помидор', alias: 'томат свежий',                     kcal: 20,  protein: 0.9, fat: 0.2, carbs: 3.9 },
  { title: 'Огурец свежий',                                       kcal: 15,  protein: 0.8, fat: 0.1, carbs: 2.8 },
  { title: 'Капуста белокочанная свежая',                         kcal: 27,  protein: 1.8, fat: 0.1, carbs: 4.7 },
  { title: 'Морковь свежая',                                      kcal: 32,  protein: 1.3, fat: 0.1, carbs: 6.9 },
  { title: 'Свёкла отварная',                                     kcal: 44,  protein: 1.7, fat: 0.1, carbs: 8.8 },
  { title: 'Лук репчатый',                                        kcal: 41,  protein: 1.4, fat: 0.2, carbs: 8.2 },
  { title: 'Перец болгарский',                                    kcal: 27,  protein: 1.3, fat: 0.1, carbs: 5.3 },
  { title: 'Брокколи отварная',                                   kcal: 28,  protein: 3.0, fat: 0.4, carbs: 3.2 },
  { title: 'Кабачок жареный',                                     kcal: 88,  protein: 1.5, fat: 6.8, carbs: 5.5 },
  { title: 'Баклажан жареный',                                    kcal: 128, protein: 1.2, fat: 11.5, carbs: 5.5 },
  { title: 'Авокадо',                                              kcal: 160, protein: 2.0, fat: 14.7, carbs: 8.5 },
  { title: 'Кукуруза консервированная',                           kcal: 58,  protein: 2.7, fat: 0.5, carbs: 12 },
  { title: 'Фасоль консервированная',                             kcal: 99,  protein: 6.7, fat: 0.4, carbs: 16.8 },
  { title: 'Горох консервированный',                              kcal: 55,  protein: 4.0, fat: 0.4, carbs: 8.3 },
  { title: 'Чечевица отварная',                                   kcal: 116, protein: 9.0, fat: 0.4, carbs: 20 },
  { title: 'Оливье',                                               kcal: 190, protein: 4.5, fat: 14,  carbs: 11 },
  { title: 'Салат Цезарь с курицей',                              kcal: 165, protein: 10, fat: 11,  carbs: 6 },
  { title: 'Салат овощной со сметаной',                           kcal: 65,  protein: 1.5, fat: 4.5, carbs: 5 },
  { title: 'Салат овощной с маслом',                              kcal: 85,  protein: 1.2, fat: 7,   carbs: 5 },
  { title: 'Квашеная капуста',                                    kcal: 19,  protein: 1.0, fat: 0.1, carbs: 3 },

  // --- Фрукты и ягоды ------------------------------------------------------------
  { title: 'Яблоко',                                               kcal: 47,  protein: 0.4, fat: 0.4, carbs: 9.8 },
  { title: 'Банан',                                                kcal: 96,  protein: 1.5, fat: 0.2, carbs: 21 },
  { title: 'Апельсин',                                             kcal: 43,  protein: 0.9, fat: 0.2, carbs: 8.1 },
  { title: 'Груша',                                                kcal: 42,  protein: 0.4, fat: 0.3, carbs: 10.3 },
  { title: 'Виноград',                                             kcal: 65,  protein: 0.6, fat: 0.2, carbs: 16.8 },
  { title: 'Мандарин',                                             kcal: 38,  protein: 0.8, fat: 0.2, carbs: 7.5 },
  { title: 'Клубника',                                             kcal: 33,  protein: 0.7, fat: 0.4, carbs: 6.3 },
  { title: 'Арбуз',                                                kcal: 27,  protein: 0.6, fat: 0.1, carbs: 5.8 },
  { title: 'Киви',                                                 kcal: 47,  protein: 0.8, fat: 0.4, carbs: 8.1 },
  { title: 'Хурма',                                                kcal: 66,  protein: 0.5, fat: 0.3, carbs: 15.3 },
  { title: 'Гранат',                                               kcal: 52,  protein: 0.9, fat: 0.3, carbs: 11.8 },
  { title: 'Изюм',                                                 kcal: 264, protein: 2.9, fat: 0.6, carbs: 66 },
  { title: 'Курага',                                               kcal: 232, protein: 5.2, fat: 0.3, carbs: 51 },
  { title: 'Финики',                                               kcal: 292, protein: 2.5, fat: 0.5, carbs: 69.2 },

  // --- Орехи, семена, сладости -----------------------------------------------
  { title: 'Грецкий орех',                                        kcal: 654, protein: 15.2, fat: 65.2, carbs: 7 },
  { title: 'Миндаль',                                              kcal: 579, protein: 21.2, fat: 49.9, carbs: 9.6 },
  { title: 'Фундук',                                               kcal: 628, protein: 15,  fat: 61,  carbs: 9.9 },
  { title: 'Кешью',                                                kcal: 553, protein: 18,  fat: 43.9, carbs: 30.2 },
  { title: 'Арахис жареный',                                      kcal: 590, protein: 26,  fat: 49,  carbs: 13.4 },
  { title: 'Семечки подсолнечника',                                kcal: 601, protein: 20.7, fat: 52.9, carbs: 10.5 },
  { title: 'Мёд',                                                  kcal: 329, protein: 0.8, fat: 0,   carbs: 81.5 },
  { title: 'Сахар',                                                kcal: 398, protein: 0,   fat: 0,   carbs: 99.8 },
  { title: 'Варенье',                                              kcal: 271, protein: 0.3, fat: 0.2, carbs: 68 },
  { title: 'Протеиновый батончик',                                kcal: 380, protein: 30,  fat: 13,  carbs: 38 },
  { title: 'Чипсы картофельные',                                  kcal: 536, protein: 6.6, fat: 35,  carbs: 51 },
  { title: 'Попкорн сладкий',                                     kcal: 480, protein: 6,   fat: 20,  carbs: 70 },
  { title: 'Сухарики',                                             kcal: 415, protein: 10,  fat: 18,  carbs: 55 },

  // --- Напитки ------------------------------------------------------------------
  { title: 'Кофе чёрный без сахара',                              kcal: 2,   protein: 0.2, fat: 0,   carbs: 0.3 },
  { title: 'Капучино на молоке',                                  kcal: 55,  protein: 3,   fat: 3,   carbs: 4.5 },
  { title: 'Чай чёрный без сахара',                                kcal: 1,   protein: 0,   fat: 0,   carbs: 0.3 },
  { title: 'Сок апельсиновый',                                    kcal: 45,  protein: 0.7, fat: 0.2, carbs: 10.4 },
  { title: 'Кола сладкая газировка',                              kcal: 42,  protein: 0,   fat: 0,   carbs: 10.6 },
  { title: 'Пиво светлое 4.5%',                                   kcal: 42,  protein: 0.3, fat: 0,   carbs: 3.5 },
  { title: 'Вино красное сухое',                                  kcal: 68,  protein: 0.2, fat: 0,   carbs: 0.3 },
  { title: 'Энергетический напиток',                              kcal: 45,  protein: 0,   fat: 0,   carbs: 11 },
  { title: 'Смузи фруктовый',                                     kcal: 60,  protein: 0.8, fat: 0.3, carbs: 14 },
  { title: 'Протеиновый коктейль на воде',                        kcal: 105, protein: 20,  fat: 1.5, carbs: 3 },

  // --- Фастфуд -------------------------------------------------------------------
  { title: 'Бургер с говядиной',                                  kcal: 250, protein: 12,  fat: 12,  carbs: 25 },
  { title: 'Хот-дог',                                              kcal: 266, protein: 10,  fat: 17,  carbs: 20 },
  { title: 'Наггетсы куриные',                                    kcal: 296, protein: 15,  fat: 19,  carbs: 17 },
  { title: 'Донер кебаб',                                          kcal: 220, protein: 12,  fat: 11,  carbs: 18 },
];

/* Поиск по локальной базе — без сети, мгновенно. Проверяет и title, и alias. */
function searchLocalFoodDb(query, limit = 12) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const item of FOOD_DB) {
    const title = item.title.toLowerCase();
    const alias = (item.alias || '').toLowerCase();
    let score = -1;
    if (title.startsWith(q)) score = 0;
    else if (title.includes(q)) score = 1;
    else if (alias.includes(q)) score = 2;
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score || a.item.title.length - b.item.title.length);
  return scored.slice(0, limit).map(s => ({
    title: s.item.title,
    per100: { kcal: s.item.kcal, protein: s.item.protein, fat: s.item.fat, carbs: s.item.carbs },
  }));
}
