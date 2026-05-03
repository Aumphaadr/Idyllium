"use strict";
// src/compiler/scope.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scope = void 0;
class Scope {
    constructor(scopeKind, parent, returnType = null, className = null) {
        this.symbols = new Map();
        this.scopeKind = scopeKind;
        this.parent = parent;
        this.returnType = returnType;
        this.className = className;
    }
    declare(info) {
        if (this.symbols.has(info.name)) {
            return false;
        }
        this.symbols.set(info.name, info);
        return true;
    }
    lookupLocal(name) {
        return this.symbols.get(name) ?? null;
    }
    lookup(name) {
        const local = this.symbols.get(name);
        if (local !== undefined)
            return local;
        if (this.parent !== null)
            return this.parent.lookup(name);
        return null;
    }
    isInsideLoop() {
        if (this.scopeKind === 'loop')
            return true;
        if (this.parent !== null)
            return this.parent.isInsideLoop();
        return false;
    }
    getReturnType() {
        if (this.returnType !== null)
            return this.returnType;
        if (this.parent !== null)
            return this.parent.getReturnType();
        return null;
    }
    getClassName() {
        if (this.className !== null)
            return this.className;
        if (this.parent !== null)
            return this.parent.getClassName();
        return null;
    }
    isInsideFunction() {
        if (this.scopeKind === 'function' ||
            this.scopeKind === 'method' ||
            this.scopeKind === 'constructor')
            return true;
        if (this.parent !== null)
            return this.parent.isInsideFunction();
        return false;
    }
    isInsideConstructor() {
        if (this.scopeKind === 'constructor')
            return true;
        if (this.parent !== null)
            return this.parent.isInsideConstructor();
        return false;
    }
}
exports.Scope = Scope;
//# sourceMappingURL=scope.js.map