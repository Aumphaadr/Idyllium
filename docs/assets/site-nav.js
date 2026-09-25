// Поведение общей шапки сайта (1.6.3): дропдауны «Материалы / Инструменты / О проекте»
// и их схлопнутая форма «Разделы». Разметка — из tools/site-nav.ts, стили —
// site-nav.css. Без зависимостей; один файл на все разделы и Web IDE.
(function () {
  'use strict';

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  whenReady(function () {
    var groups = Array.prototype.slice.call(document.querySelectorAll('.site-nav-group'));
    if (groups.length === 0) return;

    function buttonOf(group) { return group.querySelector(':scope > .site-nav-button'); }
    function menuOf(group) { return group.querySelector(':scope > .site-nav-menu'); }
    function isOpen(group) { return group.classList.contains('is-open'); }

    function close(group) {
      group.classList.remove('is-open');
      var button = buttonOf(group);
      if (button) button.setAttribute('aria-expanded', 'false');
    }

    function closeAll(except) {
      groups.forEach(function (group) { if (group !== except) close(group); });
    }

    function open(group) {
      closeAll(group);
      group.classList.add('is-open');
      buttonOf(group).setAttribute('aria-expanded', 'true');
      // Хост (Web IDE) закрывает по этому сигналу свои меню и панель «Генератора цвета».
      document.dispatchEvent(new CustomEvent('idyllium-site-nav-open'));
    }

    // Обратная сторона: хост открывает своё меню — просит шапку свернуть её меню.
    window.idylliumSiteNav = { closeAll: function () { closeAll(null); } };

    groups.forEach(function (group) {
      var button = buttonOf(group);
      var menu = menuOf(group);
      if (!button || !menu) return;

      // Событие НЕ останавливаем: документ должен его увидеть — в Web IDE по нему
      // закрываются панель «Генератора цвета» и меню Файл/Правка/Внешний вид
      // (замечание владельца 2026-09-25: панель цвета переживала щелчки по шапке).
      button.addEventListener('click', function () {
        if (isOpen(group)) close(group); else open(group);
      });

      // Как в меню настольных программ: если одно меню уже раскрыто,
      // наведение на соседнюю кнопку раскрывает её без клика.
      button.addEventListener('mouseenter', function () {
        var anotherOpen = groups.some(function (other) { return other !== group && isOpen(other); });
        if (anotherOpen) open(group);
      });

      menu.addEventListener('click', function (event) {
        var item = event.target.closest ? event.target.closest('.site-nav-item') : null;
        if (item && !item.classList.contains('is-current')) close(group);
      });

      group.addEventListener('keydown', function (event) {
        var items = Array.prototype.slice.call(menu.querySelectorAll('.site-nav-item:not(.is-current)'));
        var index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          close(group);
          button.focus();
          event.preventDefault();
        } else if (event.key === 'ArrowDown') {
          if (!isOpen(group)) open(group);
          (items[index + 1] || items[0]).focus();
          event.preventDefault();
        } else if (event.key === 'ArrowUp' && isOpen(group)) {
          (items[index - 1] || items[items.length - 1]).focus();
          event.preventDefault();
        } else if (event.key === 'Home' && isOpen(group)) {
          items[0].focus();
          event.preventDefault();
        } else if (event.key === 'End' && isOpen(group)) {
          items[items.length - 1].focus();
          event.preventDefault();
        }
      });
    });

    document.addEventListener('click', function (event) {
      var inside = event.target.closest ? event.target.closest('.site-nav-group') : null;
      if (!inside) closeAll(null);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeAll(null);
    });
    window.addEventListener('blur', function () { closeAll(null); });
  });
})();
