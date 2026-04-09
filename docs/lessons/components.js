// docs/lessons/components.js

const KEYWORDS = new Set([
  'use', 'if', 'else', 'while', 'do', 'for', 'break', 'continue', 'return',
  'try', 'catch',
  'function', 'class', 'extends', 'this', 'constructor', 'destructor',
  'public', 'private',
  'and', 'or', 'xor', 'not',
  'true', 'false',
]);

const TYPES = new Set([
  'int', 'float', 'string', 'char', 'bool', 'void',
  'array', 'dyn_array', 'set',
]);

const QUALIFIED_TYPES = new Set([
  'istream', 'ostream', 'stream', 'stamp',
  'Window', 'Button', 'Label', 'SpinBox', 'FloatSpinBox',
  'LineEdit', 'CheckBox', 'ProgressBar', 'TextEdit',
  'ComboBox', 'Slider', 'Frame', 'Timer', 'Modal',
  'int8', 'int16', 'int32', 'int64',
  'uint8', 'uint16', 'uint32', 'uint64',
  'float32', 'float64',
]);

function isDigit(ch) { return ch >= '0' && ch <= '9'; }
function isIdentStart(ch) { return /^[a-zA-Z_\u00C0-\u024F\u0400-\u04FF]$/.test(ch); }
function isIdentPart(ch) { return /^[a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF]$/.test(ch); }
function isWhitespace(ch) { return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n'; }
function isPascalCase(name) { return name.length > 0 && name[0] >= 'A' && name[0] <= 'Z'; }

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

      // Single-line comment
      if (ch === '/' && source[pos + 1] === '/') {
          let text = '';
          while (pos < len && source[pos] !== '\n') text += source[pos++];
          tokens.push({ text, category: 'comment' });
          continue;
      }

      // Multi-line comment
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

      // String "..."
      if (ch === '"') {
          let text = '"';
          pos++;
          while (pos < len && source[pos] !== '"') {
              if (source[pos] === '\\' && pos + 1 < len) {
                  text += source[pos] + source[pos + 1];
                  pos += 2;
              } else if (source[pos] === '\n') break;
              else text += source[pos++];
          }
          if (pos < len && source[pos] === '"') text += '"', pos++;
          tokens.push({ text, category: 'string' });
          continue;
      }

      // Char '...'
      if (ch === "'") {
          let text = "'";
          pos++;
          while (pos < len && source[pos] !== "'") {
              if (source[pos] === '\\' && pos + 1 < len) {
                  text += source[pos] + source[pos + 1];
                  pos += 2;
              } else if (source[pos] === '\n') break;
              else text += source[pos++];
          }
          if (pos < len && source[pos] === "'") text += "'", pos++;
          tokens.push({ text, category: 'string' });
          continue;
      }

      // Number
      if (isDigit(ch)) {
          let text = '';
          while (pos < len && (isDigit(source[pos]) || source[pos] === '.')) text += source[pos++];
          tokens.push({ text, category: 'number' });
          continue;
      }

      // Identifier / keyword
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
              
              if (QUALIFIED_TYPES.has(text)) {
                  category = 'className';
              } else if (isAfterModule && isPascalCase(text)) {
                  category = 'className';
              } else if (nextChar === '(') {
                  category = 'function';
              } else {
                  category = 'object';
              }
          } else if (TYPES.has(text)) {
              category = 'typeName';
          } else if (KEYWORDS.has(text)) {
              category = 'keyword';
          } else if (userClasses.has(text)) {
              category = 'className';
          } else if (nextChar === '(') {
              category = 'function';
          }

          tokens.push({ text, category });
          continue;
      }

      // Two-char operators
      const twoChar = source.substring(pos, pos + 2);
      if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/='].includes(twoChar)) {
          tokens.push({ text: twoChar, category: 'brackets' });
          pos += 2;
          continue;
      }

      // Single char punctuation
      if ('+-*/<>=!{}[]();,.:~'.includes(ch)) {
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
  const escape = s => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const tokens = tokenize(code);
  let html = '';

  for (const tok of tokens) {
      const escaped = escape(tok.text);
      if (tok.category === 'plain') {
          html += escaped;
      } else {
          html += `<span class="hl-${tok.category}">${escaped}</span>`;
      }
  }

  return html;
}


/* ─── <idyl-code-block> ──────────────────────────────────────────────────── */

class IdylCodeBlock extends HTMLElement {
  connectedCallback() {
    const raw = this.textContent ?? '';
    const code = raw.replace(/^\n/, '').replace(/\n\s*$/, '');

    const pre = document.createElement('pre');
    pre.className = 'idyl-pre';

    const highlighted = highlightIdyllium(code);
    pre.innerHTML = `<code class="idyl-code">${highlighted}</code>`;

    // Copy button
    const btn = document.createElement('button');
    btn.className = 'idyl-copy-btn';
    btn.title = 'Скопировать';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5V2.5A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5V3"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 8.5 L6 12 L13.5 4" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        btn.style.opacity = '1';
        setTimeout(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5V2.5A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5V3"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>`;
        }, 1800);
      } catch {
        btn.textContent = '✗';
      }
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'idyl-code-wrapper';
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);

    this.innerHTML = '';
    this.appendChild(wrapper);
  }
}

