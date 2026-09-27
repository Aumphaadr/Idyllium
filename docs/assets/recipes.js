// «Рецепты»: кнопка «Копировать» у код-блоков (как в учебнике) и ничего больше.
(function () {
  'use strict';
  for (const button of document.querySelectorAll('.ui-code-copy')) {
    button.addEventListener('click', async () => {
      const pre = button.closest('.ui-code')?.querySelector('pre');
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.textContent || '');
        button.textContent = 'Скопировано';
        button.classList.add('is-done');
      } catch {
        button.textContent = 'Не вышло';
        button.classList.add('is-failed');
      }
      window.setTimeout(() => {
        button.textContent = 'Копировать';
        button.classList.remove('is-done', 'is-failed');
      }, 1200);
    });
  }
})();
