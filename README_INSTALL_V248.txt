GKM V248 STABLE RESTORE FROM USER ZIP

База: films-series-best-5000-main (8)(1).zip — рабочая версия, которую ты скинул.

Что сделано:
1. Откат app.js / index.html / style.css / data на рабочую версию из твоего ZIP.
2. index.html чистый, без конфликтов, app.js?v=248.
3. Без кривой главной витрины V247.
4. Дубли убираются безопасно внутри renderList/renderHome.
5. Исправлены известные годы/типы: Побег из Шоушенка 1994, Форрест Гамп 1994, Криминальное чтиво 1994, Бойцовский клуб 1999, Крёстный отец 1972, Интерстеллар 2014, аниме/мультфильмы.
6. Добавлены нормальные описания для популярных проектов и нормальный fallback описания.
7. Старый auto_update_catalog_v143.yml отключён, чтобы V144 не перетирал сайт.

Что заливать:
- app.js
- index.html
- style.css
- data/ полностью из архива
- .github/workflows/auto_update_catalog_v143.yml желательно тоже заменить

Проверка:
1. Commit: Apply V248 stable restore
2. Push origin
3. Дождаться зелёного Pages
4. Ctrl + F5
5. В консоли app.js?v=248
