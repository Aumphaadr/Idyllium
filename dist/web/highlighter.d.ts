export type TokenCategory = 'keyword' | 'typeName' | 'className' | 'function' | 'object' | 'string' | 'number' | 'comment' | 'brackets' | 'plain';
export interface HighlightToken {
    text: string;
    category: TokenCategory;
}
export declare function tokenize(source: string): HighlightToken[];
export declare function highlightToHTML(source: string): string;
//# sourceMappingURL=highlighter.d.ts.map