(() => {
  const KEYWORDS = new Set([
    'use', 'if', 'else', 'while', 'do', 'for', 'break', 'continue', 'return',
    'try', 'catch', 'function', 'class', 'extends', 'this', 'constructor',
    'destructor', 'public', 'private', 'static', 'parent', 'and', 'or', 'xor',
    'not', 'true', 'false',
  ]);

  const TYPES = new Set([
    'int', 'float', 'string', 'char', 'bool', 'void', 'array', 'dyn_array', 'set',
  ]);

  const QUALIFIED_TYPES = new Set([
    'Array', 'Color', 'Drawable', 'Font', 'Music', 'Object', 'Sound', 'Texture', 'Value',
    'Circle', 'Line', 'Rectangle', 'Sprite', 'Text',
    'istream', 'ostream', 'stream', 'stamp',
    'Window', 'Widget', 'Button', 'Label', 'SpinBox', 'FloatSpinBox',
    'LineEdit', 'CheckBox', 'ProgressBar', 'TextEdit',
    'ComboBox', 'Slider', 'Frame', 'Timer', 'Modal', 'RadioButton', 'Image',
    'Canvas', 'KeyboardEvent', 'MouseEvent', 'MouseScrollEvent',
    'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float32', 'float64',
  ]);

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
    els.themeToggle = document.getElementById('theme-toggle');
    els.menuToggle = document.getElementById('menu-toggle');

    installDocsModalApi();
    applySavedTheme();
    bindShellEvents();

    try {
      state.manifest = await fetchJson('lessons.json');
      state.flatLessons = flattenLessons(state.manifest);
      renderNavigation();
      await openCurrentRoute();
    } catch (error) {
      renderFatalError(error);
    }

    window.addEventListener('hashchange', openCurrentRoute);
  }

  function bindShellEvents() {
    els.themeToggle.addEventListener('click', () => {
      const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
      localStorage.setItem('idyllium-docs-theme', next);
      applyTheme(next);
    });

    els.menuToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    els.search.addEventListener('input', () => {
      state.search = els.search.value.trim().toLowerCase();
      renderNavigation();
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;

      if (link.classList.contains('nav-lesson') || link.classList.contains('lesson-step')) {
        document.body.classList.remove('sidebar-open');
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
        event.preventDefault();
        location.hash = oldLessonRoute;
        document.body.classList.remove('sidebar-open');
      }
    });
  }

  function applySavedTheme() {
    applyTheme(localStorage.getItem('idyllium-docs-theme') ?? 'dark');
  }

  function applyTheme(theme) {
    const light = theme === 'light';
    document.body.classList.toggle('light-theme', light);
    els.themeToggle.textContent = light ? 'Тёмная тема' : 'Светлая тема';
  }

  async function openCurrentRoute() {
    const route = parseRoute();
    const lesson = findLesson(route.sectionId, route.lessonId) ?? state.flatLessons[0];
    if (!lesson) return;

    if (!location.hash || lesson.sectionId !== route.sectionId || lesson.id !== route.lessonId) {
      location.replace(`${location.pathname}${location.search}#/${lesson.sectionId}/${lesson.id}`);
      return;
    }

    await renderLesson(lesson);
  }

  function parseRoute() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [sectionId, lessonId] = raw.split('/').filter(Boolean);
    return { sectionId, lessonId };
  }

  function findLesson(sectionId, lessonId) {
    if (!sectionId || !lessonId) return null;
    return state.flatLessons.find((lesson) => lesson.sectionId === sectionId && lesson.id === lessonId) ?? null;
  }

  async function renderLesson(lesson) {
    clearLessonTimers();
    state.currentLesson = lesson;
    renderNavigation();

    const response = await fetch(lesson.file, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`cannot load lesson: ${lesson.file}`);
    }

    const content = await response.text();
    const hero = renderHero(lesson);
    const footer = renderLessonFooter(lesson);
    els.view.innerHTML = `${hero}<div class="lesson-body">${content}</div>${footer}`;
    executeLessonScripts();
    document.title = `${lesson.title} — Idyllium`;
    renderToc();
    els.main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
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
      overlay.className = 'docs-modal-overlay';
      const lines = String(message ?? '').split('\n').filter((line) => line.trim().length > 0);
      const body = lines.length > 0 ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '<p></p>';
      const input = mode === 'input'
        ? `<input class="docs-modal-input" type="text" value="${escapeHtml(value ?? '')}">`
        : '';
      const buttons = mode === 'confirm'
        ? '<button type="button" data-result="false">Нет</button><button class="primary" type="button" data-result="true">Да</button>'
        : mode === 'input'
          ? '<button type="button" data-result="null">Отмена</button><button class="primary" type="button" data-result="input">OK</button>'
          : '<button class="primary" type="button" data-result="true">OK</button>';

      overlay.innerHTML = `
        <div class="docs-modal" role="dialog" aria-modal="true">
          <h3>${escapeHtml(title)}</h3>
          <div class="docs-modal-message">${body}</div>
          ${input}
          <div class="docs-modal-actions">${buttons}</div>
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
          <span>Урок ${lesson.number}</span>
        </div>
        <h1>${escapeHtml(lesson.title)}</h1>
        ${subtitle}
      </header>
    `;
  }

  function renderLessonFooter(lesson) {
    const index = state.flatLessons.indexOf(lesson);
    const prev = state.flatLessons[index - 1];
    const next = state.flatLessons[index + 1];

    return `
      <nav class="lesson-footer" aria-label="Переход между уроками">
        ${prev ? lessonStep(prev, 'Предыдущий урок', 'prev') : '<span></span>'}
        ${next ? lessonStep(next, 'Следующий урок', 'next') : '<span></span>'}
      </nav>
    `;
  }

  function lessonStep(lesson, label, direction) {
    return `
      <a class="lesson-step ${direction}" href="#/${lesson.sectionId}/${lesson.id}">
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
          <button class="nav-section-button" type="button" data-section-toggle="${section.id}">
            <span>${sectionIcon(section.icon)}</span>
            <span class="nav-section-title">${escapeHtml(section.title)}</span>
            <span class="nav-section-count">${lessons.length}</span>
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
      <a class="nav-lesson ${active ? 'active' : ''}" href="#/${section.id}/${lesson.id}">
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
      <div class="toc-title">На странице</div>
      ${headings.map((heading) => `
        <a class="toc-link" href="#" data-target="${heading.id}">${escapeHtml(heading.textContent.trim())}</a>
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
    return lesson ? `#/${lesson.sectionId}/${lesson.id}` : null;
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
    const icons = {
      terminal: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5 5.5 8 2 11.5M7 12h7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      widgets: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.5"/></svg>',
      classes: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      canvas: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="6" r="1.3" fill="currentColor"/><path d="M4 12l3.2-3 2 1.8L12 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      json: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H5a2 2 0 0 0-2 2v1a2 2 0 0 1-1 2 2 2 0 0 1 1 2v1a2 2 0 0 0 2 2h1M10 3h1a2 2 0 0 1 2 2v1a2 2 0 0 0 1 2 2 2 0 0 0-1 2v1a2 2 0 0 1-2 2h-1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
      examples: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 2.5 8l3 5M10.5 3l3 5-3 5M7 13l2-10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return icons[icon] ?? icons.examples;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`cannot load ${url}`);
    return response.json();
  }

  function renderFatalError(error) {
    console.error(error);
    els.view.innerHTML = `
      <div class="error-card">
        <h1>Документация не загрузилась</h1>
        <p>${escapeHtml(String(error?.message ?? error))}</p>
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
          if (QUALIFIED_TYPES.has(text)) category = 'className';
          else if (isAfterModule && isPascalCase(text)) category = 'className';
          else if (nextChar === '(') category = 'function';
        } else if (TYPES.has(text)) {
          category = 'typeName';
        } else if (KEYWORDS.has(text)) {
          category = 'keyword';
        } else if (userClasses.has(text) || isPascalCase(text)) {
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

  class IdylCodeBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';

      const script = this.querySelector('script[type="text/plain"]');
      const raw = script ? script.textContent : this.textContent;
      const code = (raw ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');

      const wrapper = document.createElement('div');
      wrapper.className = 'idyl-code-wrapper';

      const pre = document.createElement('pre');
      pre.className = 'idyl-pre';
      pre.innerHTML = `<code class="idyl-code">${highlightIdyllium(code)}</code>`;

      const button = document.createElement('button');
      button.className = 'idyl-copy-btn';
      button.type = 'button';
      button.textContent = 'Копировать';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code);
          button.classList.add('copied');
          button.textContent = 'Скопировано';
          setTimeout(() => {
            button.classList.remove('copied');
            button.textContent = 'Копировать';
          }, 1000);
        } catch {
          button.textContent = 'Ошибка';
        }
      });

      wrapper.append(pre, button);
      this.innerHTML = '';
      this.appendChild(wrapper);
    }
  }

  class IdylOutputBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === '1') return;
      this.dataset.ready = '1';
      const div = document.createElement('div');
      div.className = 'idyl-output';
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
      div.className = 'idyl-error';
      div.textContent = (this.textContent ?? '').replace(/^\n/, '').replace(/\n\s*$/, '');
      this.innerHTML = '';
      this.appendChild(div);
    }
  }

  customElements.define('idyl-code-block', IdylCodeBlock);
  customElements.define('idyl-output-block', IdylOutputBlock);
  customElements.define('idyl-error-block', IdylErrorBlock);
})();
