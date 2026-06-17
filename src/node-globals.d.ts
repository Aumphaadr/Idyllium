declare const require: {
  (id: string): any;
  main?: unknown;
};
declare const module: unknown;
declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stdin: unknown;
  stdout: {
    write(text: string): void;
  };
  stderr: {
    write(text: string): void;
  };
};
