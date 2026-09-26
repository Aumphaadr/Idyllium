// Тема сайта Idyllium — один модуль на все страницы (1.6.4; спека Idyllium-backstage/tech/spec/
// some_style_base/01, вердикты §9: одна тема на весь сайт, html[data-theme], скрипт до отрисовки).
// Подключается tools/site-nav.ts первым и БЕЗ defer: атрибут data-theme должен стоять на <html>
// раньше, чем браузер нарисует первый кадр, — иначе светлая тема мигала бы тёмной.
// Плотность страницы (prose — документы, app — инструменты) приходит атрибутом data-density
// у этого же <script>. Кнопку темы в шапке (#theme-toggle) обслуживает тоже этот модуль.
// API для разделов: window.idylliumTheme.get() → 'dark' | 'light', .set(theme), .toggle();
// событие document «idyllium-theme-change» с detail.theme — для Monaco, предпросмотра, кадра.
(function () {
  'use strict';

  var KEY = 'idyllium-theme';
  // До 1.6.4 у документов и у IDE были свои ключи; читаются один раз, пока нет нового.
  var LEGACY_KEYS = ['idyllium-docs-theme', 'idyllium-web-theme'];
  var root = document.documentElement;
  var current = 'dark';

  function normalize(value) {
    if (value === 'light' || value === 'dark') return value;
    return null;
  }

  function read() {
    try {
      var saved = normalize(localStorage.getItem(KEY));
      if (saved) return saved;
      for (var i = 0; i < LEGACY_KEYS.length; i += 1) {
        var legacy = normalize(localStorage.getItem(LEGACY_KEYS[i]));
        if (legacy) return legacy;
      }
    } catch (error) { /* нет хранилища — тёмная */ }
    return 'dark';
  }

  function store(theme) {
    try { localStorage.setItem(KEY, theme); } catch (error) { /* не страшно */ }
  }

  // Переходный период (этапы 1–4 переезда стилевой базы): разделы ещё носят правила на
  // body.light-theme (учебник, справочник, конструктор, «Авторам») и body.theme-light /
  // body.theme-dark (IDE). Классы снимутся, когда последнее такое правило переедет на токены.
  function syncBody(theme) {
    var body = document.body;
    if (!body) return;
    var light = theme === 'light';
    body.classList.toggle('light-theme', light);
    body.classList.toggle('theme-light', light);
    body.classList.toggle('theme-dark', !light);
  }

  function syncToggle(theme) {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    var hint = theme === 'light' ? 'Тёмная тема' : 'Светлая тема';
    toggle.title = hint;
    toggle.setAttribute('aria-label', hint);
  }

  function apply(theme, persist) {
    current = normalize(theme) || 'dark';
    root.setAttribute('data-theme', current);
    syncBody(current);
    syncToggle(current);
    if (persist) store(current);
    document.dispatchEvent(new CustomEvent('idyllium-theme-change', { detail: { theme: current } }));
  }

  var script = document.currentScript;
  var density = script && script.getAttribute('data-density');
  if (density) root.setAttribute('data-density', density);

  apply(read(), false);

  // <body> появляется позже этого скрипта: ловим его рождение, чтобы переходные классы
  // стояли до первой отрисовки, а не после DOMContentLoaded.
  if (!document.body) {
    var observer = new MutationObserver(function () {
      if (!document.body) return;
      syncBody(current);
      observer.disconnect();
    });
    observer.observe(root, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncBody(current);
    syncToggle(current);
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        apply(current === 'light' ? 'dark' : 'light', true);
      });
    }
  });

  // Тема, переключённая в другой вкладке, подхватывается без перезагрузки.
  window.addEventListener('storage', function (event) {
    if (event.key === KEY && normalize(event.newValue)) apply(event.newValue, false);
  });

  window.idylliumTheme = {
    KEY: KEY,
    get: function () { return current; },
    set: function (theme) { apply(theme, true); },
    toggle: function () { apply(current === 'light' ? 'dark' : 'light', true); },
  };
})();
