// Тема сайта Idyllium — один модуль на все страницы (1.6.4; спека Idyllium-backstage/tech/spec/
// some_style_base/01, вердикты §9: одна тема на весь сайт, html[data-theme], скрипт до отрисовки).
// Подключается tools/site-nav.ts первым и БЕЗ defer: атрибут data-theme должен стоять на <html>
// раньше, чем браузер нарисует первый кадр, — иначе светлая тема мигала бы тёмной.
// Плотность страницы (prose — документы, app — инструменты) приходит атрибутом data-density
// у этого же <script>. Кнопку темы в шапке (#theme-toggle) обслуживает тоже этот модуль.
// API для разделов: window.idylliumTheme.get() → 'dark' | 'light', .set(theme), .toggle();
// событие document «idyllium-theme-change» с detail.theme — для Monaco, предпросмотра, кадра.
// Единственный признак темы в документе — html[data-theme]: классов темы на body больше нет (этап 4).
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
    syncToggle(current);
    if (persist) store(current);
    document.dispatchEvent(new CustomEvent('idyllium-theme-change', { detail: { theme: current } }));
  }

  var script = document.currentScript;
  var density = script && script.getAttribute('data-density');
  if (density) root.setAttribute('data-density', density);

  apply(read(), false);

  document.addEventListener('DOMContentLoaded', function () {
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
