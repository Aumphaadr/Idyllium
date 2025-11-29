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
});