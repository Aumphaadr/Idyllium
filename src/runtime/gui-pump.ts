// Единственный источник истины для «насоса снапшотов» GUI-превью.
// Пока действие рантайма (обработчик события, шаг программы) неспешно
// работает, хост каждые 50 мс перерисовывает превью, чтобы анимации и
// вывод не замирали до конца действия. Механика одна на Web IDE и
// расширение VS Code; хост передаёт лишь своё «перекачать кадр».

const SNAPSHOT_PUMP_INTERVAL_MS = 50;

function waitForSnapshotPump(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SNAPSHOT_PUMP_INTERVAL_MS);
  });
}

export async function runActionWithSnapshotPump(
  action: () => unknown,
  pumpSnapshot: () => void,
): Promise<void> {
  let finished = false;
  let failure: unknown = null;
  const actionPromise = Promise.resolve()
    .then(action)
    .catch((error) => {
      failure = error;
    })
    .finally(() => {
      finished = true;
    });

  while (!finished) {
    await Promise.race([actionPromise, waitForSnapshotPump()]);
    pumpSnapshot();
  }

  if (failure) throw failure;
}
