[GKM_PROJECT_SCHEME_V1.md](https://github.com/user-attachments/files/29509069/GKM_PROJECT_SCHEME_V1.md)
[GKM_PROJECT_SCHEME_V1.md](https://github.com/user-attachments/files/29506740/GKM_PROJECT_SCHEME_V1.md)
[GKM_PROJECT_SCHEME_V1.md](https://github.com/user-attachments/files/29503592/GKM_PROJECT_SCHEME_V1.md)
# GKM PROJECT SCHEME V1
# «Голубь Каталог Мира» — карта сайта и логика проекта

Дата: 2026-06-29  
Проект: `films-series-best-5000`  
Назначение: каталог фильмов / сериалов / аниме / мультфильмов  
Текущая важная версия: `V199 CLEAN MODAL EXTERNAL LINKS`

---

## 0. Зачем нужен этот файл

Этот файл — не код, а **карта проекта**.

Он нужен, чтобы быстро понимать:

- какие файлы главные;
- как пользователь ходит по сайту;
- где живёт поиск;
- где живут карточки;
- где открывается модалка;
- где находятся внешние кнопки;
- какие старые патчи нельзя возвращать;
- куда смотреть, если сайт снова начнёт троить.

Правило проекта:

> Перед новым крупным патчем сначала смотреть эту схему, а не лепить новый костыль поверх старого.

---

## 1. Главная карта проекта

```mermaid
flowchart TD
    A[Пользователь открывает сайт] --> B[index.html]
    B --> C[style.css]
    B --> D[app.js]
    D --> E[Загрузка базы данных]
    E --> F[data/chunk_001.json ... data/chunk_N.json]
    E --> G[anime_data / anime_updates / genre files]
    D --> H[Рендер карточек]
    H --> I[Фильмы]
    H --> J[Сериалы]
    H --> K[Аниме]
    H --> L[Мультфильмы]
    I --> M[Карточка]
    J --> M
    K --> M
    L --> M
    M --> N[Модалка подробностей]
    N --> O[Постер]
    N --> P[Описание / рейтинг / год / жанры]
    N --> Q[Внешние кнопки V199]
    Q --> R[Новая вкладка]
    R --> S[Яндекс / Google / YouTube / VK / Rutube / Кинопоиск / Anime-сайты]
    Q --> T[Каталог остаётся открыт]
```

---

## 2. Основные файлы

| Файл / папка | За что отвечает | Важно |
|---|---|---|
| `index.html` | Каркас сайта | Подключает `style.css` и `app.js` |
| `style.css` | Внешний вид сайта | Карточки, сетка, модалка, мобильная версия |
| `app.js` | Главная логика сайта | Самый важный файл, тут поиск, фильтры, карточки, модалка |
| `data/chunk_*.json` | Основная база фильмов/сериалов/мультфильмов | Много файлов, не править вручную без нужды |
| `anime-tv/` | Отдельный блок/версия для anime-tv | Не путать с основной модалкой сайта |
| `.github/workflows/` | Автоматические GitHub-действия | Патчи/сборки/обновления |
| `README.md` | Краткое описание проекта | Сейчас почти пустой, можно расширить позже |

---

## 3. Как работает сайт для пользователя

```mermaid
flowchart TD
    A[Открыл сайт] --> B[Видит каталог]
    B --> C{Что делает пользователь?}
    C --> D[Выбирает категорию]
    C --> E[Пишет в поиск]
    C --> F[Листает карточки]
    D --> G[Сайт фильтрует выдачу]
    E --> G
    F --> H[Нажимает карточку]
    G --> H
    H --> I[Открывается модалка]
    I --> J[Пользователь смотрит инфу]
    I --> K[Жмёт внешнюю кнопку]
    K --> L[Открывается новая вкладка]
    L --> M[Каталог остаётся на месте]
```

---

## 4. Логика `app.js` крупными блоками

`app.js` — главный мозг сайта.

Примерная структура:

```txt
app.js
 ├─ Глобальные настройки и переменные
 ├─ Загрузка JSON-базы
 ├─ Нормализация данных
 ├─ Фильтры категорий
 ├─ Поиск
 ├─ Сортировка
 ├─ Рендер карточек
 ├─ Открытие модалки
 ├─ Заполнение модалки
 ├─ Внешние кнопки модалки
 │    └─ АКТУАЛЬНО: GKM V199 CLEAN MODAL EXTERNAL LINKS
 ├─ Мобильные обработчики
 └─ Дополнительные патчи версий
```

---

## 5. Модалка карточки

Модалка — это окно, которое открывается после клика на карточку.

В ней должно быть:

```txt
Модалка
 ├─ Постер
 ├─ Название
 ├─ Год
 ├─ Тип: фильм / сериал / аниме / мультфильм
 ├─ Рейтинг
 ├─ Жанры
 ├─ Описание
 ├─ Кнопки внешних сайтов
 └─ Закрытие модалки
```

Главное правило:

> Модалка не должна ломать текущую страницу и не должна уводить каталог на внешний сайт.

---

## 6. Внешние кнопки модалки

Актуальная версия:

```txt
GKM V199 CLEAN MODAL EXTERNAL LINKS
```

Задача V199:

- убрать дубли кнопок;
- открыть внешний сайт только в новой вкладке;
- не заменять текущий каталог внешним сайтом;
- для аниме показывать аниме-сайты;
- для фильмов/сериалов/мультфильмов показывать кино-сайты;
- работать на ПК и телефоне.

---

## 7. Схема внешних кнопок V199

```mermaid
flowchart TD
    A[Пользователь нажал внешнюю кнопку] --> B[V199 ловит клик]
    B --> C[event.preventDefault]
    C --> D[event.stopPropagation]
    D --> E[event.stopImmediatePropagation]
    E --> F[Берём URL из data-gkm-external-url]
    F --> G[window.open URL, _blank]
    G --> H[Внешний сайт открыт в новой вкладке]
    G --> I[Каталог остаётся открыт]
```

---

## 8. Какие старые блоки нельзя возвращать

Эти блоки считаются конфликтными для внешних кнопок:

```txt
GKM V195 MODAL SITES BUTTONS FIX
GKM V197 MODAL BUTTONS NO DUPLICATE NO REDIRECT
GKM V198 SINGLE EXTERNAL CLICK FIX
```

Причина:

- они пытались чинить одну и ту же проблему;
- могли вешать несколько обработчиков клика;
- из-за этого кнопки могли троить;
- внешний сайт мог открываться и в новой вкладке, и вместо каталога.

Правило:

> Если кнопки внешних сайтов снова ломаются, не возвращать V195/V197/V198. Смотреть V199.

---

## 9. Разделение сайтов: аниме и кино

```mermaid
flowchart TD
    A[Открыта карточка] --> B{Тип карточки}
    B --> C[Аниме]
    B --> D[Фильм / сериал / мультфильм]
    C --> E[Показать аниме-сайты]
    D --> F[Показать кино-сайты]
    E --> G[Shikimori / MyAnimeList / AniList / Anime-Planet / AniDB]
    F --> H[Яндекс / Яндекс Видео / Кинопоиск / YouTube / VK Видео / Rutube / Google]
```

---

## 10. Что проверять после каждого патча

После любого изменения `app.js` проверять минимум это:

```txt
1. Сайт открывается.
2. Карточки видны.
3. Поиск работает.
4. Категории работают.
5. Модалка открывается.
6. Модалка закрывается.
7. Постер отображается.
8. Кнопки внешних сайтов без дублей.
9. Внешняя кнопка открывает новую вкладку.
10. Каталог не заменяется внешним сайтом.
11. На телефоне кнопки нажимаются.
12. Для аниме показываются аниме-сайты.
13. Для фильмов/сериалов/мультфильмов показываются кино-сайты.
```

---

## 11. Карта проблем и куда смотреть

| Проблема | Куда смотреть первым делом |
|---|---|
| Дубли кнопок в модалке | Блок V199, функция удаления старых блоков |
| Внешний сайт открывается вместо каталога | Обработчик клика V199, поиск `location.href`, `window.location`, `_self` |
| Кнопка открывает две вкладки | Дублирующиеся `addEventListener('click')` или старые V195/V197/V198 |
| Аниме показывает кино-сайты | Определение типа карточки в V199 |
| Фильм показывает аниме-сайты | Определение типа карточки в V199 |
| На телефоне кнопка не работает | CSS поверх кнопки, z-index, pointer-events, обработчик click/touch |
| Поиск тормозит | Логика поиска, размер базы, debounce, рендер карточек |
| Нет постеров | Фильтр постеров, поле poster/backdrop, загрузка изображений |

---

## 12. Как правильно делать новые версии

Неправильно:

```txt
Сломалось → добавить ещё один патч в конец app.js
```

Правильно:

```txt
1. Найти старый блок, который отвечает за проблему.
2. Удалить конфликтующий код.
3. Сделать один чистый блок новой версии.
4. Проверить, что старые версии не остались.
5. Прогнать базовые тесты.
6. Обновить этот файл схемы.
```

---

## 13. Журнал важных версий

| Версия | Смысл |
|---|---|
| V194 | Убирал плашку «Умная выдача V191» |
| V195 | Добавлял сайты в модалке, но начал конфликтовать |
| V197 | Пытался убрать дубли, но проблему полностью не решил |
| V198 | Пытался удалить V195/V197, но сам мог конфликтовать |
| V199 | Чистая версия внешних кнопок модалки |

---

## 14. Главное правило проекта

```txt
Один участок сайта = один главный обработчик.
```

Для внешних кнопок модалки главный обработчик сейчас:

```txt
GKM V199 CLEAN MODAL EXTERNAL LINKS
```

Старые обработчики на эту же задачу держать нельзя.

---

## 15. Что можно добавить в следующую схему V2

Позже можно расширить этот файл:

- отдельная схема поиска;
- отдельная схема фильтров;
- отдельная схема постеров;
- отдельная схема базы `data/chunk_*.json`;
- список всех функций `app.js`;
- список старых патчей, которые нужно удалить;
- карта мобильной версии;
- карта GitHub workflows.

---

Конец файла.


---

## GKM V207 GAME HUB POLISH TELEGRAM

Добавлено в игровой раздел:

- полировка карточек игр;
- постер-заглушка, если картинка не загрузилась;
- кнопка «Поделиться в Telegram»;
- кнопка «Скопировать ссылку»;
- блок «Фреш-проверка»: ProtonDB, Steam Deck, HowLongToBeat, Twitch, Reddit;
- улучшенная модалка игры: где играть, связанные фильмы/аниме/сериалы, во что играть после просмотра, хронология, похожее по вайбу.

Важное правило: игровой хаб остаётся отдельным модулем. Основной каталог фильмов/сериалов/аниме не смешивать с games_catalog без проверки.


## GKM V208 GAME UNIVERSES EXPANSION

- Актуальный игровой хаб расширен до 50+ игровых карточек.
- Добавлены связи `фильм/сериал/аниме → игра`, `игра → фильм`, `игра → сериал`, `игра → аниме`, `кино-вайб`.
- В модалке игры добавлен блок `🌍 Открыть вселенную`: игры, фильмы, сериалы, аниме/мульт вокруг одной франшизы.
- Добавлены блоки `🧭 Играть по порядку` и `🎬 Смотреть по порядку`.
- Подключение в `index.html`: `app.js?v=208`.
- Старую стабильную точку V207 можно вернуть заменой `app.js`, `index.html` и `data/games_catalog.json` на V207.


---

## V209 GAME HUB QUALITY FIX

- Рабочая точка после V208.
- Улучшены счётчики фильтров игрового раздела.
- Поиск по играм учитывает вселенную, хронологию, play/watch order и связанные медиа.
- Постеры защищены fallback-заглушкой и автозаменой Steam `header.jpg` на вертикальный `library_600x900_2x.jpg`.
- Блок `🌍 Открыть вселенную` получил счётчик связей.
- `index.html` подключает `app.js?v=209`.


## GKM V210 GAME GRID BORDER FIX

- Рабочая база: V209.
- Исправлена лишняя бирюзовая рамка вокруг всей сетки игр после поиска.
- В разделе Игры сетка не должна получать `gkm-v191-search-best`, outline или box-shadow.
- Подключение поднято до `app.js?v=210`.


## GKM V211 — Game collections + fast posters

- Добавлены игровые подборки: лучшие экранизации, сериалы, аниме, хоррор/зомби, фэнтези, фантастика, киберпанк, файтинги, семейное, культовые, новые.
- Игровые постеры оптимизированы: первая видимая партия грузится приоритетно, остальные лениво.
- Количество карточек на странице игр снижено до 24, чтобы первый экран открывался быстрее и не тянул сразу все 59 постеров.
- Подключение: `app.js?v=211`.

---

## GKM V212 BOOKS MANGA COMICS FOUNDATION

Важно: идея пользователя — расширить “Голубь Каталог Мира” до единого каталога, где вместе живут фильмы, сериалы, аниме, мультфильмы, игры, книги, манга и комиксы.

Добавлено:

```text
📚 Книги / Манга / Комиксы
 ├─ книги
 ├─ манга / ранобэ / новеллы
 ├─ комиксы
 ├─ первоисточники
 ├─ книга → фильм
 ├─ книга → сериал
 ├─ манга → аниме
 ├─ комикс → фильм / сериал / игра
 └─ книга / манга / комикс → игровая вселенная
```

Новый файл данных:

```text
data/books_catalog.json
```

Новый JS-блок:

```text
GKM V212 BOOKS MANGA COMICS FOUNDATION
```

Основные фичи:

```text
- новая вкладка 📚 Книги/Манга;
- карточки книг, манги и комиксов;
- фильтры: книги / манга / комиксы / первоисточники;
- подборки: → фильмы, → сериалы, → аниме, → игры, фэнтези, фантастика, супергерои, культовые;
- модалка Book Hub;
- кнопки Telegram и копировать ссылку;
- Google Books / Goodreads / ЛитРес / Author.Today / MangaLib / MangaDex / ReadManga;
- блок “🧭 С чего начать вселенную”;
- порядок чтения / просмотра / прохождения;
- связь с карточками фильмов, аниме и игр.
```

Откат V212:

```text
1. Вернуть app.js предыдущей версии.
2. Вернуть index.html с app.js?v=211.
3. Удалить data/books_catalog.json.
```


## GKM V213 CLEAN BUTTON SYSTEM + BOOK COVERS
- аккуратная система кнопок: главные разделы отдельно, подборки отдельно
- компактные чипы для фильтров книг/манги/комиксов
- обложки для книг, манги и комиксов
- улучшенная визуальная структура разделов

## GKM V214 REAL BOOK / MANGA / COMICS COVERS
- добавлены реальные обложки для книг, манги и комиксов через стабильные ISBN cover-ссылки
- fallback V213 оставлен: если обложка не загрузится, будет красивая типовая карточка
- раздел Книги/Манга визуально стал ближе к полноценному каталогу

## GKM V215 BOOKS MANGA COMICS EXPANSION
- раздел Книги/Манга расширен с 22 до 60 карточек
- добавлены новые манга, книги, комиксы и первоисточники
- сохранены реальные cover-ссылки и fallback-обложки
- связи с фильмами, сериалами, аниме и играми расширены

## GKM V216 MAX BOOK BASE + FAST LOAD
- раздел Книги/Манга расширен до 119 карточек
- JSON облегчен: тяжёлые встроенные fallback-обложки убраны
- fallback генерируется на лету, если у карточки нет настоящей обложки
- первая страница книг уменьшена до 18 карточек для быстрой загрузки
- видимые постеры получают приоритет, остальные грузятся лениво

## GKM V221 SPLIT BOOK DATABASE 1000+
- раздел Книги/Манга/Комиксы расширен до 1008 записей
- база разбита на отдельные файлы:
  - data/books/manga.json
  - data/books/ranobe.json
  - data/books/books.json
  - data/books/comics.json
  - data/books/index.json
- app.js сначала грузит split-файлы, если не получилось — combined data/books_catalog.json
- часть новых записей помечена sourceQuality=generated_seed: это заготовки для будущей ручной чистки и замены на точные обложки

## GKM V222 ALL BOOK POSTERS FIX
- исправлено "Нет постера" в разделе Книги/Манга/Комиксы
- для каждой видимой карточки без poster генерируется красивая обложка
- если внешняя обложка не загрузилась, включается fallback-обложка
- скорость сохранена: обложки генерируются только для текущей страницы, а не для всех 1008 сразу

## GKM V223 UNIVERSAL DESCRIPTIONS FIX
- добавлен универсальный блок подробного описания для фильмов, сериалов, аниме, мультфильмов, игр, книг, манги и комиксов
- если реальное описание короткое или отсутствует, сайт генерирует нормальное пояснение по типу, жанру, рейтингу, вселенной и связям
- цель: пользователь должен понимать, что он собирается смотреть / читать / играть, даже если видео не открывается внутри каталога

## GKM V224 GAME DATABASE EXPANSION
- Игры расширены с 59 до 360 записей
- добавлена split-структура data/games/*
- добавлены fallback-постеры для игр без poster
- combined data/games_catalog.json оставлен как запасной вариант

## GKM V225 MODAL FULL DESCRIPTION FIX
- описание теперь принудительно добавляется прямо в открытую модалку карточки
- работает даже если исходное описание короткое или обрезанное
- добавлен блок "📖 Подробное описание" для фильмов, сериалов, аниме, мультфильмов, игр, книг, манги, ранобэ и комиксов
- старый короткий обрезок описания визуально приглушается, чтобы не мешал

## GKM V226 FORCE GAME DATABASE 360 FIX
- исправлено: раздел Игры мог оставаться на старом V211 и показывать 59 записей
- V226 принудительно подменяет рендер игр на расширенную базу
- если старый V211 отрисовался первым, V226 перерисовывает раздел
- ожидаемый результат: Игровые вселенные · 360 из 360 · V226

## GKM V235 CLEAN ROLLBACK FROM GOOD ZIP
- откат на рабочую версию из films-series-best-5000-main (6)(2).zip
- убраны последствия сломанных V228-V234
- cache bump app.js?v=235

## GKM V237 GLOBAL DEDUPE FIX
- исправлено задвоение карточек по названию и типу
- без изменений стилей и баз
- при дублях сохраняется лучший вариант по постеру/голосам/рейтингу/описанию

## GKM V239 HARD DATA DEDUPE
- дубли удалены из JSON-данных
- fallback в app.js удаляет дубли из DOM
- без изменений style.css
- изменённые JSON: data/books/books.json, data/books_catalog.json, data/chunk_001.json, data/chunk_004.json, data/chunk_005.json, data/chunk_006.json, data/chunk_008.json, data/chunk_011.json, data/chunk_016.json, data/chunk_020.json, data/chunk_024.json, data/chunk_032.json, data/chunk_034.json, data/chunk_035.json, data/chunk_036.json, data/chunk_037.json, data/chunk_038.json, data/chunk_039.json, data/chunk_040.json, data/chunk_041.json, data/chunk_042.json, data/chunk_043.json, data/chunk_044.json, data/chunk_045.json, data/chunk_046.json, data/chunk_047.json, data/chunk_048.json, data/chunk_050.json, data/chunk_052.json, data/chunk_053.json, data/chunk_054.json, data/chunk_055.json, data/chunk_056.json, data/chunk_057.json, data/chunk_058.json, data/chunk_059.json, data/chunk_060.json, data/chunk_061.json, data/chunk_063.json, data/chunk_064.json, data/chunk_065.json, data/chunk_068.json, data/chunk_069.json, data/chunk_071.json, data/chunk_072.json, data/chunk_073.json, data/chunk_074.json, data/chunk_075.json, data/chunk_076.json, data/chunk_077.json, data/chunk_080.json, data/chunk_081.json, data/chunk_082.json, data/chunk_084.json, data/chunk_085.json, data/chunk_088.json, data/chunk_089.json, data/chunk_090.json, data/chunk_091.json, data/chunk_092.json, data/chunk_095.json, data/chunk_098.json, data/chunk_100.json, data/chunk_102.json, data/chunk_103.json, data/chunk_108.json, data/chunk_112.json, data/chunk_116.json, data/chunk_122.json, data/chunk_123.json, data/chunk_126.json, data/chunk_129.json, data/chunk_130.json, data/chunk_131.json, data/chunk_132.json, data/chunk_137.json, data/chunk_138.json, data/chunk_139.json, data/chunk_141.json, data/chunk_142.json, data/chunk_143.json, data/chunk_144.json, data/chunk_146.json, data/chunk_147.json, data/chunk_148.json, data/chunk_149.json, data/chunk_150.json, data/chunk_151.json, data/chunk_152.json, data/chunk_153.json, data/chunk_154.json, data/chunk_155.json, data/chunk_156.json, data/chunk_157.json, data/chunk_158.json, data/chunk_159.json, data/chunk_160.json, data/chunk_161.json, data/chunk_162.json, data/chunk_163.json, data/chunk_164.json, data/chunk_165.json, data/chunk_166.json, data/chunk_167.json, data/chunk_168.json, data/chunk_169.json, data/chunk_170.json, data/chunk_171.json, data/chunk_172.json, data/chunk_173.json, data/chunk_176.json, data/chunk_177.json, data/chunk_185.json, data/chunk_186.json, data/chunk_187.json, data/chunk_188.json, data/chunks/chunk_0002.json, data/chunks/chunk_0003.json, data/chunks/chunk_0004.json, data/chunks/chunk_0005.json, data/chunks/chunk_0007.json, data/chunks/chunk_0008.json, data/chunks/chunk_0011.json, data/chunks/chunk_0019.json, data/chunks/chunk_0020.json, data/chunks/chunk_0025.json, data/chunks/chunk_0039.json, data/chunks/chunk_0040.json, data/chunks/chunk_0043.json, data/chunks/chunk_0045.json, data/chunks/chunk_0048.json, data/chunks/chunk_0049.json, data/chunks/chunk_0056.json, data/chunks/chunk_0064.json, data/chunks/chunk_0065.json, data/chunks/chunk_0067.json, data/chunks/chunk_0070.json, data/chunks/chunk_0075.json, data/chunks/chunk_0079.json, data/chunks/chunk_0080.json, data/chunks/chunk_0082.json, data/chunks/chunk_0083.json, data/chunks/chunk_0086.json, data/chunks/chunk_0087.json, data/chunks/chunk_0088.json, data/chunks/chunk_0091.json, data/chunks/chunk_0092.json, data/chunks/chunk_0095.json, data/chunks/chunk_0096.json, data/chunks/chunk_0097.json, data/chunks/chunk_0100.json, data/chunks/chunk_0101.json, data/chunks/chunk_0105.json, data/chunks/chunk_0106.json, data/chunks/chunk_0108.json, data/chunks/chunk_0111.json, data/chunks/chunk_0112.json, data/chunks/chunk_0115.json, data/chunks/chunk_0116.json, data/chunks/chunk_0122.json, data/chunks/chunk_0124.json, data/chunks/chunk_0125.json, data/chunks/chunk_0129.json, data/chunks/chunk_0131.json, data/chunks/chunk_0132.json, data/chunks/chunk_0134.json, data/chunks/chunk_0135.json, data/chunks/chunk_0137.json, data/chunks/chunk_0138.json, data/chunks/chunk_0139.json, data/chunks/chunk_0140.json, data/chunks/chunk_0141.json, data/chunks/chunk_0142.json, data/chunks/chunk_0143.json, data/chunks/chunk_0146.json, data/chunks/chunk_0147.json, data/chunks/chunk_0148.json, data/chunks/chunk_0149.json, data/chunks/chunk_0151.json, data/chunks/chunk_0152.json, data/chunks/chunk_0153.json, data/chunks/chunk_0154.json, data/chunks/chunk_0155.json, data/chunks/chunk_0156.json, data/chunks/chunk_0157.json, data/chunks/chunk_0158.json, data/chunks/chunk_0159.json, data/chunks/chunk_0160.json, data/chunks/chunk_0161.json, data/chunks/chunk_0162.json, data/chunks/chunk_0163.json, data/chunks/chunk_0164.json, data/chunks/chunk_0166.json, data/chunks/chunk_0167.json, data/chunks/chunk_0168.json, data/chunks/chunk_0169.json, data/chunks/chunk_0170.json, data/chunks/chunk_0173.json, data/chunks/chunk_0182.json, data/chunks/chunk_0183.json, data/chunks/chunk_0184.json, data/chunks/chunk_0185.json, data/fast/pages/all/page_0001.json, data/fast/pages/all/page_0002.json, data/fast/pages/all/page_0003.json, data/fast/pages/all/page_0004.json, data/fast/pages/all/page_0006.json, data/fast/pages/all/page_0007.json, data/fast/pages/all/page_0008.json, data/fast/pages/all/page_0009.json, data/fast/pages/all/page_0010.json, data/fast/pages/all/page_0018.json, data/fast/pages/all/page_0020.json, data/fast/pages/all/page_0021.json, data/fast/pages/all/page_0025.json, data/fast/pages/all/page_0027.json, data/fast/pages/all/page_0029.json, data/fast/pages/all/page_0032.json, data/fast/pages/all/page_0033.json, data/fast/pages/all/page_0035.json, data/fast/pages/all/page_0044.json, data/fast/pages/all/page_0047.json, data/fast/pages/all/page_0048.json, data/fast/pages/all/page_0049.json, data/fast/pages/all/page_0052.json, data/fast/pages/all/page_0054.json, data/fast/pages/all/page_0057.json, data/fast/pages/all/page_0058.json, data/fast/pages/all/page_0059.json, data/fast/pages/all/page_0060.json, data/fast/pages/all/page_0061.json, data/fast/pages/all/page_0067.json, data/fast/pages/all/page_0068.json, data/fast/pages/all/page_0073.json, data/fast/pages/all/page_0076.json, data/fast/pages/all/page_0077.json, data/fast/pages/all/page_0083.json, data/fast/pages/all/page_0085.json, data/fast/pages/all/page_0087.json, data/fast/pages/all/page_0091.json, data/fast/pages/all/page_0092.json, data/fast/pages/all/page_0093.json, data/fast/pages/all/page_0099.json, data/fast/pages/all/page_0104.json, data/fast/pages/all/page_0109.json, data/fast/pages/all/page_0110.json, data/fast/pages/all/page_0112.json, data/fast/pages/all/page_0125.json, data/fast/pages/all/page_0131.json, data/fast/pages/all/page_0132.json, data/fast/pages/all/page_0142.json, data/fast/pages/all/page_0143.json, data/fast/pages/all/page_0151.json, data/fast/pages/all/page_0152.json, data/fast/pages/all/page_0153.json, data/fast/pages/all/page_0154.json, data/fast/pages/all/page_0155.json, data/fast/pages/all/page_0156.json, data/fast/pages/all/page_0167.json, data/fast/pages/all/page_0168.json, data/fast/pages/all/page_0175.json, data/fast/pages/all/page_0178.json, data/fast/pages/all/page_0179.json, data/fast/pages/all/page_0180.json, data/fast/pages/all/page_0181.json, data/fast/pages/all/page_0182.json, data/fast/pages/all/page_0183.json, data/fast/pages/all/page_0193.json, data/fast/pages/all/page_0196.json, data/fast/pages/all/page_0197.json, data/fast/pages/all/page_0200.json, data/fast/pages/all/page_0205.json, data/fast/pages/all/page_0208.json, data/fast/pages/all/page_0209.json, data/fast/pages/all/page_0210.json, data/fast/pages/all/page_0220.json, data/fast/pages/all/page_0221.json, data/fast/pages/all/page_0223.json, data/fast/pages/all/page_0224.json, data/fast/pages/all/page_0229.json, data/fast/pages/all/page_0257.json, data/fast/pages/all/page_0274.json, data/fast/pages/all/page_0374.json, data/fast/pages/all/page_0635.json, data/fast/pages/all/page_0844.json, data/fast/pages/all/page_0865.json, data/fast/pages/all/page_0870.json, data/fast/pages/all/page_0904.json, data/fast/pages/all/page_0978.json, data/fast/pages/all/page_0990.json, data/fast/pages/all/page_1010.json, data/fast/pages/all/page_1060.json, data/fast/pages/all/page_1067.json, data/fast/pages/all/page_1081.json, data/fast/pages/all/page_1117.json, data/fast/pages/all/page_1125.json, data/fast/pages/all/page_1126.json, data/fast/pages/all/page_1161.json, data/fast/pages/all/page_1179.json, data/fast/pages/all/page_1181.json, data/fast/pages/all/page_1233.json, data/fast/pages/all/page_1242.json, data/fast/pages/all/page_1264.json, data/fast/pages/all/page_1265.json, data/fast/pages/anime/page_0001.json, data/fast/pages/anime/page_0002.json, data/fast/pages/anime/page_0003.json, data/fast/pages/anime/page_0004.json, data/fast/pages/anime/page_0005.json, data/fast/pages/anime/page_0006.json, data/fast/pages/anime/page_0007.json, data/fast/pages/anime/page_0008.json, data/fast/pages/anime/page_0012.json, data/fast/pages/anime/page_0018.json, data/fast/pages/anime/page_0020.json, data/fast/pages/anime/page_0024.json, data/fast/pages/anime/page_0026.json, data/fast/pages/anime/page_0039.json, data/fast/pages/anime/page_0040.json, data/fast/pages/anime/page_0046.json, data/fast/pages/anime/page_0047.json, data/fast/pages/anime/page_0065.json, data/fast/pages/anime/page_0071.json, data/fast/pages/anime/page_0072.json, data/fast/pages/anime/page_0080.json, data/fast/pages/anime/page_0103.json, data/fast/pages/anime/page_0111.json, data/fast/pages/anime/page_0123.json, data/fast/pages/anime/page_0179.json, data/fast/pages/cartoons/page_0001.json, data/fast/pages/cartoons/page_0003.json, data/fast/pages/cartoons/page_0004.json, data/fast/pages/cartoons/page_0005.json, data/fast/pages/cartoons/page_0006.json, data/fast/pages/cartoons/page_0007.json, data/fast/pages/cartoons/page_0010.json, data/fast/pages/cartoons/page_0011.json, data/fast/pages/cartoons/page_0012.json, data/fast/pages/cartoons/page_0013.json, data/fast/pages/cartoons/page_0014.json, data/fast/pages/cartoons/page_0016.json, data/fast/pages/cartoons/page_0018.json, data/fast/pages/cartoons/page_0019.json, data/fast/pages/cartoons/page_0020.json, data/fast/pages/cartoons/page_0022.json, data/fast/pages/cartoons/page_0027.json, data/fast/pages/cartoons/page_0028.json, data/fast/pages/cartoons/page_0069.json, data/fast/pages/cartoons/page_0088.json, data/fast/pages/cartoons/page_0110.json, data/fast/pages/cartoons/page_0111.json, data/fast/pages/cartoons/page_0126.json, data/fast/pages/cartoons/page_0130.json, data/fast/pages/cartoons/page_0132.json, data/fast/pages/cartoons/page_0136.json, data/fast/pages/cartoons/page_0138.json, data/fast/pages/cartoons/page_0142.json, data/fast/pages/movies/page_0001.json, data/fast/pages/movies/page_0002.json, data/fast/pages/movies/page_0003.json, data/fast/pages/movies/page_0004.json, data/fast/pages/movies/page_0005.json, data/fast/pages/movies/page_0006.json, data/fast/pages/movies/page_0007.json, data/fast/pages/movies/page_0009.json, data/fast/pages/movies/page_0010.json, data/fast/pages/movies/page_0011.json, data/fast/pages/movies/page_0012.json, data/fast/pages/movies/page_0013.json, data/fast/pages/movies/page_0014.json, data/fast/pages/movies/page_0016.json, data/fast/pages/movies/page_0018.json, data/fast/pages/movies/page_0019.json, data/fast/pages/movies/page_0022.json, data/fast/pages/movies/page_0024.json, data/fast/pages/movies/page_0027.json, data/fast/pages/movies/page_0028.json, data/fast/pages/movies/page_0029.json, data/fast/pages/movies/page_0030.json, data/fast/pages/movies/page_0031.json, data/fast/pages/movies/page_0035.json, data/fast/pages/movies/page_0036.json, data/fast/pages/movies/page_0038.json, data/fast/pages/movies/page_0039.json, data/fast/pages/movies/page_0040.json, data/fast/pages/movies/page_0041.json, data/fast/pages/movies/page_0045.json, data/fast/pages/movies/page_0046.json, data/fast/pages/movies/page_0047.json, data/fast/pages/movies/page_0048.json, data/fast/pages/movies/page_0049.json, data/fast/pages/movies/page_0050.json, data/fast/pages/movies/page_0051.json, data/fast/pages/movies/page_0055.json, data/fast/pages/movies/page_0056.json, data/fast/pages/movies/page_0057.json, data/fast/pages/movies/page_0059.json, data/fast/pages/movies/page_0309.json, data/fast/pages/movies/page_0478.json, data/fast/pages/movies/page_0485.json, data/fast/pages/movies/page_0496.json, data/fast/pages/movies/page_0501.json, data/fast/pages/movies/page_0529.json, data/fast/pages/movies/page_0533.json, data/fast/pages/movies/page_0541.json, data/fast/pages/movies/page_0547.json, data/fast/pages/movies/page_0568.json, data/fast/pages/movies/page_0569.json, data/fast/pages/movies/page_0583.json, data/fast/pages/movies/page_0593.json, data/fast/pages/movies/page_0607.json, data/fast/pages/movies/page_0635.json, data/fast/pages/movies/page_0647.json, data/fast/pages/movies/page_0653.json, data/fast/pages/movies/page_0670.json, data/fast/pages/movies/page_0711.json, data/fast/pages/new/page_0078.json, data/fast/pages/popular/page_0001.json, data/fast/pages/popular/page_0002.json, data/fast/pages/popular/page_0003.json, data/fast/pages/popular/page_0004.json, data/fast/pages/popular/page_0006.json, data/fast/pages/popular/page_0013.json, data/fast/pages/popular/page_0014.json, data/fast/pages/popular/page_0016.json, data/fast/pages/popular/page_0018.json, data/fast/pages/popular/page_0021.json, data/fast/pages/popular/page_0026.json, data/fast/pages/popular/page_0029.json, data/fast/pages/popular/page_0033.json, data/fast/pages/popular/page_0037.json, data/fast/pages/popular/page_0045.json, data/fast/pages/popular/page_0046.json, data/fast/pages/popular/page_0047.json, data/fast/pages/popular/page_0048.json, data/fast/pages/popular/page_0049.json, data/fast/pages/popular/page_0050.json, data/fast/pages/popular/page_0055.json, data/fast/pages/popular/page_0056.json, data/fast/pages/popular/page_0057.json, data/fast/pages/popular/page_0058.json, data/fast/pages/popular/page_0059.json, data/fast/pages/popular/page_0060.json, data/fast/pages/popular/page_0061.json, data/fast/pages/popular/page_0062.json, data/fast/pages/popular/page_0063.json, data/fast/pages/popular/page_0064.json, data/fast/pages/popular/page_0065.json, data/fast/pages/popular/page_0066.json, data/fast/pages/popular/page_0067.json, data/fast/pages/popular/page_0068.json, data/fast/pages/popular/page_0069.json, data/fast/pages/popular/page_0070.json, data/fast/pages/popular/page_0071.json, data/fast/pages/popular/page_0072.json, data/fast/pages/popular/page_0073.json, data/fast/pages/popular/page_0074.json, data/fast/pages/popular/page_0075.json, data/fast/pages/popular/page_0076.json, data/fast/pages/popular/page_0077.json, data/fast/pages/popular/page_0078.json, data/fast/pages/popular/page_0079.json, data/fast/pages/popular/page_0080.json, data/fast/pages/popular/page_0081.json, data/fast/pages/popular/page_0084.json, data/fast/pages/popular/page_0085.json, data/fast/pages/popular/page_0086.json, data/fast/pages/popular/page_0087.json, data/fast/pages/popular/page_0088.json, data/fast/pages/popular/page_0089.json, data/fast/pages/popular/page_0090.json, data/fast/pages/popular/page_0091.json, data/fast/pages/popular/page_0092.json, data/fast/pages/popular/page_0093.json, data/fast/pages/popular/page_0094.json, data/fast/pages/popular/page_0095.json, data/fast/pages/popular/page_0096.json, data/fast/pages/popular/page_0097.json, data/fast/pages/popular/page_0098.json, data/fast/pages/popular/page_0099.json, data/fast/pages/popular/page_0100.json, data/fast/pages/popular/page_0101.json, data/fast/pages/popular/page_0102.json, data/fast/pages/popular/page_0103.json, data/fast/pages/popular/page_0104.json, data/fast/pages/popular/page_0105.json, data/fast/pages/popular/page_0106.json, data/fast/pages/popular/page_0107.json, data/fast/pages/popular/page_0108.json, data/fast/pages/popular/page_0109.json, data/fast/pages/popular/page_0110.json, data/fast/pages/popular/page_0111.json, data/fast/pages/popular/page_0112.json, data/fast/pages/popular/page_0113.json, data/fast/pages/popular/page_0114.json, data/fast/pages/popular/page_0115.json, data/fast/pages/popular/page_0116.json, data/fast/pages/popular/page_0117.json, data/fast/pages/popular/page_0118.json, data/fast/pages/popular/page_0119.json, data/fast/pages/popular/page_0120.json, data/fast/pages/popular/page_0121.json, data/fast/pages/popular/page_0122.json, data/fast/pages/popular/page_0123.json, data/fast/pages/popular/page_0124.json, data/fast/pages/popular/page_0125.json, data/fast/pages/popular/page_0127.json, data/fast/pages/popular/page_0128.json, data/fast/pages/popular/page_0129.json, data/fast/pages/popular/page_0130.json, data/fast/pages/popular/page_0131.json, data/fast/pages/popular/page_0132.json, data/fast/pages/popular/page_0133.json, data/fast/pages/popular/page_0134.json, data/fast/pages/popular/page_0135.json, data/fast/pages/popular/page_0137.json, data/fast/pages/popular/page_0138.json, data/fast/pages/popular/page_0139.json, data/fast/pages/popular/page_0140.json, data/fast/pages/popular/page_0141.json, data/fast/pages/popular/page_0142.json, data/fast/pages/popular/page_0145.json, data/fast/pages/popular/page_0146.json, data/fast/pages/popular/page_0148.json, data/fast/pages/popular/page_0150.json, data/fast/pages/popular/page_0151.json, data/fast/pages/popular/page_0153.json, data/fast/pages/popular/page_0154.json, data/fast/pages/popular/page_0155.json, data/fast/pages/popular/page_0157.json, data/fast/pages/popular/page_0159.json, data/fast/pages/popular/page_0160.json, data/fast/pages/popular/page_0162.json, data/fast/pages/popular/page_0163.json, data/fast/pages/popular/page_0165.json, data/fast/pages/popular/page_0166.json, data/fast/pages/popular/page_0167.json, data/fast/pages/popular/page_0169.json, data/fast/pages/popular/page_0171.json, data/fast/pages/popular/page_0172.json, data/fast/pages/series/page_0046.json, data/fast/pages/series/page_0209.json, data/fast/pages/series/page_0212.json, data/fast/pages/series/page_0213.json, data/fast/pages/series/page_0226.json, data/fast/pages/series/page_0321.json, data/fast/pages/top/page_0001.json, data/fast/pages/top/page_0002.json, data/fast/pages/top/page_0003.json, data/fast/pages/top/page_0004.json, data/fast/search_index.json, data/games/game_to_anime.json, data/games_catalog.json


## GKM V240 RUNTIME DATA QUALITY + DESCRIPTION RESTORE
- компактный runtime fix: годы, типы, описания и фильтр активных разделов
- style.css и базы не трогались

## GKM V241 CARTOON/ANIME/FILM TYPE + SYNOPSIS FIX
- точечный runtime-фильтр типов для известных ошибок
- добавлены синопсисы для мультфильмов/аниме/Доктора Стрэнджа
- без изменений style.css и data
