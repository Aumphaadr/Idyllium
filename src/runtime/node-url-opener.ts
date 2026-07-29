// Открывалка ссылок для консольного режима: консольная программа вполне может
// попросить систему открыть браузер — ровно так делают `webbrowser.open` в
// Python и `xdg-open`/`open`/`start` в скриптах. Успех определяется событием
// 'spawn' (Node сообщает о нём, когда процесс действительно запустился),
// поэтому поведение честное: либо открыли, либо внятная ошибка.

const childProcess: any = require('child_process');

export interface NodeUrlOpener {
  open(address: string): Promise<void>;
}

function launcher(): { command: string; args: readonly string[] } | null {
  const platform = typeof process === 'object' ? process.platform : '';
  if (platform === 'darwin') return { command: 'open', args: [] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', ''] };
  if (platform === 'linux' || platform === 'freebsd' || platform === 'openbsd') {
    return { command: 'xdg-open', args: [] };
  }
  return null;
}

export function createNodeUrlOpener(): NodeUrlOpener {
  return {
    open(address: string): Promise<void> {
      const target = launcher();
      if (!target) {
        return Promise.reject(new Error(`url.open() is not supported on this system (${process.platform})`));
      }

      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const child = childProcess.spawn(target.command, [...target.args, address], {
          detached: true,
          stdio: 'ignore',
        });
        child.on('spawn', () => {
          if (settled) return;
          settled = true;
          // Отвязываем: программа ученика не должна ждать закрытия браузера.
          child.unref();
          resolve();
        });
        child.on('error', (error: { code?: string; message?: string }) => {
          if (settled) return;
          settled = true;
          const reason = error?.code === 'ENOENT'
            ? `system command '${target.command}' was not found`
            : String(error?.message ?? error);
          reject(new Error(`url.open() could not start a browser: ${reason}`));
        });
      });
    },
  };
}
