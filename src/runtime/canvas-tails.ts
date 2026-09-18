// ─── Хвосты холстов: учёт «что рендерер уже показал» для хостов ────────────
// Рисунок на холсте копится (1.6.1), а список команд — истина, на которой живут
// save_svg, снимки и тесты. Чтобы накопленное не пересылалось и не перерисовывалось
// каждый кадр, хост (Web IDE, расширение VS Code) просит у рантайма только ХВОСТ
// списка, а рендерер хранит картинку между кадрами и дорисовывает новое (1.6.2).
//
// Учёт оптимистичный: отправили — считаем показанным. Если рендерер потерял
// картинку (пересоздан кадр предпросмотра, сменился размер холста, пришёл хвост
// не с того места), он сам просит полный список сообщением `canvasResync` — хост
// зовёт forget(), и следующий снимок уходит целиком. Поэтому потерянный кадр
// лечится сам, а не портит картинку навсегда.
import { CanvasSnapshotOptions, IdylliumCanvasSnapshot, IdylliumGuiWidgetSnapshot, IdylliumWindowSnapshot } from './runtime-state';

export interface CanvasTailTracker {
  /** Параметр для runtime.getWindows()/getCanvases(). */
  options(): CanvasSnapshotOptions;
  /** Снимок ушёл рендереру: запоминаем, докуда он теперь знает каждый холст. */
  sent(windows: readonly IdylliumWindowSnapshot[], canvases: readonly IdylliumCanvasSnapshot[]): void;
  /** Рендерер потерял картинку (или начата новая программа): без ids — забыть всё. */
  forget(ids?: readonly number[]): void;
}

export function createCanvasTailTracker(): CanvasTailTracker {
  let known: Record<number, { epoch: number; count: number }> = {};

  const remember = (canvas: IdylliumCanvasSnapshot | undefined): void => {
    if (canvas) known[canvas.id] = { epoch: canvas.epoch, count: canvas.total };
  };
  const walk = (widgets: readonly IdylliumGuiWidgetSnapshot[]): void => {
    for (const widget of widgets) {
      remember(widget.canvas);
      walk(widget.children);
    }
  };

  return {
    options: () => ({ knownCanvases: known }),
    sent(windows, canvases) {
      // Холст, которого в снимке больше нет, забываем: его id может вернуться с другим списком.
      known = {};
      for (const window of windows) walk(window.children);
      for (const canvas of canvases) remember(canvas);
    },
    forget(ids) {
      if (!ids) {
        known = {};
        return;
      }
      for (const id of ids) delete known[id];
    },
  };
}
