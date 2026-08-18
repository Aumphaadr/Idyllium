// ───────────────────────────────────────────────────────────────────────────
// Почтовый канал между запущенными программами (фаза 2 сетевой карты).
//
// Канал живёт внутри одного компьютера и не притворяется сетью: Web IDE —
// BroadcastChannel между вкладками браузера, VS Code — общая шина внутри
// extension host (все запуски одного окна делят один процесс), тесты — та же
// шина, созданная на время теста. CLI сервиса не получает — честный отказ.
//
// Семантика единая для всех носителей и списана с BroadcastChannel:
// письмо получают ВСЕ подписчики канала с тем же именем, КРОМЕ отправителя —
// «письмо себе не приходит».
// ───────────────────────────────────────────────────────────────────────────

export interface RuntimeChannelConnection {
  send(text: string): void;
  close(): void;
}

export interface RuntimeChannelService {
  connect(name: string, onMessage: (text: string) => void): RuntimeChannelConnection;
}

// ─── Внутрипроцессная шина: VS Code extension host и тесты ─────────────────

interface BusSubscriber {
  readonly name: string;
  readonly onMessage: (text: string) => void;
}

export interface MemoryChannelBus {
  /** Сервис для одного рантайма; все сервисы одной шины слышат друг друга. */
  service(): RuntimeChannelService;
}

export function createMemoryChannelBus(): MemoryChannelBus {
  const subscribers = new Set<BusSubscriber>();

  return {
    service(): RuntimeChannelService {
      return {
        connect(name: string, onMessage: (text: string) => void): RuntimeChannelConnection {
          const self: BusSubscriber = { name, onMessage };
          subscribers.add(self);
          return {
            send(text: string): void {
              if (!subscribers.has(self)) return;
              for (const subscriber of subscribers) {
                if (subscriber === self || subscriber.name !== name) continue;
                // Письмо доставляется асинхронно, как и настоящая почта:
                // отправитель не ждёт, пока получатель дочитает.
                queueMicrotask(() => {
                  if (subscribers.has(subscriber)) subscriber.onMessage(text);
                });
              }
            },
            close(): void {
              subscribers.delete(self);
            },
          };
        },
      };
    },
  };
}

// ─── Браузерная реализация: BroadcastChannel (Web IDE) ─────────────────────

interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export function createBroadcastChannelService(): RuntimeChannelService | undefined {
  const Channel = (globalThis as {
    BroadcastChannel?: new (name: string) => BroadcastChannelLike;
  }).BroadcastChannel;
  if (typeof Channel !== 'function') return undefined;

  return {
    connect(name: string, onMessage: (text: string) => void): RuntimeChannelConnection {
      // Префикс отделяет ученические каналы от служебных сообщений страницы.
      const channel = new Channel(`idyllium-channel:${name}`);
      channel.onmessage = (event) => {
        onMessage(String(event.data ?? ''));
      };
      return {
        send(text: string): void {
          channel.postMessage(text);
        },
        close(): void {
          channel.onmessage = null;
          channel.close();
        },
      };
    },
  };
}
