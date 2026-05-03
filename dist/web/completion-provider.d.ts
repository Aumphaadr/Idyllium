import { CompletionItem } from './autocomplete';
export interface CompletionContext {
    textBefore: string;
    fullText: string;
    currentWord: string;
    lineText: string;
    afterDot: string | null;
    cursorPos: number;
}
export declare function getCompletions(ctx: CompletionContext): CompletionItem[];
export declare function parseCompletionContext(text: string, cursorPos: number): CompletionContext;
//# sourceMappingURL=completion-provider.d.ts.map