// Числовые мелочи, общие для ядра, просмотрщика ассетов и пипетки.

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
