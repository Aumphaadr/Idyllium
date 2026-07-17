import { RuntimeSqliteService, createSqlJsRuntimeService } from './sqlite-service';

const initSqlJs: any = require('sql.js');

let sharedService: RuntimeSqliteService | null = null;

export function createNodeSqliteService(): RuntimeSqliteService {
  sharedService ??= createSqlJsRuntimeService(initSqlJs);
  return sharedService;
}