customElements.define('idyl-code-block', IdylCodeBlock);


/* ─── <idyl-sidebar> ─────────────────────────────────────────────────────── */

class IdylSidebar extends HTMLElement {
  async connectedCallback() {
    const jsonPath = this.getAttribute('src') ?? './lessons.json';
    const openSections = new Set();

    this.innerHTML = `
      <nav class="idyl-nav" id="idyl-nav">
        <div class="idyl-nav-header">
          <span class="idyl-nav-title">ОБУЧЕНИЕ</span>
          <button class="idyl-nav-toggle" id="idyl-nav-toggle" title="Свернуть / развернуть">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2 L4 7 L9 12" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="idyl-nav-list" id="idyl-nav-list">
          <div class="idyl-nav-loading">Загрузка…</div>
        </div>
      </nav>`;

    const nav = this.querySelector('#idyl-nav');
    const toggle = this.querySelector('#idyl-nav-toggle');
    const list = this.querySelector('#idyl-nav-list');
    
    // Автоматическое определение базового пути
    const basePath = this.getBasePath();
    
    const currentFile = window.location.pathname.split('/').pop();

    // Восстанавливаем состояние
    try {
      const saved = sessionStorage.getItem('idyl-open-sections');
      if (saved) {
        JSON.parse(saved).forEach(id => openSections.add(id));
      }
    } catch(e) {}

    toggle.addEventListener('click', () => {
      const collapsed = nav.classList.toggle('collapsed');
      toggle.style.transform = collapsed ? 'rotate(180deg)' : '';
      sessionStorage.setItem('idyl-nav-collapsed', collapsed ? '1' : '0');
    });

    try {
      if (sessionStorage.getItem('idyl-nav-collapsed') === '1') {
        nav.classList.add('collapsed');
        toggle.style.transform = 'rotate(180deg)';
      }
    } catch(e) {}

    try {
      const resp = await fetch(jsonPath);
      const data = await resp.json();
      const sections = data.sections;

      // Открываем секцию с текущим уроком
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const hasCurrent = section.lessons.some(lesson => lesson.file === currentFile);
        if (hasCurrent) openSections.add(section.id);
      }

      if (openSections.size === 0 && sections.length > 0) {
        openSections.add(sections[0].id);
      }

      list.innerHTML = sections.map(section => {
        const isOpen = openSections.has(section.id);
        const lessonCount = section.lessons.length;
        
        return `
          <div class="idyl-section" data-section-id="${section.id}">
            <div class="idyl-section-header" data-section="${section.id}">
              <button class="idyl-section-toggle" data-section="${section.id}">
                <svg class="idyl-chevron ${isOpen ? 'open' : ''}" width="12" height="12" viewBox="0 0 12 12">
                  <path d="M4 2 L8 6 L4 10" stroke="currentColor" stroke-width="1.5" 
                        fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span class="idyl-section-title">${section.title}</span>
              <span class="idyl-section-count">${lessonCount}</span>
            </div>
            <div class="idyl-lessons ${isOpen ? '' : 'collapsed'}">
              ${section.lessons.map(lesson => {
                const isCurrent = lesson.file === currentFile;
                // Ключевой момент: используем basePath для формирования правильной ссылки
                const href = basePath === '.' ? lesson.file : `${basePath}/${lesson.file}`;
                return `
                  <a class="idyl-nav-item${isCurrent ? ' current' : ''}"
                     href="${href}">
                    <span class="idyl-nav-num">${lesson.id}</span>
                    <span class="idyl-nav-label">${lesson.title}</span>
                  </a>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
      
      // Обработчики кликов
      document.querySelectorAll('.idyl-section-header').forEach(header => {
        header.addEventListener('click', (e) => {
          const sectionId = header.dataset.section;
          const sectionDiv = header.closest('.idyl-section');
          const lessonsDiv = sectionDiv.querySelector('.idyl-lessons');
          const chevron = header.querySelector('.idyl-chevron');
          
          lessonsDiv.classList.toggle('collapsed');
          chevron.classList.toggle('open');
          
          if (lessonsDiv.classList.contains('collapsed')) {
            openSections.delete(sectionId);
          } else {
            openSections.add(sectionId);
          }
          
          sessionStorage.setItem('idyl-open-sections', JSON.stringify([...openSections]));
        });
      });

      const active = list.querySelector('.current');
      if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });

    } catch (e) {
      console.error(e);
      list.innerHTML = `<div class="idyl-nav-error">❌ Не удалось загрузить навигацию</div>`;
    }
  }

  getBasePath() {
    const path = window.location.pathname;
    if (/\/lessons\/(cli|widgets|oop|examples)\//.test(path)) {
      return '..';
    }
    return '.';
  }
}

customElements.define('idyl-sidebar', IdylSidebar);


class IdylOutputBlock extends HTMLElement {
  connectedCallback() {
    const raw = this.innerHTML ?? '';
    const html = raw.replace(/^\n/, '').replace(/\n\s*$/, '');
    this.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'idyl-output';
    div.innerHTML = html;
    this.appendChild(div);
  }
}

customElements.define('idyl-output-block', IdylOutputBlock);