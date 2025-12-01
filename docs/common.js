// common.js
document.addEventListener('DOMContentLoaded', async () => {
  const headerPlaceholder = document.getElementById('shared-header');
  if (!headerPlaceholder) return;

  try {
    const response = await fetch('./header.html');
    if (!response.ok) throw new Error('Failed to load header');
    const html = await response.text();
    headerPlaceholder.innerHTML = html;
  } catch (error) {
    console.warn('Could not load shared header:', error);
    // Опционально: резервный вариант
    headerPlaceholder.innerHTML = `
      <div class="header_center" style="justify-content: center; padding: 1em;">
        <em>Навигация недоступна</em>
      </div>
    `;
  }

  function highlightCurrentLesson() {
    const currentPath = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('#lessons-nav-placeholder a');
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('current');
      }
    });
  }

  // Загрузка навигации
  fetch('./lessons-nav.html')
    .then(response => response.text())
    .then(html => {
      const placeholder = document.getElementById('lessons-nav-placeholder');
      if (placeholder) {
        placeholder.innerHTML = html;
        highlightCurrentLesson();
      }
    })
    .catch(err => {
      console.error('Не удалось загрузить меню уроков:', err);
    });
});