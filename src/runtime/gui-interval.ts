// Единственный источник истины для частоты GUI-цикла превью.
// Хосты (Web IDE, расширение VS Code) считают интервал кадра по снапшотам
// окон и холстов: максимальный заявленный framerate_limit, зажатый в 1–60 fps,
// но не чаще раза в 16 мс.

interface GuiIntervalCanvasLike {
  readonly properties?: Record<string, unknown> | null;
}

interface GuiIntervalWidgetLike {
  readonly canvas?: GuiIntervalCanvasLike | null;
  readonly children?: readonly GuiIntervalWidgetLike[] | null;
}

export function guiPreviewIntervalMs(
  windows: readonly GuiIntervalWidgetLike[],
  canvases: readonly GuiIntervalCanvasLike[],
): number {
  const candidates: number[] = [];
  const collectCanvas = (canvas: GuiIntervalCanvasLike | null | undefined): void => {
    const limit = Number(canvas?.properties?.framerate_limit);
    if (Number.isFinite(limit) && limit > 0) candidates.push(limit);
  };
  for (const canvas of canvases) collectCanvas(canvas);
  const visitWidget = (widget: GuiIntervalWidgetLike | null | undefined): void => {
    if (!widget) return;
    if (widget.canvas) collectCanvas(widget.canvas);
    for (const child of widget.children ?? []) visitWidget(child);
  };
  for (const win of windows) visitWidget(win);
  const fps = Math.max(1, Math.min(60, candidates.length > 0 ? Math.max(...candidates) : 30));
  return Math.max(16, Math.round(1000 / fps));
}
