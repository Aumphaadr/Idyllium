(() => {
  const KEYWORDS = new Set([
    'use', 'if', 'else', 'while', 'do', 'for', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'const',
    'function', 'class', 'extends', 'this', 'constructor', 'event', 'contract',
    'public', 'private', 'static', 'parent', 'and', 'or', 'xor',
    'not', 'true', 'false', 'null',
  ]);

  const TYPES = new Set([
    'int', 'float', 'string', 'char', 'bool', 'void', 'array', 'dyn_array', 'set',
  ]);

  const QUALIFIED_TYPES = new Set([
    'Animation', 'Array', 'Color', 'Database', 'Drawable', 'Font', 'Image', 'Music', 'Object', 'Result',
    'Sound', 'Statement', 'Static', 'Value',
    'Circle', 'Line', 'Rectangle', 'Sprite', 'Text',
    'istream', 'ostream', 'stream', 'stamp',
    'Window', 'Widget', 'Button', 'Label', 'SpinBox', 'FloatSpinBox',
    'LineEdit', 'CheckBox', 'ProgressBar', 'TextEdit',
    'ComboBox', 'Slider', 'Frame', 'Timer', 'Modal', 'RadioButton', 'ImageBox',
    'Canvas', 'KeyboardEvent', 'MouseEvent', 'MouseScrollEvent',
    'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float32', 'float64',
  ]);

  const SQL_KEYWORDS = new Set([
    'ADD', 'ALL', 'ALTER', 'AND', 'AS', 'ASC', 'AUTOINCREMENT', 'BEGIN', 'BY',
    'CASE', 'COMMIT', 'CREATE', 'DEFAULT', 'DELETE', 'DESC', 'DISTINCT', 'DROP',
    'ELSE', 'END', 'EXISTS', 'FOREIGN', 'FROM', 'GROUP', 'HAVING', 'IF', 'IN',
    'INDEX', 'INNER', 'INSERT', 'INTO', 'IS', 'JOIN', 'KEY', 'LEFT', 'LIKE',
    'LIMIT', 'NOT', 'NULL', 'ON', 'OR', 'ORDER', 'OUTER', 'PRIMARY', 'REFERENCES',
    'ROLLBACK', 'SELECT', 'SET', 'TABLE', 'THEN', 'TRANSACTION', 'UNIQUE',
    'UPDATE', 'VALUES', 'WHEN', 'WHERE',
  ]);

  const SQL_TYPES = new Set(['BLOB', 'INTEGER', 'REAL', 'TEXT']);

  // Одна и та же оболочка обслуживает учебник (/book/) и задачник (/tasks/).
  // Отличаются они только подписями и направлением перекрёстной ссылки.
  const MODE = document.body?.dataset.docsMode === 'tasks' ? 'tasks'
    : document.body?.dataset.docsMode === 'projects' ? 'projects'
      : 'book';
  const UI = MODE === 'projects'
    ? {
      titleSuffix: 'Проекты Idyllium',
      loading: 'Загружаем проект...',
      fatal: 'Раздел проектов не загрузился',
      kicker: 'Проект',
      crossLabel: '',
      crossBase: '',
      prevLabel: 'Предыдущий проект',
      nextLabel: 'Следующий проект',
    }
    : MODE === 'tasks'
    ? {
      titleSuffix: 'Задачник Idyllium',
      loading: 'Загружаем задачи...',
      fatal: 'Задачник не загрузился',
      kicker: 'Задачи к уроку',
      crossLabel: 'Открыть урок',
      crossBase: '../book/',
      prevLabel: 'Предыдущая тема',
      nextLabel: 'Следующая тема',
    }
    : {
      titleSuffix: 'Учебник Idyllium',
      loading: 'Загружаем урок...',
      fatal: 'Учебник не загрузился',
      kicker: 'Урок',
      crossLabel: 'Открыть задачи',
      crossBase: '../tasks/',
      prevLabel: 'Предыдущий урок',
      nextLabel: 'Следующий урок',
    };

  // Корень раздела (…/book/ или …/tasks/). На испечённых страницах уроков
  // стоит <base href="../">, поэтому document.baseURI всегда указывает сюда —
  // и относительные fetch («lessons.json», «content/…») работают с любой
  // глубины. Адрес урока — настоящий путь без решётки: /book/console/setup.
  const ROOT_PATH = new URL('.', document.baseURI).pathname;

  const state = {
    manifest: null,
    flatLessons: [],
    currentLesson: null,
    search: '',
    lessonTimers: [],
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    els.body = document.body;
    els.nav = document.getElementById('lesson-nav');
    els.search = document.getElementById('lesson-search');
    els.view = document.getElementById('lesson-view');
    els.main = document.getElementById('docs-main');
    els.toc = document.getElementById('docs-toc');
    els.menuToggle = document.getElementById('menu-toggle');

    installDocsModalApi();
    // Тема — общий модуль сайта assets/site-theme.js: html[data-theme], кнопка #theme-toggle, хранение.
    bindShellEvents();

    // Сохранённые адреса эпохи решётки (/book/#/console/setup) живут вечно:
    // молча переезжаем на чистый путь.
    if (redirectLegacyHashRoute()) return;

    try {
      state.manifest = await fetchJson('lessons.json');
      state.flatLessons = flattenLessons(state.manifest);
      renderNavigation();
      await openCurrentRoute();
    } catch (error) {
      renderFatalError(error);
    }

    window.addEventListener('popstate', () => void safeOpenCurrentRoute());
  }

  // Ошибка навигации после первичной загрузки не должна тонуть в консоли:
  // пользователь видит ту же карточку, что и при ошибке загрузки.
  async function safeOpenCurrentRoute() {
    try {
      await openCurrentRoute();
    } catch (error) {
      renderFatalError(error);
    }
  }

  function redirectLegacyHashRoute() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [sectionId, lessonId] = raw.split('/').filter(Boolean);
    if (!sectionId || !lessonId) return false;
    location.replace(lessonUrl(sectionId, lessonId));
    return true;
  }

  function lessonUrl(sectionId, lessonId) {
    return `${ROOT_PATH}${encodeURIComponent(sectionId)}/${encodeURIComponent(lessonId)}`;
  }

  // Переход по внутренней ссылке без перезагрузки: адрес меняет pushState,
  // урок подгружается как раньше. Модифицированные клики (Ctrl, средняя
  // кнопка) не трогаем — пусть браузер честно откроет новую вкладку.
  function interceptRouteNavigation(event, url) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (`${location.pathname}${location.hash}` !== url) history.pushState(null, '', url);
    void safeOpenCurrentRoute();
  }

  function bindShellEvents() {
    els.menuToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    // Крестик очистки — значок «x» из набора; виден, пока в поле что-то есть.
    els.searchClear = document.getElementById('lesson-search-clear');
    if (els.searchClear && window.IdylliumIcons) els.searchClear.innerHTML = window.IdylliumIcons.svg('x', { size: 14 });
    const syncSearchClear = () => { if (els.searchClear) els.searchClear.hidden = els.search.value === ''; };
    els.search.addEventListener('input', () => {
      state.search = els.search.value.trim().toLowerCase();
      syncSearchClear();
      renderNavigation();
    });
    if (els.searchClear) {
      els.searchClear.addEventListener('click', () => {
        els.search.value = '';
        els.search.dispatchEvent(new Event('input', { bubbles: true }));
        els.search.focus();
      });
    }
    syncSearchClear();

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;

      if (link.classList.contains('nav-lesson') || link.classList.contains('lesson-step')) {
        document.body.classList.remove('sidebar-open');
        interceptRouteNavigation(event, link.getAttribute('href'));
        return;
      }

      if (link.classList.contains('toc-link')) {
        event.preventDefault();
        const target = document.getElementById(link.dataset.target ?? '');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const oldLessonRoute = routeForOldHtmlLink(link.getAttribute('href'));
      if (oldLessonRoute) {
        document.body.classList.remove('sidebar-open');
        interceptRouteNavigation(event, oldLessonRoute);
      }
    });
  }

  async function openCurrentRoute() {
    const route = parseRoute();
    const lesson = findLesson(route.sectionId, route.lessonId) ?? state.flatLessons[0];
    if (!lesson) return;

    // Кривой или пустой маршрут тихо выправляется на канонический адрес.
    if (lesson.sectionId !== route.sectionId || lesson.id !== route.lessonId) {
      history.replaceState(null, '', lessonUrl(lesson.sectionId, lesson.id));
    }

    await renderLesson(lesson);
  }

  function parseRoute() {
    let path = decodeURIComponent(location.pathname);
    if (!path.startsWith(ROOT_PATH)) return {};
    // Прямой заход мог прийти и как /setup, и как /setup.html, и со слэшем.
    path = path.slice(ROOT_PATH.length).replace(/\.html$/, '').replace(/\/+$/, '');
    const [sectionId, lessonId] = path.split('/').filter(Boolean);
    return { sectionId, lessonId };
  }

  function findLesson(sectionId, lessonId) {
    if (!sectionId || !lessonId) return null;
    return state.flatLessons.find((lesson) => lesson.sectionId === sectionId && lesson.id === lessonId) ?? null;
  }

  let lessonLoadToken = 0;

  async function renderLesson(lesson) {
    clearLessonTimers();
    state.currentLesson = lesson;
    renderNavigation();

    // На медленном интернете страница-предшественница остаётся на экране,
    // поэтому через 250 мс поверх появляется индикатор «урок грузится».
    // На быстром соединении таймер не успевает сработать — никакого мигания.
    const token = ++lessonLoadToken;
    const loadingTimer = window.setTimeout(showLessonLoading, 250);

    try {
      const response = await fetch(lesson.file, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`cannot load lesson: ${lesson.file}`);
      }

      const content = await response.text();
      // Пока грузился этот урок, пользователь мог кликнуть следующий —
      // устаревший ответ молча отбрасывается.
      if (token !== lessonLoadToken) return;

      const hero = renderHero(lesson);
      const footer = renderLessonFooter(lesson);
      // .prose — метка слоя содержимого (assets/site-content.css): проза урока, задачи, проекта.
      els.view.innerHTML = `${hero}<div class="lesson-body prose">${content}</div>${footer}`;
      executeLessonScripts();
      document.title = `${lesson.title} — ${UI.titleSuffix}`;
      renderToc();
      els.main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    } finally {
      window.clearTimeout(loadingTimer);
      if (token === lessonLoadToken) hideLessonLoading();
    }
  }

  function showLessonLoading() {
    if (els.main.querySelector('.lesson-loading')) return;
    const overlay = document.createElement('div');
    overlay.className = 'lesson-loading';
    overlay.innerHTML = `
      <div class="lesson-loading-box" role="status" aria-live="polite">
        <span class="ui-spinner lesson-loading-spinner" aria-hidden="true"></span>
        <span>${UI.loading}</span>
      </div>
    `;
    els.main.appendChild(overlay);
  }

  function hideLessonLoading() {
    const overlay = els.main.querySelector('.lesson-loading');
    if (overlay) overlay.remove();
  }

  function executeLessonScripts() {
    const scripts = [...els.view.querySelectorAll('script[data-lesson-script]')];
    for (const script of scripts) {
      runLessonScript(script.textContent ?? '');
    }
  }

  function runLessonScript(code) {
    if (!code.trim()) return;

    const originalDocumentAdd = document.addEventListener.bind(document);
    const originalSetInterval = window.setInterval.bind(window);
    const originalSetTimeout = window.setTimeout.bind(window);

    document.addEventListener = (type, listener, options) => {
      if (type === 'DOMContentLoaded' && typeof listener === 'function') {
        listener.call(document, new Event('DOMContentLoaded'));
        return;
      }
      originalDocumentAdd(type, listener, options);
    };

    window.setInterval = (...args) => {
      const id = originalSetInterval(...args);
      state.lessonTimers.push({ type: 'interval', id });
      return id;
    };

    window.setTimeout = (...args) => {
      const id = originalSetTimeout(...args);
      state.lessonTimers.push({ type: 'timeout', id });
      return id;
    };

    try {
      new Function(code)();
    } catch (error) {
      console.error('lesson script failed', error);
    } finally {
      document.addEventListener = originalDocumentAdd;
      window.setInterval = originalSetInterval;
      window.setTimeout = originalSetTimeout;
    }
  }

  function installDocsModalApi() {
    window.alert = (message) => {
      void showDocsModal({ title: 'Уведомление', message: String(message ?? ''), mode: 'alert' });
    };

    window.confirm = (message) => {
      void showDocsModal({ title: 'Подтверждение', message: String(message ?? ''), mode: 'confirm' });
      return true;
    };

    window.prompt = (message) => {
      const value = 'Idyllium';
      void showDocsModal({ title: 'Ввод текста', message: String(message ?? ''), mode: 'input', value });
      return value;
    };

    window.idylliumDocs = {
      alert: (message) => showDocsModal({ title: 'Уведомление', message: String(message ?? ''), mode: 'alert' }),
      confirm: (message) => showDocsModal({ title: 'Подтверждение', message: String(message ?? ''), mode: 'confirm' }),
      prompt: (message, value = 'Idyllium') => showDocsModal({ title: 'Ввод текста', message: String(message ?? ''), mode: 'input', value }),
    };
  }

  function clearLessonTimers() {
    for (const timer of state.lessonTimers) {
      if (timer.type === 'interval') {
        clearInterval(timer.id);
      } else {
        clearTimeout(timer.id);
      }
    }
    state.lessonTimers = [];
    document.querySelectorAll('.docs-modal-overlay').forEach((modal) => modal.remove());
  }

  function showDocsModal({ title, message, mode, value }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ui-backdrop docs-modal-overlay';
      const lines = String(message ?? '').split('\n').filter((line) => line.trim().length > 0);
      const body = lines.length > 0 ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '<p></p>';
      const input = mode === 'input'
        ? `<input class="ui-field docs-modal-input" type="text" value="${escapeHtml(value ?? '')}">`
        : '';
      const buttons = mode === 'confirm'
        ? '<button class="ui-button" type="button" data-result="false">Нет</button><button class="ui-button ui-button--tonal primary" type="button" data-result="true">Да</button>'
        : mode === 'input'
          ? '<button class="ui-button" type="button" data-result="null">Отмена</button><button class="ui-button ui-button--tonal primary" type="button" data-result="input">OK</button>'
          : '<button class="ui-button ui-button--tonal primary" type="button" data-result="true">OK</button>';

      overlay.innerHTML = `
        <div class="ui-dialog ui-dialog--sm docs-modal" role="dialog" aria-modal="true">
          <h3 class="ui-dialog-title">${escapeHtml(title)}</h3>
          <div class="ui-dialog-body docs-modal-message">${body}</div>
          ${input}
          <div class="ui-dialog-actions docs-modal-actions">${buttons}</div>
        </div>
      `;

      const close = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          close(mode === 'confirm' ? false : null);
          return;
        }

        const button = event.target.closest('[data-result]');
        if (!button) return;
        const result = button.dataset.result;
        if (result === 'true') close(true);
        else if (result === 'false') close(false);
        else if (result === 'input') close(overlay.querySelector('.docs-modal-input')?.value ?? '');
        else close(null);
      });

      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close(mode === 'confirm' ? false : null);
        if (event.key === 'Enter' && mode === 'input') {
          close(overlay.querySelector('.docs-modal-input')?.value ?? '');
        }
      });

      document.body.appendChild(overlay);
      const inputElement = overlay.querySelector('.docs-modal-input');
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      } else {
        overlay.querySelector('.primary')?.focus();
      }
    });
  }

  function renderHero(lesson) {
    const subtitle = lesson.subtitle ? `<p class="lesson-subtitle">${escapeHtml(lesson.subtitle)}</p>` : '';
    return `
      <header class="lesson-hero">
        <div class="lesson-kicker">
          <span>${escapeHtml(lesson.sectionTitle)}</span>
          <span>/</span>
          <span>${UI.kicker} ${lesson.number}</span>
        </div>
        <h1>${escapeHtml(lesson.title)}</h1>
        ${subtitle}
        ${renderCrossLink(lesson)}
      </header>
    `;
  }

  // Учебник ведёт на задачи по этой же теме, задачник — обратно на урок.
  // Пока практикум не написан, кнопка честно говорит об этом и никуда не ведёт.
  function renderCrossLink(lesson) {
    // У проектов нет парной страницы — перекрёстная кнопка не рисуется.
    if (UI.crossBase === '') return '';
    const target = `${UI.crossBase}${lesson.sectionId}/${lesson.id}`;
    if (MODE === 'book' && lesson.hasTasks !== true) {
      return '<span class="lesson-cross-link is-pending">Задачи готовятся</span>';
    }
    return `<a class="lesson-cross-link" href="${target}">${UI.crossLabel}</a>`;
  }

  function renderLessonFooter(lesson) {
    const index = state.flatLessons.indexOf(lesson);
    const prev = state.flatLessons[index - 1];
    const next = state.flatLessons[index + 1];

    return `
      <nav class="lesson-footer" aria-label="Переход между уроками">
        ${prev ? lessonStep(prev, UI.prevLabel, 'prev') : '<span></span>'}
        ${next ? lessonStep(next, UI.nextLabel, 'next') : '<span></span>'}
      </nav>
    `;
  }

  function lessonStep(lesson, label, direction) {
    return `
      <a class="lesson-step ${direction}" href="${lessonUrl(lesson.sectionId, lesson.id)}">
        <small>${label}</small>
        <span>${escapeHtml(lesson.title)}</span>
      </a>
    `;
  }

  function renderNavigation() {
    if (!state.manifest) return;
    const query = state.search;
    const current = state.currentLesson;

    els.nav.innerHTML = state.manifest.sections.map((section) => {
      const lessons = section.lessons
        .map((lesson, index) => ({ ...lesson, number: index + 1 }))
        .filter((lesson) => matchesSearch(section, lesson, query));
      const collapsed = query ? false : (sessionStorage.getItem(`docs-section-${section.id}`) === 'closed');

      if (query && lessons.length === 0) return '';

      return `
        <section class="nav-section ${collapsed ? 'collapsed' : ''}" data-section="${section.id}">
          <button class="ui-nav-group-button nav-section-button" type="button" data-section-toggle="${section.id}">
            <span>${sectionIcon(section.icon)}</span>
            <span class="nav-section-title">${escapeHtml(section.title)}</span>
            <span class="ui-nav-count nav-section-count">${lessons.length}</span>
          </button>
          <div class="nav-lessons">
            ${lessons.map((lesson) => navLesson(section, lesson, current)).join('')}
          </div>
        </section>
      `;
    }).join('');

    els.nav.querySelectorAll('[data-section-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.sectionToggle;
        const section = button.closest('.nav-section');
        section.classList.toggle('collapsed');
        sessionStorage.setItem(`docs-section-${id}`, section.classList.contains('collapsed') ? 'closed' : 'open');
      });
    });
  }

  function navLesson(section, lesson, current) {
    const active = current && current.sectionId === section.id && current.id === lesson.id;
    return `
      <a class="ui-nav-link nav-lesson ${active ? 'is-active active' : ''}" href="${lessonUrl(section.id, lesson.id)}">
        <span class="lesson-number">${String(lesson.number).padStart(2, '0')}</span>
        <span class="lesson-label">${escapeHtml(lesson.title)}</span>
      </a>
    `;
  }

  function renderToc() {
    const headings = [...els.view.querySelectorAll('.lesson-body h2, .lesson-body h3')]
      .filter((heading) => heading.textContent.trim());

    if (headings.length === 0) {
      els.toc.innerHTML = '';
      return;
    }

    headings.forEach((heading, index) => {
      heading.id = heading.id || `section-${index + 1}`;
    });

    els.toc.innerHTML = `
      <div class="ui-toc-title toc-title">На странице</div>
      ${headings.map((heading) => `
        <a class="ui-toc-link toc-link" href="#" data-target="${heading.id}">${escapeHtml(heading.textContent.trim())}</a>
      `).join('')}
    `;
  }

  function flattenLessons(manifest) {
    return manifest.sections.flatMap((section) => section.lessons.map((lesson, index) => ({
      ...lesson,
      number: index + 1,
      sectionId: section.id,
      sectionTitle: section.title,
    })));
  }

  function matchesSearch(section, lesson, query) {
    if (!query) return true;
    const haystack = `${section.title} ${lesson.title} ${lesson.subtitle}`.toLowerCase();
    return haystack.includes(query);
  }

  function routeForOldHtmlLink(href) {
    if (!href || !href.endsWith('.html') || !state.currentLesson) return null;
    const currentSource = state.currentLesson.sourceFile;
    if (!currentSource) return null;
    const baseParts = currentSource.split('/').slice(0, -1);
    const target = normalizePath([...baseParts, href].join('/'));
    const lesson = state.flatLessons.find((item) => item.sourceFile === target);
    return lesson ? lessonUrl(lesson.sectionId, lesson.id) : null;
  }

  function normalizePath(value) {
    const parts = [];
    for (const part of value.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return parts.join('/');
  }

  function sectionIcon(icon) {
    // Единый набор иконок сайта (gui-renderer/icons.js); ключи — из lessons.json.
    const names = {
      terminal: 'window-terminal', widgets: 'widgets', classes: 'sitemap', canvas: 'canvas',
      json: 'braces', turtle: 'turtle', network: 'globe', database: 'database', examples: 'package',
    };
    const icons = window.IdylliumIcons;
    if (!icons) return '';
    // Имя из набора проходит как есть (manifest несёт window-terminal и т. п.), старые ключи — по таблице.
    const name = icons.has(icon) ? icon : names[icon] || 'package';
    return icons.svg(name, { size: 18 });
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`cannot load ${url}`);
    return response.json();
  }

  function renderFatalError(error) {
    console.error(error);
    // Обычная причина — мигнувшая сеть или недокачанный файл; совет
    // обновить страницу решает почти все такие случаи (просьба владельца,
    // 2026-08-29).
    els.view.innerHTML = `
      <div class="ui-state ui-state--error error-card">
        <h1>${escapeHtml(UI.fatal)}</h1>
        <p>${escapeHtml(String(error?.message ?? error))}</p>
        <p>Попробуйте обновить страницу — чаще всего этого достаточно.
        Если не помогло, проверьте подключение к интернету.</p>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  function isIdentStart(ch) {
    return /^[a-zA-Z_\u00C0-\u024F\u0400-\u04FF]$/.test(ch);
  }

  function isIdentPart(ch) {
    return /^[a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF]$/.test(ch);
  }

  function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
  }

  function isPascalCase(name) {
    return name.length > 0 && name[0] >= 'A' && name[0] <= 'Z';
  }

  function extractClassNames(source) {
    const classNames = new Set();
    const regex = /\bclass\s+([A-Z][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
      classNames.add(match[1]);
    }
    return classNames;
  }

  function extractImportedModules(source) {
    const modules = new Set();
    const regex = /\buse\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
      modules.add(match[1]);
    }
    return modules;
  }

  function tokenize(source) {
    const tokens = [];
    let pos = 0;
    const len = source.length;
    const userClasses = extractClassNames(source);
    const importedModules = extractImportedModules(source);

    function peekNonWhitespace(startPos) {
      let p = startPos;
      while (p < len && isWhitespace(source[p])) p++;
      return p < len ? source[p] : '';
    }

    function lastSignificantToken() {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].category !== 'plain') return tokens[i];
      }
      return null;
    }

    function significantToken(depth) {
      let remaining = depth;
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].category === 'plain') continue;
        if (remaining === 0) return tokens[i];
        remaining--;
      }
      return null;
    }

    // Имя с большой буквы — класснейм только в позиции класса, а не всегда:
    // переменные вроде `int A` или `time.stamp N` больше не красятся как типы.
    function isClassNamePosition() {
      // Тип перед именем: `Hero kaspar(...)`, `Animal a;`, параметр `(Animal animal)`
      if (/^\s+[a-zA-Z_\u0400-\u04FF][a-zA-Z0-9_\u0400-\u04FF]*\s*(?:[=;,)(\[]|$)/.test(source.slice(pos))) return true;
      // Конструктор-выражение: `Hero("Raven", 600)`
      if (peekNonWhitespace(pos) === '(') return true;
      const lastTok = lastSignificantToken();
      if (lastTok && (lastTok.text === 'extends' || lastTok.text === 'class')) return true;
      // Параметр дженерика: `dyn_array<Hero>`
      if (lastTok && lastTok.text === '<') {
        const beforeAngle = significantToken(1);
        if (beforeAngle && (beforeAngle.text === 'array' || beforeAngle.text === 'dyn_array')) return true;
      }
      return false;
    }

    function tokenBeforeDot() {
      let dotFound = false;
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].category === 'plain') continue;
        if (tokens[i].text === '.') {
          dotFound = true;
          continue;
        }
        if (dotFound) return tokens[i];
      }
      return null;
    }

    while (pos < len) {
      const ch = source[pos];

      if (isWhitespace(ch)) {
        let text = '';
        while (pos < len && isWhitespace(source[pos])) text += source[pos++];
        tokens.push({ text, category: 'plain' });
        continue;
      }

      if (ch === '/' && source[pos + 1] === '/') {
        let text = '';
        while (pos < len && source[pos] !== '\n') text += source[pos++];
        tokens.push({ text, category: 'comment' });
        continue;
      }

      if (ch === '/' && source[pos + 1] === '*') {
        let text = '/*';
        pos += 2;
        while (pos < len) {
          if (source[pos] === '*' && source[pos + 1] === '/') {
            text += '*/';
            pos += 2;
            break;
          }
          text += source[pos++];
        }
        tokens.push({ text, category: 'comment' });
        continue;
      }

      if (ch === '"' || ch === "'") {
        const quote = ch;
        let text = quote;
        pos++;
        while (pos < len && source[pos] !== quote) {
          if (source[pos] === '\\' && pos + 1 < len) {
            text += source[pos] + source[pos + 1];
            pos += 2;
          } else if (source[pos] === '\n') {
            break;
          } else {
            text += source[pos++];
          }
        }
        if (pos < len && source[pos] === quote) {
          text += quote;
          pos++;
        }
        tokens.push({ text, category: 'string' });
        continue;
      }

      if (isDigit(ch)) {
        let text = '';
        while (pos < len && (isDigit(source[pos]) || source[pos] === '.')) text += source[pos++];
        tokens.push({ text, category: 'number' });
        continue;
      }

      if (isIdentStart(ch)) {
        let text = '';
        while (pos < len && isIdentPart(source[pos])) text += source[pos++];

        let category = 'object';
        const nextChar = peekNonWhitespace(pos);
        const lastTok = lastSignificantToken();
        const afterDot = lastTok !== null && lastTok.text === '.';

        if (afterDot) {
          const beforeDot = tokenBeforeDot();
          const isAfterModule = beforeDot !== null && importedModules.has(beforeDot.text);
          const isQualifiedTypePosition = /^\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(?:[=;,)\[]|$)/
            .test(source.slice(pos));
          if (QUALIFIED_TYPES.has(text) || isQualifiedTypePosition) category = 'className';
          else if (isAfterModule && isPascalCase(text)) category = 'className';
          else if (nextChar === '(') category = 'function';
        } else if (TYPES.has(text)) {
          category = 'typeName';
        } else if (KEYWORDS.has(text)) {
          category = 'keyword';
        } else if (userClasses.has(text) || (isPascalCase(text) && isClassNamePosition())) {
          category = 'className';
        } else if (nextChar === '(') {
          category = 'function';
        }

        tokens.push({ text, category });
        continue;
      }

      const twoChar = source.substring(pos, pos + 2);
      if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%='].includes(twoChar)) {
        tokens.push({ text: twoChar, category: 'brackets' });
        pos += 2;
        continue;
      }

      if ('+-*/%<>=!{}[]();,.:~'.includes(ch)) {
        tokens.push({ text: ch, category: 'brackets' });
        pos++;
        continue;
      }

      tokens.push({ text: ch, category: 'plain' });
      pos++;
    }

    return tokens;
  }

  function highlightIdyllium(code) {
    return tokenize(code).map((token) => {
      const text = escapeHtml(token.text);
      return token.category === 'plain' ? text : `<span class="hl-${token.category}">${text}</span>`;
    }).join('');
  }

  function highlightSql(source) {
    const tokens = [];
    let pos = 0;

    while (pos < source.length) {
      const ch = source[pos];

      if (isWhitespace(ch)) {
        let text = '';
        while (pos < source.length && isWhitespace(source[pos])) text += source[pos++];
        tokens.push({ text, category: 'plain' });
        continue;
      }

      if (ch === '-' && source[pos + 1] === '-') {
        let text = '';
        while (pos < source.length && source[pos] !== '\n') text += source[pos++];
        tokens.push({ text, category: 'comment' });
        continue;
      }

      if (ch === "'") {
        let text = ch;
        pos++;
        while (pos < source.length) {
          text += source[pos];
          if (source[pos] === "'") {
            if (source[pos + 1] === "'") {
              text += source[pos + 1];
              pos += 2;
              continue;
            }
            pos++;
            break;
          }
          pos++;
        }
        tokens.push({ text, category: 'string' });
        continue;
      }

      if (isDigit(ch)) {
        let text = '';
        while (pos < source.length && (isDigit(source[pos]) || source[pos] === '.')) {
          text += source[pos++];
        }
        tokens.push({ text, category: 'number' });
        continue;
      }

      if (isIdentStart(ch)) {
        let text = '';
        while (pos < source.length && isIdentPart(source[pos])) text += source[pos++];
        const upper = text.toUpperCase();
        let category = 'object';
        if (SQL_TYPES.has(upper)) category = 'typeName';
        else if (SQL_KEYWORDS.has(upper)) category = 'keyword';
        else if (source.slice(pos).trimStart().startsWith('(')) category = 'function';
        tokens.push({ text, category });
        continue;
      }

      if ('+-*/%=<>(),.;'.includes(ch)) {
        tokens.push({ text: ch, category: 'brackets' });
        pos++;
        continue;
      }

      tokens.push({ text: ch, category: 'plain' });
      pos++;
    }

    return tokens.map((token) => {
      const text = escapeHtml(token.text);
      return token.category === 'plain' ? text : `<span class="hl-${token.category}">${text}</span>`;
    }).join('');
  }

  function highlightJson(source) {
    const tokens = [];
    let pos = 0;

    function push(text, category = 'plain') {
      tokens.push({ text, category });
    }

    function nextNonWhitespace(startPos) {
      let cursor = startPos;
      while (cursor < source.length && isWhitespace(source[cursor])) cursor++;
      return source[cursor] ?? '';
    }

    while (pos < source.length) {
      const ch = source[pos];

      if (isWhitespace(ch)) {
        const start = pos;
        while (pos < source.length && isWhitespace(source[pos])) pos++;
        push(source.slice(start, pos));
        continue;
      }

      // JSON does not permit comments, but highlighting them makes deliberately
      // invalid teaching examples readable without pretending they are strings.
      if (ch === '/' && source[pos + 1] === '/') {
        const start = pos;
        while (pos < source.length && source[pos] !== '\n') pos++;
        push(source.slice(start, pos), 'comment');
        continue;
      }

      if (ch === '/' && source[pos + 1] === '*') {
        const start = pos;
        pos += 2;
        while (pos < source.length && !(source[pos] === '*' && source[pos + 1] === '/')) pos++;
        if (pos < source.length) pos += 2;
        push(source.slice(start, pos), 'comment');
        continue;
      }

      if (ch === '"') {
        const start = pos++;
        while (pos < source.length) {
          if (source[pos] === '\\' && pos + 1 < source.length) {
            pos += 2;
            continue;
          }
          if (source[pos] === '"') {
            pos++;
            break;
          }
          pos++;
        }
        push(source.slice(start, pos), nextNonWhitespace(pos) === ':' ? 'jsonKey' : 'string');
        continue;
      }

      const number = source.slice(pos).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (number) {
        push(number[0], 'number');
        pos += number[0].length;
        continue;
      }

      const literal = source.slice(pos).match(/^(?:true|false|null)\b/);
      if (literal) {
        push(literal[0], 'keyword');
        pos += literal[0].length;
        continue;
      }

      if ('{}[],:'.includes(ch)) {
        push(ch, 'brackets');
        pos++;
        continue;
      }

      push(ch);
      pos++;
    }

    return tokens.map((token) => {
      const text = escapeHtml(token.text);
      return token.category === 'plain' ? text : `<span class="hl-${token.category}">${text}</span>`;
    }).join('');
  }

  // Кнопка «В Web IDE» у примеров (1.6.5): выключена, пока её не включат в Web IDE, «Внешний вид» —
  // по умолчанию примеры переносят руками (вердикт владельца), но выбор за школой и учеником.
  function openInIdeEnabled() {
    try { return window.localStorage.getItem('idyllium-open-in-ide') === 'on'; } catch (error) { return false; }
  }

  /** Адрес Web IDE с программой: корень сайта берём у кнопки «Открыть IDE» в шапке. */
  function ideAddress(link) {
    const action = document.querySelector('.ui-topbar-action');
    const prefix = action ? action.getAttribute('href') || '' : '';
    return `${prefix}#${link}`;
  }

  function renderCodeBlock(element, code, highlightedCode, language = '', ideLink = '') {
    const wrapper = document.createElement('div');
    const languageId = language.toLowerCase();
    wrapper.className = languageId
      ? `ui-code idyl-code-wrapper ${languageId}-code-wrapper`
      : 'ui-code idyl-code-wrapper';

    const pre = document.createElement('pre');
    pre.className = 'idyl-pre';
    pre.innerHTML = `<code class="${languageId ? `${languageId}-code` : 'idyl-code'}">${highlightedCode}</code>`;

    if (language) {
      const label = document.createElement('span');
      label.className = 'ui-code-lang code-language';
      label.textContent = language;
      wrapper.appendChild(label);
    }

    const button = document.createElement('button');
    button.className = 'ui-button ui-button--sm ui-code-copy idyl-copy-btn';
    button.type = 'button';
    button.textContent = 'Копировать';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        button.classList.add('copied', 'is-done');
        button.textContent = 'Скопировано';
        setTimeout(() => {
          button.classList.remove('copied', 'is-done');
          button.textContent = 'Копировать';
        }, 1000);
      } catch {
        button.textContent = 'Ошибка';
      }
    });

    if (ideLink && openInIdeEnabled()) {
      const open = document.createElement('a');
      open.className = 'ui-button ui-button--sm ui-code-open';
      open.href = ideAddress(ideLink);
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'В Web IDE';
      open.title = 'Открыть пример в Web IDE: он откроется гостем, своя работа там не пострадает';
      const tools = document.createElement('div');
      tools.className = 'ui-code-tools';
      tools.append(open, button);
      wrapper.append(pre, tools);
    } else {
      wrapper.append(pre, button);
    }
    element.innerHTML = '';
    element.appendChild(wrapper);
  }

  class IdylCodeBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';

      const script = this.querySelector('script[type="text/plain"]');
      const raw = script ? script.textContent : this.textContent;
      const code = (raw ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');

      renderCodeBlock(this, code, highlightIdyllium(code), '', this.dataset.ide || '');
    }
  }

  class SqlCodeBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';

      const script = this.querySelector('script[type="text/plain"]');
      const raw = script ? script.textContent : this.textContent;
      const code = (raw ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');
      renderCodeBlock(this, code, highlightSql(code), 'SQL');
    }
  }

  class JsonCodeBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';

      const script = this.querySelector('script[type="text/plain"]');
      const raw = script ? script.textContent : this.textContent;
      const code = (raw ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');
      renderCodeBlock(this, code, highlightJson(code), 'JSON');
    }
  }

  class IdylOutputBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';
      const div = document.createElement('div');
      div.className = 'ui-code ui-code--output idyl-output';
      div.dataset.label = 'Вывод';
      div.innerHTML = (this.innerHTML ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');
      this.innerHTML = '';
      this.appendChild(div);
    }
  }

  class IdylErrorBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';
      const div = document.createElement('div');
      div.className = 'ui-code ui-code--error idyl-error';
      div.dataset.label = 'Ошибка';
      div.textContent = (this.textContent ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');
      this.innerHTML = '';
      this.appendChild(div);
    }
  }

  // Демонстрация урока (стилевая база 1.6.4, этап 5): снимок окон настоящей
  // программы, запечённый сборкой (tools/lesson-gui-demos.ts), рисует настоящий
  // рендерер в кадре ../gui-demo.html — тот же код, что предпросмотр Web IDE.
  // Кадр реальных размеров окна; шире колонки — уменьшается целиком. Тема
  // кадра следует теме сайта. Демо — картинка, не игра: сцена кадра inert.
  const GUI_DEMO_FRAME = '../gui-demo.html';
  // Запас кадра справа и снизу. Кадр — <iframe>, и браузер округляет его до целых пикселей экрана
  // отдельно от окна внутри: при дробном масштабе экрана (1.0625 — Chrome на мониторе 21,5″, 1.25 —
  // ноутбуки) нижняя или правая рамка окна оставалась за краем кадра. Двух пикселей хватает от масштаба 0.5.
  const GUI_DEMO_EDGE_SLACK = 2;

  function siteTheme() {
    if (window.idylliumTheme && typeof window.idylliumTheme.get === 'function') return window.idylliumTheme.get();
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  class IdylGuiDemo extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready !== '1') {
        this.dataset.ready = '1';
        this.build();
      }
      this.attach();
    }

    disconnectedCallback() {
      this.detach();
    }

    build() {
      const script = this.querySelector('script[type="application/json"]');
      let snapshot = null;
      try {
        snapshot = script ? JSON.parse(script.textContent || '') : null;
      } catch {
        snapshot = null;
      }
      const width = Number(this.dataset.frameWidth) || 0;
      const height = Number(this.dataset.frameHeight) || 0;
      const caption = this.getAttribute('caption');
      this.innerHTML = '';

      if (!snapshot || width <= 0 || height <= 0) {
        const note = document.createElement('div');
        note.className = 'ui-state ui-state--error';
        note.textContent = 'Демонстрация не собрана: у этого демо нет снимка программы.';
        this.appendChild(note);
        return;
      }

      this.snapshot = snapshot;
      this.frameWidth = width + GUI_DEMO_EDGE_SLACK;
      this.frameHeight = height + GUI_DEMO_EDGE_SLACK;

      const figure = document.createElement('figure');
      figure.className = 'ui-gui-demo';
      const firstWindow = (snapshot.windows || [])[0];
      const windowTitle = firstWindow && firstWindow.properties && typeof firstWindow.properties.title === 'string'
        ? firstWindow.properties.title
        : '';
      figure.setAttribute('aria-label', windowTitle ? `Окно программы «${windowTitle}»` : 'Окно программы');

      const viewport = document.createElement('div');
      viewport.className = 'ui-gui-demo-viewport';
      const frame = document.createElement('div');
      frame.className = 'ui-gui-demo-frame';
      frame.style.width = `${this.frameWidth}px`;
      frame.style.height = `${this.frameHeight}px`;
      const iframe = document.createElement('iframe');
      iframe.className = 'ui-gui-demo-canvas';
      iframe.src = GUI_DEMO_FRAME;
      iframe.loading = 'lazy';
      iframe.tabIndex = -1;
      iframe.setAttribute('title', windowTitle || 'Окно программы');
      iframe.setAttribute('aria-hidden', 'true');
      frame.appendChild(iframe);
      viewport.appendChild(frame);
      figure.appendChild(viewport);
      if (caption) {
        const figcaption = document.createElement('figcaption');
        figcaption.className = 'ui-gui-demo-caption' + (this.getAttribute('caption-font') === 'mono' ? ' ui-gui-demo-caption--mono' : '');
        figcaption.textContent = caption;
        figure.appendChild(figcaption);
      }
      this.appendChild(figure);

      this.viewport = viewport;
      this.frame = frame;
      this.iframe = iframe;
      iframe.addEventListener('load', () => this.post());
    }

    attach() {
      if (!this.iframe) return;
      this.onMessage = (event) => {
        if (!this.iframe || event.source !== this.iframe.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== 'idylliumGuiEvent' || !data.message) return;
        // Рендерер готов или потерял холст — отдаём снимок ещё раз.
        if (data.message.type === 'rendererReady' || data.message.type === 'canvasResync') this.post();
      };
      this.onTheme = () => this.postTheme();
      this.onResize = () => this.fit();
      window.addEventListener('message', this.onMessage);
      document.addEventListener('idyllium-theme-change', this.onTheme);
      if (typeof ResizeObserver === 'function') {
        this.observer = new ResizeObserver(this.onResize);
        this.observer.observe(this.viewport);
      } else {
        window.addEventListener('resize', this.onResize);
      }
      this.fit();
    }

    detach() {
      if (this.onMessage) window.removeEventListener('message', this.onMessage);
      if (this.onTheme) document.removeEventListener('idyllium-theme-change', this.onTheme);
      if (this.observer) this.observer.disconnect();
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      this.onMessage = null;
      this.onTheme = null;
      this.onResize = null;
      this.observer = null;
    }

    postTheme() {
      const target = this.iframe && this.iframe.contentWindow;
      if (!target) return;
      target.postMessage({ type: 'theme', theme: siteTheme() }, '*');
    }

    post() {
      const target = this.iframe && this.iframe.contentWindow;
      if (!target || !this.snapshot) return;
      this.postTheme();
      target.postMessage({
        type: 'snapshot',
        generation: 1,
        audio: [],
        windows: this.snapshot.windows || [],
        canvases: this.snapshot.canvases || [],
        modals: this.snapshot.modals || [],
        output: '',
      }, '*');
    }

    // Масштаб: кадр реальных размеров; если он шире колонки — уменьшается целиком.
    fit() {
      if (!this.viewport || !this.frame) return;
      const available = this.viewport.clientWidth;
      const scale = available > 0 && available < this.frameWidth ? available / this.frameWidth : 1;
      this.frame.style.transform = scale === 1 ? '' : `scale(${scale})`;
      this.viewport.style.height = `${Math.round(this.frameHeight * scale)}px`;
    }
  }

  customElements.define('idyl-code-block', IdylCodeBlock);
  customElements.define('sql-code-block', SqlCodeBlock);
  customElements.define('json-code-block', JsonCodeBlock);
  customElements.define('idyl-output-block', IdylOutputBlock);
  customElements.define('idyl-error-block', IdylErrorBlock);
  customElements.define('idyl-gui-demo', IdylGuiDemo);
})();
