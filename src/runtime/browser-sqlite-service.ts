import { RuntimeSqliteService, createSqlJsRuntimeService } from './sqlite-service';

let sharedService: RuntimeSqliteService | null = null;

export function createBrowserSqliteService(): RuntimeSqliteService {
  if (sharedService) return sharedService;

  const browserDocument = (globalThis as any).document;
  if (!browserDocument) {
    sharedService = {
      async open(): Promise<never> {
        throw new Error('browser SQLite is unavailable outside a browser');
      },
    };
    return sharedService;
  }

  const initSqlJs: any = require('sql.js/dist/sql-wasm-browser.js');
  sharedService = createSqlJsRuntimeService(initSqlJs, {
    locateFile(file: string): string {
      return `assets/${file}`;
    },
  });
  return sharedService;
}
