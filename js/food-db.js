/* =========================================================================
   food-db.js — встроенный справочник КБЖУ на русском языке.

   Работает полностью офлайн, без ключей и интернета: ввёл название —
   получил готовые значения на 100 г. Цифры — типовые справочные величины
   (усреднённые показатели по стандартным таблицам пищевой ценности),
   а не результат лабораторного анализа конкретного продукта, поэтому для
   фабричных продуктов точнее штрихкод — там данные прямо с этикетки.

   Охватить буквально все существующие блюда и марки невозможно — их
   миллионы. Если чего-то нет здесь, ищи по штрихкоду, через «Найти по
   названию» (открытая база) или добавь вручную и сохрани в «Мои блюда» —
   дальше это будет подставляться в один тап, как и всё остальное здесь.
   ========================================================================= */

// { title, alias — доп. слова для поиска, kcal/protein/fat/carbs — на 100 г }
const FOOD_DB = [
  // =========================================================================
  // КРУПЫ, ГАРНИРЫ, МАКАРОНЫ
  // =========================================================================
  { title: 'Гречка отварная', alias: 'гречневая каша',           kcal: 132, protein: 4.5, fat: 1.1, carbs: 25 },
  { title: 'Гречка с грибами',                                    kcal: 118, protein: 3.8, fat: 3.5, carbs: 19 },
  { title: 'Рис отварной белый', alias: 'рисовая каша',          kcal: 116, protein: 2.2, fat: 0.5, carbs: 24 },
  { title: 'Рис бурый отварной',                                  kcal: 111, protein: 2.6, fat: 0.9, carbs: 23 },
  { title: 'Рис басмати отварной',                                kcal: 121, protein: 2.7, fat: 0.4, carbs: 25.7 },
  { title: 'Рис жасмин отварной',                                 kcal: 129, protein: 2.4, fat: 0.3, carbs: 28 },
  { title: 'Овсянка на воде', alias: 'овсяная каша геркулес',    kcal: 88,  protein: 3.0, fat: 1.7, carbs: 15 },
  { title: 'Овсянка на молоке',                                   kcal: 102, protein: 3.2, fat: 4.1, carbs: 14 },
  { title: 'Пшённая каша',                                        kcal: 135, protein: 4.7, fat: 2.3, carbs: 24 },
  { title: 'Перловая каша',                                       kcal: 106, protein: 3.1, fat: 0.4, carbs: 22 },
  { title: 'Ячневая каша',                                        kcal: 111, protein: 3.0, fat: 0.9, carbs: 22 },
  { title: 'Манная каша на молоке',                               kcal: 98,  protein: 3.0, fat: 3.2, carbs: 15 },
  { title: 'Кукурузная каша', alias: 'мамалыга',                 kcal: 86,  protein: 2.3, fat: 0.6, carbs: 17.5 },
  { title: 'Кускус отварной',                                     kcal: 112, protein: 3.8, fat: 0.2, carbs: 23 },
  { title: 'Булгур отварной',                                     kcal: 83,  protein: 3.1, fat: 0.2, carbs: 18 },
  { title: 'Киноа отварная',                                      kcal: 120, protein: 4.4, fat: 1.9, carbs: 21 },
  { title: 'Чечевица отварная',                                   kcal: 116, protein: 9.0, fat: 0.4, carbs: 20 },
  { title: 'Нут отварной',                                        kcal: 120, protein: 8.0, fat: 2.6, carbs: 17 },
  { title: 'Макароны отварные', alias: 'паста спагетти',         kcal: 112, protein: 3.5, fat: 0.4, carbs: 23 },
  { title: 'Макароны с сыром',                                    kcal: 190, protein: 7.5, fat: 8,   carbs: 22 },
  { title: 'Спагетти карбонара',                                  kcal: 195, protein: 8,   fat: 10,  carbs: 18 },
  { title: 'Спагетти болоньезе',                                  kcal: 150, protein: 7,   fat: 5,   carbs: 19 },
  { title: 'Лапша яичная отварная',                               kcal: 138, protein: 4.7, fat: 2.1, carbs: 25 },
  { title: 'Вермишель отварная',                                  kcal: 112, protein: 3.5, fat: 0.4, carbs: 23 },
  { title: 'Лагман (лапша с мясом)',                              kcal: 130, protein: 6.5, fat: 5,   carbs: 14 },
  { title: 'Картофель отварной', alias: 'картошка',              kcal: 82,  protein: 2.0, fat: 0.4, carbs: 16.7 },
  { title: 'Картофельное пюре',                                   kcal: 106, protein: 2.5, fat: 4.0, carbs: 14.7 },
  { title: 'Картофель жареный', alias: 'жареная картошка',       kcal: 192, protein: 2.8, fat: 10.2, carbs: 23.4 },
  { title: 'Картофель по-деревенски',                             kcal: 175, protein: 3,   fat: 8,   carbs: 22 },
  { title: 'Картофель фри',                                       kcal: 312, protein: 3.4, fat: 15.5, carbs: 41.1 },
  { title: 'Картофель запечённый',                                kcal: 93,  protein: 2.1, fat: 0.1, carbs: 21 },
  { title: 'Драники картофельные',                                kcal: 220, protein: 3.5, fat: 12,  carbs: 24 },

  // =========================================================================
  // МЯСО, ПТИЦА, СУБПРОДУКТЫ
  // =========================================================================
  { title: 'Куриная грудка отварная', alias: 'варёная курица',   kcal: 137, protein: 29.8, fat: 1.8, carbs: 0 },
  { title: 'Куриная грудка жареная',                              kcal: 190, protein: 27,   fat: 8.5, carbs: 1 },
  { title: 'Куриная грудка на гриле',                             kcal: 165, protein: 31,   fat: 3.6, carbs: 0 },
  { title: 'Курица жареная (с кожей)',                            kcal: 218, protein: 20.5, fat: 15,  carbs: 0 },
  { title: 'Курица запечённая целиком',                           kcal: 190, protein: 22,   fat: 11,  carbs: 0 },
  { title: 'Куриные бёдра запечённые',                            kcal: 209, protein: 24,   fat: 12,  carbs: 0 },
  { title: 'Куриные крылышки жареные',                            kcal: 290, protein: 18,   fat: 24,  carbs: 0 },
  { title: 'Куриные крылышки BBQ',                                kcal: 250, protein: 17,   fat: 17,  carbs: 8 },
  { title: 'Куриные голени запечённые',                           kcal: 185, protein: 22,   fat: 10,  carbs: 0 },
  { title: 'Куриная котлета',                                     kcal: 175, protein: 17,   fat: 9,   carbs: 6 },
  { title: 'Куриные наггетсы',                                    kcal: 296, protein: 15,   fat: 19,  carbs: 17 },
  { title: 'Индейка отварная',                                    kcal: 130, protein: 25,   fat: 3,   carbs: 0 },
  { title: 'Индейка запечённая',                                  kcal: 160, protein: 27,   fat: 5.5, carbs: 0 },
  { title: 'Утка запечённая',                                     kcal: 337, protein: 19,   fat: 28,  carbs: 0 },
  { title: 'Гусь запечённый',                                     kcal: 320, protein: 22,   fat: 25,  carbs: 0 },
  { title: 'Говядина отварная',                                   kcal: 254, protein: 25.8, fat: 16.8, carbs: 0 },
  { title: 'Говядина тушёная',                                    kcal: 232, protein: 22,   fat: 16,  carbs: 0 },
  { title: 'Говяжий стейк',                                       kcal: 250, protein: 26,   fat: 16,  carbs: 0 },
  { title: 'Говядина запечённая',                                 kcal: 220, protein: 27,   fat: 12,  carbs: 0 },
  { title: 'Бефстроганов',                                        kcal: 220, protein: 14,   fat: 15,  carbs: 5 },
  { title: 'Гуляш говяжий',                                       kcal: 180, protein: 15,   fat: 11,  carbs: 5 },
  { title: 'Баранина жареная',                                    kcal: 316, protein: 22,   fat: 25,  carbs: 0 },
  { title: 'Баранина отварная',                                   kcal: 235, protein: 24,   fat: 15,  carbs: 0 },
  { title: 'Свинина жареная',                                     kcal: 357, protein: 19.6, fat: 30.9, carbs: 0 },
  { title: 'Свинина запечённая',                                  kcal: 280, protein: 23,   fat: 20,  carbs: 0 },
  { title: 'Свиная отбивная',                                     kcal: 265, protein: 22,   fat: 19,  carbs: 1 },
  { title: 'Свиные рёбра',                                        kcal: 320, protein: 21,   fat: 26,  carbs: 0 },
  { title: 'Свиной шашлык', alias: 'шашлык свиной',               kcal: 270, protein: 21,   fat: 20,  carbs: 1 },
  { title: 'Куриный шашлык',                                      kcal: 180, protein: 22,   fat: 9,   carbs: 1 },
  { title: 'Фарш говяжий жареный',                                kcal: 254, protein: 22,   fat: 18,  carbs: 0 },
  { title: 'Фарш свиной жареный',                                 kcal: 300, protein: 17,   fat: 25,  carbs: 0 },
  { title: 'Котлета мясная жареная',                              kcal: 220, protein: 15,   fat: 15,  carbs: 8 },
  { title: 'Тефтели в соусе',                                     kcal: 170, protein: 11,   fat: 10,  carbs: 8 },
  { title: 'Зразы мясные',                                        kcal: 210, protein: 14,   fat: 13,  carbs: 8 },
  { title: 'Печень куриная тушёная',                              kcal: 166, protein: 20,   fat: 7,   carbs: 4 },
  { title: 'Печень говяжья жареная',                              kcal: 199, protein: 21,   fat: 11,  carbs: 5 },
  { title: 'Сердце говяжье отварное',                             kcal: 158, protein: 22,   fat: 7,   carbs: 0 },
  { title: 'Язык говяжий отварной',                                kcal: 231, protein: 20,   fat: 16,  carbs: 0 },
  { title: 'Сосиски отварные',                                    kcal: 266, protein: 10.5, fat: 24,  carbs: 1.5 },
  { title: 'Сардельки отварные',                                  kcal: 270, protein: 11,   fat: 24,  carbs: 2 },
  { title: 'Колбаса варёная', alias: 'докторская',                kcal: 257, protein: 12,   fat: 22.5, carbs: 1.5 },
  { title: 'Колбаса копчёная',                                    kcal: 420, protein: 17,   fat: 39,  carbs: 0 },
  { title: 'Колбаса полукопчёная',                                kcal: 350, protein: 16,   fat: 31,  carbs: 1 },
  { title: 'Ветчина',                                              kcal: 170, protein: 17,   fat: 11,  carbs: 1 },
  { title: 'Бекон жареный',                                       kcal: 500, protein: 25,   fat: 42,  carbs: 1 },
  { title: 'Сало солёное',                                        kcal: 797, protein: 2.4,  fat: 89,  carbs: 0 },
  { title: 'Пельмени отварные',                                   kcal: 220, protein: 11.5, fat: 9,   carbs: 24 },
  { title: 'Вареники с картошкой',                                kcal: 165, protein: 5,    fat: 3.5, carbs: 29 },
  { title: 'Вареники с творогом',                                 kcal: 190, protein: 8,    fat: 6,   carbs: 27 },
  { title: 'Голубцы с мясом',                                     kcal: 110, protein: 6,    fat: 5.5, carbs: 9.5 },
  { title: 'Фаршированный перец',                                 kcal: 105, protein: 5.5,  fat: 5,   carbs: 9 },

  // =========================================================================
  // НАЦИОНАЛЬНАЯ КУХНЯ: КАЗАХСКАЯ, СРЕДНЕАЗИАТСКАЯ, КАВКАЗСКАЯ
  // =========================================================================
  { title: 'Плов с мясом',                                        kcal: 200, protein: 8.5, fat: 8.5, carbs: 24 },
  { title: 'Плов с курицей',                                      kcal: 185, protein: 9,   fat: 6,   carbs: 25 },
  { title: 'Бешбармак с говядиной',                               kcal: 210, protein: 12,  fat: 10,  carbs: 17 },
  { title: 'Бешбармак с бараниной',                               kcal: 240, protein: 11,  fat: 15,  carbs: 16 },
  { title: 'Манты с бараниной',                                   kcal: 220, protein: 10,  fat: 12,  carbs: 18 },
  { title: 'Манты с говядиной',                                   kcal: 200, protein: 11,  fat: 9,   carbs: 18 },
  { title: 'Манты с тыквой',                                      kcal: 160, protein: 5,   fat: 5,   carbs: 24 },
  { title: 'Самса с мясом',                                       kcal: 260, protein: 10,  fat: 15,  carbs: 22 },
  { title: 'Самса с тыквой',                                      kcal: 220, protein: 5,   fat: 12,  carbs: 24 },
  { title: 'Куырдак',                                              kcal: 260, protein: 16,  fat: 20,  carbs: 4 },
  { title: 'Казы (конская колбаса)',                              kcal: 330, protein: 14,  fat: 30,  carbs: 0 },
  { title: 'Баурсаки', alias: 'боорсоки',                        kcal: 320, protein: 6,   fat: 15,  carbs: 40 },
  { title: 'Лепёшка',                                              kcal: 265, protein: 8,   fat: 3,   carbs: 51 },
  { title: 'Шурпа',                                                kcal: 60,  protein: 4,   fat: 3,   carbs: 4.5 },
  { title: 'Лагман суп',                                          kcal: 75,  protein: 4.5, fat: 3.5, carbs: 7 },
  { title: 'Хинкали',                                              kcal: 200, protein: 10,  fat: 8,   carbs: 22 },
  { title: 'Хачапури по-аджарски',                                 kcal: 290, protein: 10,  fat: 17,  carbs: 24 },
  { title: 'Хачапури имеретинское',                                kcal: 270, protein: 9,   fat: 14,  carbs: 27 },
  { title: 'Чахохбили',                                            kcal: 130, protein: 12,  fat: 7,   carbs: 4 },
  { title: 'Харчо',                                                kcal: 75,  protein: 4.5, fat: 4.5, carbs: 5 },
  { title: 'Сациви',                                               kcal: 210, protein: 14,  fat: 15,  carbs: 5 },
  { title: 'Долма (голубцы в листьях винограда)',                 kcal: 150, protein: 6,   fat: 9,   carbs: 12 },
  { title: 'Люля-кебаб',                                          kcal: 240, protein: 16,  fat: 19,  carbs: 2 },
  { title: 'Чебурек с мясом',                                     kcal: 270, protein: 9,   fat: 17,  carbs: 20 },
  { title: 'Кутаб с зеленью',                                     kcal: 190, protein: 6,   fat: 7,   carbs: 26 },
  { title: 'Долма из капусты',                                    kcal: 95,  protein: 5,   fat: 4,   carbs: 9 },
  { title: 'Айран', alias: 'ayran',                               kcal: 32,  protein: 1.1, fat: 1.5, carbs: 3.5 },
  { title: 'Кумыс',                                                kcal: 50,  protein: 2.1, fat: 1.9, carbs: 5 },
  { title: 'Шубат (верблюжье кислое молоко)',                     kcal: 60,  protein: 3.5, fat: 3,   carbs: 4.5 },
  { title: 'Курт (сушёный сырок)',                                kcal: 385, protein: 22,  fat: 24,  carbs: 15 },
  { title: 'Чак-чак',                                              kcal: 400, protein: 6,   fat: 14,  carbs: 63 },
  { title: 'Пахлава',                                              kcal: 480, protein: 6,   fat: 28,  carbs: 50 },

  // =========================================================================
  // РЫБА И МОРЕПРОДУКТЫ
  // =========================================================================
  { title: 'Лосось запечённый', alias: 'сёмга',                  kcal: 208, protein: 22, fat: 13,  carbs: 0 },
  { title: 'Лосось на гриле',                                     kcal: 200, protein: 23, fat: 12,  carbs: 0 },
  { title: 'Лосось слабосолёный',                                 kcal: 195, protein: 21, fat: 12,  carbs: 0 },
  { title: 'Форель запечённая',                                   kcal: 175, protein: 22, fat: 9,   carbs: 0 },
  { title: 'Треска отварная',                                     kcal: 78,  protein: 17.8, fat: 0.7, carbs: 0 },
  { title: 'Треска жареная',                                      kcal: 150, protein: 18, fat: 8,   carbs: 3 },
  { title: 'Минтай отварной',                                     kcal: 79,  protein: 17.1, fat: 0.9, carbs: 0 },
  { title: 'Хек отварной',                                        kcal: 86,  protein: 16.6, fat: 2.2, carbs: 0 },
  { title: 'Судак отварной',                                      kcal: 84,  protein: 18.4, fat: 1.1, carbs: 0 },
  { title: 'Карп жареный',                                        kcal: 196, protein: 16, fat: 14,  carbs: 3 },
  { title: 'Скумбрия копчёная',                                   kcal: 317, protein: 18, fat: 27,  carbs: 0 },
  { title: 'Сельдь солёная',                                      kcal: 217, protein: 17, fat: 16,  carbs: 0 },
  { title: 'Шпроты в масле',                                      kcal: 280, protein: 17, fat: 23,  carbs: 0.4 },
  { title: 'Сайра консервированная',                               kcal: 260, protein: 20, fat: 20,  carbs: 0 },
  { title: 'Тунец консервированный (в собств. соку)',             kcal: 96,  protein: 22, fat: 1,   carbs: 0 },
  { title: 'Тунец консервированный (в масле)',                    kcal: 190, protein: 24, fat: 10,  carbs: 0 },
  { title: 'Креветки отварные',                                   kcal: 95,  protein: 20, fat: 1.7, carbs: 0 },
  { title: 'Креветки жареные в чесноке',                          kcal: 150, protein: 20, fat: 7,   carbs: 2 },
  { title: 'Мидии отварные',                                      kcal: 77,  protein: 11.5, fat: 2,  carbs: 3.3 },
  { title: 'Кальмары отварные',                                   kcal: 92,  protein: 18,  fat: 2.2, carbs: 0 },
  { title: 'Кальмары жареные в кляре',                            kcal: 175, protein: 13,  fat: 9,   carbs: 10 },
  { title: 'Осьминог отварной',                                   kcal: 82,  protein: 14.9, fat: 1,  carbs: 2.2 },
  { title: 'Крабовые палочки',                                    kcal: 95,  protein: 8.7, fat: 1,   carbs: 12.1 },
  { title: 'Красная икра',                                        kcal: 250, protein: 32, fat: 13,  carbs: 0 },
  { title: 'Чёрная икра',                                         kcal: 264, protein: 26, fat: 18,  carbs: 4 },
  { title: 'Рыба жареная в кляре',                                kcal: 230, protein: 15, fat: 15,  carbs: 8 },
  { title: 'Рыбные котлеты',                                      kcal: 150, protein: 12, fat: 7,   carbs: 9 },
  { title: 'Уха',                                                  kcal: 45,  protein: 5.5, fat: 1.5, carbs: 2.5 },
  { title: 'Роллы с лососем', alias: 'филадельфия',               kcal: 176, protein: 7,   fat: 5,   carbs: 25 },
  { title: 'Роллы с огурцом (капкаяки)',                          kcal: 130, protein: 3,   fat: 1,   carbs: 27 },
  { title: 'Суши сет',                                             kcal: 150, protein: 6.5, fat: 3,   carbs: 24 },

  // =========================================================================
  // ЯЙЦА, ЗАВТРАКИ
  // =========================================================================
  { title: 'Яйцо варёное', alias: 'вкрутую',                      kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1 },
  { title: 'Яйцо всмятку',                                        kcal: 150, protein: 12.5, fat: 10.5, carbs: 0.7 },
  { title: 'Яичница из 2 яиц',                                    kcal: 196, protein: 13, fat: 15,  carbs: 1 },
  { title: 'Яичница с беконом',                                   kcal: 280, protein: 17, fat: 22,  carbs: 1 },
  { title: 'Омлет из 2 яиц',                                      kcal: 184, protein: 12, fat: 14,  carbs: 2 },
  { title: 'Омлет с сыром',                                       kcal: 210, protein: 14, fat: 16,  carbs: 2 },
  { title: 'Омлет с овощами',                                     kcal: 140, protein: 10, fat: 9,   carbs: 4 },
  { title: 'Мюсли с молоком',                                     kcal: 150, protein: 4.5, fat: 3.5, carbs: 26 },
  { title: 'Хлопья кукурузные с молоком',                          kcal: 130, protein: 3.5, fat: 2,  carbs: 25 },
  { title: 'Гранола',                                              kcal: 470, protein: 10, fat: 20,  carbs: 62 },
  { title: 'Панкейки', alias: 'американские блинчики',            kcal: 227, protein: 6,   fat: 7,   carbs: 35 },
  { title: 'Тосты с авокадо',                                     kcal: 210, protein: 5,   fat: 12,  carbs: 20 },
  { title: 'Бутерброд с колбасой и сыром',                        kcal: 280, protein: 13, fat: 17,  carbs: 20 },
  { title: 'Бутерброд с маслом и сыром',                          kcal: 300, protein: 11, fat: 20,  carbs: 20 },

  // =========================================================================
  // МОЛОЧНЫЕ ПРОДУКТЫ И СЫРЫ
  // =========================================================================
  { title: 'Молоко 3.2%',                                         kcal: 60,  protein: 2.9, fat: 3.2, carbs: 4.7 },
  { title: 'Молоко 1.5%',                                         kcal: 44,  protein: 3.0, fat: 1.5, carbs: 4.8 },
  { title: 'Молоко 0.5% обезжиренное',                            kcal: 35,  protein: 3.0, fat: 0.5, carbs: 5.0 },
  { title: 'Молоко топлёное',                                     kcal: 84,  protein: 2.9, fat: 6,   carbs: 4.7 },
  { title: 'Кефир 2.5%',                                          kcal: 53,  protein: 2.9, fat: 2.5, carbs: 4.0 },
  { title: 'Кефир 1%',                                            kcal: 40,  protein: 3.0, fat: 1.0, carbs: 4.0 },
  { title: 'Ряженка',                                              kcal: 67,  protein: 2.9, fat: 4.0, carbs: 4.2 },
  { title: 'Простокваша',                                          kcal: 58,  protein: 2.9, fat: 3.2, carbs: 4.1 },
  { title: 'Йогурт натуральный без добавок',                     kcal: 66,  protein: 5,   fat: 3.2, carbs: 3.5 },
  { title: 'Йогурт питьевой с фруктами',                          kcal: 85,  protein: 3,   fat: 2.5, carbs: 13 },
  { title: 'Йогурт греческий', alias: 'греческий йогурт',        kcal: 97,  protein: 9,   fat: 5,   carbs: 4 },
  { title: 'Йогурт с мюсли',                                      kcal: 130, protein: 4,   fat: 4,   carbs: 20 },
  { title: 'Творог 5%',                                           kcal: 121, protein: 17.2, fat: 5,  carbs: 1.8 },
  { title: 'Творог 9%',                                           kcal: 159, protein: 16.7, fat: 9,  carbs: 2.0 },
  { title: 'Творог обезжиренный',                                 kcal: 71,  protein: 16.5, fat: 0.6, carbs: 1.3 },
  { title: 'Творожная масса с изюмом',                            kcal: 220, protein: 9,   fat: 8,   carbs: 28 },
  { title: 'Сырок глазированный',                                 kcal: 400, protein: 8,   fat: 27,  carbs: 32 },
  { title: 'Сметана 20%',                                         kcal: 206, protein: 2.8, fat: 20,  carbs: 3.2 },
  { title: 'Сметана 10%',                                         kcal: 115, protein: 3.0, fat: 10,  carbs: 3.5 },
  { title: 'Сливки 20%',                                          kcal: 205, protein: 2.8, fat: 20,  carbs: 3.7 },
  { title: 'Сыр твёрдый (типа российского)',                     kcal: 363, protein: 24,  fat: 29,  carbs: 0.3 },
  { title: 'Сыр гауда',                                            kcal: 356, protein: 25,  fat: 27,  carbs: 2.2 },
  { title: 'Сыр чеддер',                                           kcal: 402, protein: 25,  fat: 33,  carbs: 1.3 },
  { title: 'Сыр пармезан',                                         kcal: 431, protein: 38,  fat: 29,  carbs: 4.1 },
  { title: 'Сыр моцарелла',                                        kcal: 280, protein: 22,  fat: 21,  carbs: 2.2 },
  { title: 'Сыр фета',                                             kcal: 264, protein: 14,  fat: 21,  carbs: 4 },
  { title: 'Сыр брынза',                                           kcal: 260, protein: 17,  fat: 20,  carbs: 0 },
  { title: 'Сыр дор блю (с плесенью)',                            kcal: 353, protein: 21,  fat: 29,  carbs: 2 },
  { title: 'Сыр плавленый',                                       kcal: 270, protein: 12,  fat: 22,  carbs: 5 },
  { title: 'Сыр косичка (чечил)',                                 kcal: 313, protein: 27,  fat: 20,  carbs: 2 },
  { title: 'Сливочное масло',                                     kcal: 748, protein: 0.5, fat: 82.5, carbs: 0.8 },
  { title: 'Маргарин',                                             kcal: 743, protein: 0.3, fat: 82,  carbs: 1 },
  { title: 'Мороженое пломбир',                                   kcal: 227, protein: 3.7, fat: 15,  carbs: 20 },
  { title: 'Мороженое шоколадное',                                kcal: 216, protein: 3.9, fat: 11,  carbs: 24.6 },
  { title: 'Мороженое эскимо',                                    kcal: 270, protein: 3.5, fat: 18,  carbs: 24 },

  // =========================================================================
  // ХЛЕБ, ВЫПЕЧКА, ДЕСЕРТЫ
  // =========================================================================
  { title: 'Хлеб белый', alias: 'батон',                          kcal: 265, protein: 7.7, fat: 2.4, carbs: 53.3 },
  { title: 'Хлеб чёрный ржаной',                                  kcal: 214, protein: 6.6, fat: 1.2, carbs: 40.7 },
  { title: 'Хлеб цельнозерновой',                                 kcal: 246, protein: 10.7, fat: 3.3, carbs: 43.3 },
  { title: 'Хлеб бородинский',                                    kcal: 208, protein: 6.8, fat: 1.3, carbs: 40.7 },
  { title: 'Лаваш',                                                kcal: 236, protein: 7.9, fat: 1.0, carbs: 47.6 },
  { title: 'Пита',                                                 kcal: 275, protein: 9,   fat: 1.2, carbs: 55.7 },
  { title: 'Блины',                                                kcal: 233, protein: 6.1, fat: 7.4, carbs: 34.7 },
  { title: 'Блины с творогом',                                    kcal: 210, protein: 8,   fat: 8,   carbs: 27 },
  { title: 'Блины со сгущёнкой',                                  kcal: 280, protein: 6,   fat: 9,   carbs: 45 },
  { title: 'Сырники',                                              kcal: 220, protein: 15,  fat: 10,  carbs: 18 },
  { title: 'Оладьи',                                               kcal: 217, protein: 6.4, fat: 6.5, carbs: 34 },
  { title: 'Круассан',                                             kcal: 406, protein: 8.2, fat: 21,  carbs: 46 },
  { title: 'Круассан с шоколадом',                                kcal: 440, protein: 7,   fat: 24,  carbs: 50 },
  { title: 'Пицца Маргарита (кусок)',                             kcal: 266, protein: 11,  fat: 10,  carbs: 33 },
  { title: 'Пицца пепперони (кусок)',                              kcal: 298, protein: 12,  fat: 13,  carbs: 33 },
  { title: 'Пирожок с мясом жареный',                             kcal: 260, protein: 8,   fat: 12,  carbs: 30 },
  { title: 'Пирожок с капустой жареный',                          kcal: 220, protein: 4,   fat: 9,   carbs: 30 },
  { title: 'Пирожок с яблоком печёный',                           kcal: 230, protein: 4.5, fat: 6,   carbs: 40 },
  { title: 'Беляш',                                                kcal: 300, protein: 10,  fat: 17,  carbs: 25 },
  { title: 'Пирог с курицей',                                     kcal: 260, protein: 10,  fat: 13,  carbs: 26 },
  { title: 'Торт бисквитный с кремом',                            kcal: 340, protein: 4.5, fat: 15,  carbs: 48 },
  { title: 'Торт медовик',                                        kcal: 380, protein: 5,   fat: 20,  carbs: 44 },
  { title: 'Торт наполеон',                                       kcal: 400, protein: 5,   fat: 26,  carbs: 38 },
  { title: 'Чизкейк',                                              kcal: 321, protein: 5.5, fat: 22,  carbs: 26 },
  { title: 'Тирамису',                                             kcal: 290, protein: 5,   fat: 18,  carbs: 27 },
  { title: 'Эклер с кремом',                                       kcal: 340, protein: 5,   fat: 21,  carbs: 33 },
  { title: 'Штрудель яблочный',                                   kcal: 250, protein: 3,   fat: 10,  carbs: 37 },
  { title: 'Печенье песочное',                                    kcal: 435, protein: 6.5, fat: 18,  carbs: 65 },
  { title: 'Печенье овсяное',                                     kcal: 420, protein: 6,   fat: 16,  carbs: 65 },
  { title: 'Печенье с шоколадной крошкой',                         kcal: 480, protein: 5.5, fat: 24,  carbs: 62 },
  { title: 'Вафли с начинкой',                                    kcal: 430, protein: 4,   fat: 20,  carbs: 60 },
  { title: 'Кекс',                                                 kcal: 380, protein: 5,   fat: 16,  carbs: 54 },
  { title: 'Булочка с корицей',                                   kcal: 410, protein: 6,   fat: 15,  carbs: 62 },
  { title: 'Пончик',                                               kcal: 400, protein: 5,   fat: 22,  carbs: 46 },
  { title: 'Пряник',                                               kcal: 350, protein: 4.8, fat: 3,   carbs: 76 },
  { title: 'Шоколад молочный',                                    kcal: 534, protein: 6.9, fat: 30,  carbs: 58 },
  { title: 'Шоколад тёмный 70%',                                  kcal: 546, protein: 7.8, fat: 38,  carbs: 46 },
  { title: 'Шоколад белый',                                       kcal: 541, protein: 5.9, fat: 32,  carbs: 57 },

  // =========================================================================
  // СУПЫ
  // =========================================================================
  { title: 'Борщ со сметаной',                                    kcal: 55,  protein: 2.2, fat: 2.5, carbs: 6.2 },
  { title: 'Щи',                                                   kcal: 41,  protein: 1.8, fat: 2.0, carbs: 4.3 },
  { title: 'Куриный суп с лапшой',                                kcal: 40,  protein: 3.2, fat: 1.5, carbs: 3.7 },
  { title: 'Солянка мясная',                                      kcal: 105, protein: 6.5, fat: 7.5, carbs: 3.5 },
  { title: 'Суп-пюре овощной',                                    kcal: 45,  protein: 1.5, fat: 1.8, carbs: 6 },
  { title: 'Суп-пюре тыквенный',                                  kcal: 55,  protein: 1.8, fat: 2.2, carbs: 7.5 },
  { title: 'Гороховый суп',                                       kcal: 65,  protein: 4.5, fat: 2.5, carbs: 7 },
  { title: 'Грибной суп',                                         kcal: 38,  protein: 2.5, fat: 1.5, carbs: 4 },
  { title: 'Окрошка на кефире',                                   kcal: 45,  protein: 3,   fat: 2,   carbs: 4 },
  { title: 'Окрошка на квасе',                                    kcal: 50,  protein: 2.5, fat: 1.5, carbs: 7 },
  { title: 'Рассольник',                                           kcal: 42,  protein: 2.5, fat: 1.8, carbs: 4.5 },
  { title: 'Том ям',                                               kcal: 55,  protein: 5,   fat: 2.5, carbs: 3 },
  { title: 'Рамен с курицей',                                     kcal: 90,  protein: 5,   fat: 3,   carbs: 10 },
  { title: 'Крем-суп из шампиньонов',                              kcal: 60,  protein: 2,   fat: 3.5, carbs: 5.5 },

  // =========================================================================
  // ОВОЩИ И ОВОЩНЫЕ БЛЮДА
  // =========================================================================
  { title: 'Помидор', alias: 'томат свежий',                      kcal: 20,  protein: 0.9, fat: 0.2, carbs: 3.9 },
  { title: 'Огурец свежий',                                       kcal: 15,  protein: 0.8, fat: 0.1, carbs: 2.8 },
  { title: 'Капуста белокочанная свежая',                         kcal: 27,  protein: 1.8, fat: 0.1, carbs: 4.7 },
  { title: 'Капуста тушёная',                                     kcal: 75,  protein: 1.9, fat: 5,   carbs: 6 },
  { title: 'Морковь свежая',                                      kcal: 32,  protein: 1.3, fat: 0.1, carbs: 6.9 },
  { title: 'Морковь по-корейски',                                 kcal: 130, protein: 1.2, fat: 10,  carbs: 8 },
  { title: 'Свёкла отварная',                                     kcal: 44,  protein: 1.7, fat: 0.1, carbs: 8.8 },
  { title: 'Лук репчатый',                                        kcal: 41,  protein: 1.4, fat: 0.2, carbs: 8.2 },
  { title: 'Лук жареный',                                          kcal: 155, protein: 1.5, fat: 12,  carbs: 10 },
  { title: 'Перец болгарский',                                    kcal: 27,  protein: 1.3, fat: 0.1, carbs: 5.3 },
  { title: 'Брокколи отварная',                                   kcal: 28,  protein: 3.0, fat: 0.4, carbs: 3.2 },
  { title: 'Цветная капуста отварная',                            kcal: 25,  protein: 1.8, fat: 0.3, carbs: 4.2 },
  { title: 'Кабачок жареный',                                     kcal: 88,  protein: 1.5, fat: 6.8, carbs: 5.5 },
  { title: 'Кабачковая икра',                                      kcal: 95,  protein: 1.5, fat: 6.5, carbs: 8 },
  { title: 'Баклажан жареный',                                    kcal: 128, protein: 1.2, fat: 11.5, carbs: 5.5 },
  { title: 'Баклажанная икра',                                    kcal: 100, protein: 1.5, fat: 7,   carbs: 8 },
  { title: 'Авокадо',                                              kcal: 160, protein: 2.0, fat: 14.7, carbs: 8.5 },
  { title: 'Кукуруза консервированная',                           kcal: 58,  protein: 2.7, fat: 0.5, carbs: 12 },
  { title: 'Кукуруза варёная',                                     kcal: 96,  protein: 3.4, fat: 1.5, carbs: 21 },
  { title: 'Фасоль консервированная',                              kcal: 99,  protein: 6.7, fat: 0.4, carbs: 16.8 },
  { title: 'Фасоль тушёная в томате',                              kcal: 105, protein: 6.5, fat: 3,   carbs: 14 },
  { title: 'Горох консервированный',                               kcal: 55,  protein: 4.0, fat: 0.4, carbs: 8.3 },
  { title: 'Овощное рагу',                                         kcal: 70,  protein: 1.8, fat: 3.5, carbs: 8.5 },
  { title: 'Рататуй',                                              kcal: 65,  protein: 1.5, fat: 3.5, carbs: 7 },
  { title: 'Лечо',                                                 kcal: 75,  protein: 1.2, fat: 4,   carbs: 9 },
  { title: 'Грибы жареные',                                       kcal: 80,  protein: 3.5, fat: 5.5, carbs: 3.5 },
  { title: 'Шампиньоны маринованные',                              kcal: 32,  protein: 2.5, fat: 0.3, carbs: 4.5 },
  { title: 'Оливье',                                               kcal: 190, protein: 4.5, fat: 14,  carbs: 11 },
  { title: 'Винегрет',                                             kcal: 105, protein: 1.7, fat: 6,   carbs: 11 },
  { title: 'Салат Цезарь с курицей',                              kcal: 165, protein: 10,  fat: 11,  carbs: 6 },
  { title: 'Салат овощной со сметаной',                           kcal: 65,  protein: 1.5, fat: 4.5, carbs: 5 },
  { title: 'Салат овощной с маслом',                              kcal: 85,  protein: 1.2, fat: 7,   carbs: 5 },
  { title: 'Салат греческий',                                     kcal: 110, protein: 3,   fat: 9,   carbs: 4.5 },
  { title: 'Салат крабовый',                                       kcal: 195, protein: 5,   fat: 15,  carbs: 10 },
  { title: 'Салат мимоза',                                         kcal: 200, protein: 10,  fat: 15,  carbs: 6 },
  { title: 'Салат сельдь под шубой',                               kcal: 175, protein: 5,   fat: 13,  carbs: 9 },
  { title: 'Квашеная капуста',                                    kcal: 19,  protein: 1.0, fat: 0.1, carbs: 3 },
  { title: 'Огурцы солёные',                                      kcal: 11,  protein: 0.8, fat: 0.1, carbs: 1.7 },
  { title: 'Помидоры маринованные',                                kcal: 18,  protein: 0.9, fat: 0.1, carbs: 3 },
  { title: 'Морская капуста',                                      kcal: 25,  protein: 0.9, fat: 0.2, carbs: 3 },

  // =========================================================================
  // КОРЕЙСКИЕ САЛАТЫ И ЗАКУСКИ (рыночные)
  // =========================================================================
  { title: 'Папоротник по-корейски',                               kcal: 115, protein: 2.5, fat: 8,   carbs: 8 },
  { title: 'Кальмары по-корейски',                                kcal: 145, protein: 12,  fat: 9,   carbs: 5 },
  { title: 'Баклажаны по-корейски',                                kcal: 140, protein: 1.5, fat: 11,  carbs: 8 },
  { title: 'Фунчоза с овощами',                                    kcal: 105, protein: 1.5, fat: 5,   carbs: 14 },
  { title: 'Пекинская капуста по-корейски (кимчи)',                kcal: 45,  protein: 1.8, fat: 1.5, carbs: 6 },

  // =========================================================================
  // ФРУКТЫ И ЯГОДЫ
  // =========================================================================
  { title: 'Яблоко',                                               kcal: 47,  protein: 0.4, fat: 0.4, carbs: 9.8 },
  { title: 'Банан',                                                kcal: 96,  protein: 1.5, fat: 0.2, carbs: 21 },
  { title: 'Апельсин',                                             kcal: 43,  protein: 0.9, fat: 0.2, carbs: 8.1 },
  { title: 'Мандарин',                                             kcal: 38,  protein: 0.8, fat: 0.2, carbs: 7.5 },
  { title: 'Грейпфрут',                                            kcal: 35,  protein: 0.7, fat: 0.2, carbs: 6.5 },
  { title: 'Лимон',                                                kcal: 29,  protein: 0.9, fat: 0.1, carbs: 3 },
  { title: 'Груша',                                                kcal: 42,  protein: 0.4, fat: 0.3, carbs: 10.3 },
  { title: 'Виноград',                                             kcal: 65,  protein: 0.6, fat: 0.2, carbs: 16.8 },
  { title: 'Персик',                                               kcal: 39,  protein: 0.9, fat: 0.1, carbs: 9.5 },
  { title: 'Абрикос',                                              kcal: 41,  protein: 0.9, fat: 0.1, carbs: 9 },
  { title: 'Слива',                                                kcal: 42,  protein: 0.7, fat: 0.3, carbs: 9.6 },
  { title: 'Черешня',                                              kcal: 50,  protein: 1.1, fat: 0.4, carbs: 10.6 },
  { title: 'Вишня',                                                kcal: 52,  protein: 0.8, fat: 0.5, carbs: 11.3 },
  { title: 'Клубника',                                             kcal: 33,  protein: 0.7, fat: 0.4, carbs: 6.3 },
  { title: 'Малина',                                               kcal: 46,  protein: 1.2, fat: 0.7, carbs: 8.3 },
  { title: 'Черника',                                               kcal: 44,  protein: 1.1, fat: 0.4, carbs: 7.6 },
  { title: 'Ежевика',                                               kcal: 34,  protein: 1.5, fat: 0.4, carbs: 5 },
  { title: 'Смородина чёрная',                                     kcal: 44,  protein: 1.0, fat: 0.4, carbs: 7.3 },
  { title: 'Крыжовник',                                            kcal: 44,  protein: 0.7, fat: 0.2, carbs: 9.1 },
  { title: 'Арбуз',                                                kcal: 27,  protein: 0.6, fat: 0.1, carbs: 5.8 },
  { title: 'Дыня',                                                  kcal: 34,  protein: 0.6, fat: 0.3, carbs: 7.4 },
  { title: 'Киви',                                                 kcal: 47,  protein: 0.8, fat: 0.4, carbs: 8.1 },
  { title: 'Хурма',                                                 kcal: 66,  protein: 0.5, fat: 0.3, carbs: 15.3 },
  { title: 'Гранат',                                                kcal: 52,  protein: 0.9, fat: 0.3, carbs: 11.8 },
  { title: 'Манго',                                                 kcal: 60,  protein: 0.8, fat: 0.4, carbs: 14.8 },
  { title: 'Ананас',                                                kcal: 49,  protein: 0.5, fat: 0.1, carbs: 11.8 },
  { title: 'Папайя',                                                kcal: 43,  protein: 0.5, fat: 0.3, carbs: 10.8 },
  { title: 'Изюм',                                                  kcal: 264, protein: 2.9, fat: 0.6, carbs: 66 },
  { title: 'Курага',                                                kcal: 232, protein: 5.2, fat: 0.3, carbs: 51 },
  { title: 'Чернослив',                                             kcal: 231, protein: 2.3, fat: 0.6, carbs: 57.5 },
  { title: 'Финики',                                                kcal: 292, protein: 2.5, fat: 0.5, carbs: 69.2 },

  // =========================================================================
  // ОРЕХИ, СЕМЕНА, СЛАДОСТИ
  // =========================================================================
  { title: 'Грецкий орех',                                        kcal: 654, protein: 15.2, fat: 65.2, carbs: 7 },
  { title: 'Миндаль',                                              kcal: 579, protein: 21.2, fat: 49.9, carbs: 9.6 },
  { title: 'Фундук',                                                kcal: 628, protein: 15,   fat: 61,   carbs: 9.9 },
  { title: 'Кешью',                                                 kcal: 553, protein: 18,   fat: 43.9, carbs: 30.2 },
  { title: 'Фисташки',                                              kcal: 560, protein: 20,   fat: 45,   carbs: 27.5 },
  { title: 'Арахис жареный',                                       kcal: 590, protein: 26,   fat: 49,   carbs: 13.4 },
  { title: 'Семечки подсолнечника',                                kcal: 601, protein: 20.7, fat: 52.9, carbs: 10.5 },
  { title: 'Семечки тыквенные',                                    kcal: 559, protein: 24.5, fat: 45.9, carbs: 13.9 },
  { title: 'Кедровый орех',                                        kcal: 673, protein: 13.7, fat: 68,   carbs: 13 },
  { title: 'Мёд',                                                   kcal: 329, protein: 0.8, fat: 0,   carbs: 81.5 },
  { title: 'Сахар',                                                 kcal: 398, protein: 0,   fat: 0,   carbs: 99.8 },
  { title: 'Варенье',                                               kcal: 271, protein: 0.3, fat: 0.2, carbs: 68 },
  { title: 'Зефир',                                                 kcal: 304, protein: 0.8, fat: 0.2, carbs: 78.3 },
  { title: 'Пастила',                                               kcal: 310, protein: 0.5, fat: 0.1, carbs: 80 },
  { title: 'Мармелад',                                              kcal: 293, protein: 0.4, fat: 0.1, carbs: 76.6 },
  { title: 'Халва подсолнечная',                                   kcal: 516, protein: 11.6, fat: 29.7, carbs: 54 },
  { title: 'Рахат-лукум',                                          kcal: 320, protein: 0.3, fat: 0,   carbs: 79 },
  { title: 'Козинаки',                                              kcal: 490, protein: 12,  fat: 27,  carbs: 51 },
  { title: 'Ирис',                                                  kcal: 430, protein: 3.3, fat: 8,   carbs: 82 },
  { title: 'Карамель',                                              kcal: 390, protein: 0,   fat: 0.1, carbs: 97.5 },
  { title: 'Протеиновый батончик',                                 kcal: 380, protein: 30,  fat: 13,  carbs: 38 },
  { title: 'Чипсы картофельные',                                   kcal: 536, protein: 6.6, fat: 35,  carbs: 51 },
  { title: 'Попкорн сладкий',                                      kcal: 480, protein: 6,   fat: 20,  carbs: 70 },
  { title: 'Попкорн солёный',                                      kcal: 400, protein: 8,   fat: 15,  carbs: 60 },
  { title: 'Сухарики',                                              kcal: 415, protein: 10,  fat: 18,  carbs: 55 },
  { title: 'Кириешки',                                              kcal: 480, protein: 9,   fat: 24,  carbs: 55 },

  // =========================================================================
  // СОУСЫ, ПРИПРАВЫ, МАСЛА
  // =========================================================================
  { title: 'Майонез',                                              kcal: 627, protein: 1.0, fat: 67,  carbs: 2.6 },
  { title: 'Майонез лёгкий',                                       kcal: 260, protein: 1.5, fat: 26,  carbs: 6 },
  { title: 'Кетчуп',                                                kcal: 112, protein: 1.8, fat: 0.5, carbs: 25 },
  { title: 'Горчица',                                               kcal: 162, protein: 5.7, fat: 9,   carbs: 12 },
  { title: 'Соевый соус',                                          kcal: 60,  protein: 6,   fat: 0,   carbs: 8.5 },
  { title: 'Аджика',                                                kcal: 65,  protein: 2,   fat: 1,   carbs: 12 },
  { title: 'Ткемали',                                               kcal: 60,  protein: 0.5, fat: 0.2, carbs: 14 },
  { title: 'Растительное масло подсолнечное',                     kcal: 899, protein: 0,   fat: 99.9, carbs: 0 },
  { title: 'Оливковое масло',                                      kcal: 898, protein: 0,   fat: 99.8, carbs: 0 },
  { title: 'Уксус бальзамический',                                 kcal: 88,  protein: 0.5, fat: 0,   carbs: 17 },
  { title: 'Хумус',                                                 kcal: 180, protein: 7.9, fat: 9.6, carbs: 17.1 },
  { title: 'Тахини (кунжутная паста)',                             kcal: 595, protein: 17,  fat: 54,  carbs: 21 },

  // =========================================================================
  // НАПИТКИ БЕЗАЛКОГОЛЬНЫЕ
  // =========================================================================
  { title: 'Кофе чёрный без сахара',                               kcal: 2,   protein: 0.2, fat: 0,   carbs: 0.3 },
  { title: 'Капучино на молоке',                                   kcal: 55,  protein: 3,   fat: 3,   carbs: 4.5 },
  { title: 'Латте на молоке',                                      kcal: 60,  protein: 3.2, fat: 3.2, carbs: 5 },
  { title: 'Раф кофе',                                              kcal: 90,  protein: 2.5, fat: 5,   carbs: 8 },
  { title: 'Чай чёрный без сахара',                                 kcal: 1,   protein: 0,   fat: 0,   carbs: 0.3 },
  { title: 'Чай зелёный без сахара',                                kcal: 1,   protein: 0,   fat: 0,   carbs: 0.2 },
  { title: 'Чай с молоком и сахаром',                               kcal: 40,  protein: 0.8, fat: 0.8, carbs: 7.5 },
  { title: 'Какао на молоке',                                      kcal: 100, protein: 4,   fat: 3.5, carbs: 14 },
  { title: 'Сок апельсиновый',                                     kcal: 45,  protein: 0.7, fat: 0.2, carbs: 10.4 },
  { title: 'Сок яблочный',                                          kcal: 46,  protein: 0.1, fat: 0.1, carbs: 11.4 },
  { title: 'Сок томатный',                                          kcal: 21,  protein: 1.0, fat: 0.1, carbs: 4.2 },
  { title: 'Компот из сухофруктов',                                 kcal: 60,  protein: 0.5, fat: 0,   carbs: 15 },
  { title: 'Морс ягодный',                                          kcal: 40,  protein: 0.2, fat: 0,   carbs: 10 },
  { title: 'Квас',                                                  kcal: 27,  protein: 0.2, fat: 0,   carbs: 5.2 },
  { title: 'Кисель фруктовый',                                     kcal: 53,  protein: 0.2, fat: 0,   carbs: 12.5 },
  { title: 'Кола сладкая газировка',                                kcal: 42,  protein: 0,   fat: 0,   carbs: 10.6 },
  { title: 'Лимонад',                                               kcal: 40,  protein: 0,   fat: 0,   carbs: 10 },
  { title: 'Энергетический напиток',                                kcal: 45,  protein: 0,   fat: 0,   carbs: 11 },
  { title: 'Минеральная вода',                                     kcal: 0,   protein: 0,   fat: 0,   carbs: 0 },
  { title: 'Смузи фруктовый',                                       kcal: 60,  protein: 0.8, fat: 0.3, carbs: 14 },
  { title: 'Смузи зелёный',                                         kcal: 45,  protein: 1.5, fat: 0.5, carbs: 9 },

  // =========================================================================
  // АЛКОГОЛЬ
  // =========================================================================
  { title: 'Пиво светлое 4.5%',                                    kcal: 42,  protein: 0.3, fat: 0,   carbs: 3.5 },
  { title: 'Пиво тёмное',                                          kcal: 48,  protein: 0.4, fat: 0,   carbs: 4 },
  { title: 'Вино красное сухое',                                   kcal: 68,  protein: 0.2, fat: 0,   carbs: 0.3 },
  { title: 'Вино белое сухое',                                     kcal: 66,  protein: 0.1, fat: 0,   carbs: 0.6 },
  { title: 'Вино полусладкое',                                     kcal: 88,  protein: 0.2, fat: 0,   carbs: 8 },
  { title: 'Шампанское',                                            kcal: 88,  protein: 0.3, fat: 0,   carbs: 7 },
  { title: 'Водка',                                                 kcal: 235, protein: 0,   fat: 0,   carbs: 0.1 },
  { title: 'Коньяк',                                                kcal: 239, protein: 0,   fat: 0,   carbs: 0.1 },
  { title: 'Виски',                                                 kcal: 250, protein: 0,   fat: 0,   carbs: 0.4 },
  { title: 'Ром',                                                   kcal: 220, protein: 0,   fat: 0,   carbs: 0 },
  { title: 'Ликёр сладкий',                                        kcal: 300, protein: 0,   fat: 0,   carbs: 35 },
  { title: 'Сидр',                                                  kcal: 45,  protein: 0,   fat: 0,   carbs: 4.5 },

  // =========================================================================
  // ФАСТФУД, СНЕКИ
  // =========================================================================
  { title: 'Бургер с говядиной',                                   kcal: 250, protein: 12,  fat: 12,  carbs: 25 },
  { title: 'Двойной бургер с сыром',                                kcal: 290, protein: 15,  fat: 16,  carbs: 24 },
  { title: 'Хот-дог',                                               kcal: 266, protein: 10,  fat: 17,  carbs: 20 },
  { title: 'Шаурма с курицей',                                     kcal: 210, protein: 11,  fat: 9,   carbs: 20 },
  { title: 'Шаурма с говядиной',                                   kcal: 230, protein: 12,  fat: 12,  carbs: 19 },
  { title: 'Донер кебаб',                                           kcal: 220, protein: 12,  fat: 11,  carbs: 18 },
  { title: 'Наггетсы куриные',                                     kcal: 296, protein: 15,  fat: 19,  carbs: 17 },
  { title: 'Картофельные дольки',                                  kcal: 220, protein: 3,   fat: 10,  carbs: 30 },
  { title: 'Луковые кольца в кляре',                                kcal: 280, protein: 4,   fat: 15,  carbs: 32 },
  { title: 'Хот-дог с сосиской',                                    kcal: 280, protein: 11,  fat: 18,  carbs: 20 },

  // =========================================================================
  // СПОРТИВНОЕ ПИТАНИЕ
  // =========================================================================
  { title: 'Протеиновый коктейль на воде',                         kcal: 105, protein: 20,  fat: 1.5, carbs: 3 },
  { title: 'Протеиновый коктейль на молоке',                       kcal: 140, protein: 22,  fat: 3,   carbs: 8 },
  { title: 'Гейнер на молоке',                                     kcal: 250, protein: 15,  fat: 4,   carbs: 40 },
  { title: 'Сывороточный протеин (порошок, порция)',               kcal: 120, protein: 24,  fat: 1.5, carbs: 3 },

  // =========================================================================
  // ДЕТСКОЕ ПИТАНИЕ
  // =========================================================================
  { title: 'Пюре овощное детское',                                 kcal: 40,  protein: 1.2, fat: 0.5, carbs: 7.5 },
  { title: 'Пюре фруктовое детское',                                kcal: 65,  protein: 0.4, fat: 0.2, carbs: 15 },
  { title: 'Пюре мясное детское',                                  kcal: 95,  protein: 9,   fat: 6,   carbs: 1 },
  { title: 'Каша детская молочная',                                kcal: 75,  protein: 2.3, fat: 1.8, carbs: 12.5 },
  { title: 'Творожок детский',                                     kcal: 105, protein: 8,   fat: 4.5, carbs: 9 },
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
