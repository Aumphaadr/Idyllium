// src/runtime/console-node.ts

import { ConsoleIO } from './runtime';
import * as readline from 'readline';

export function createNodeConsole(): ConsoleIO {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return {
        print(text: string): void {
            process.stdout.write(text);
        },

        async readLine(): Promise<string> {
            return new Promise((resolve) => {
                rl.question('', (answer) => {
                    resolve(answer);
                });
            });
        },
    };
}

export function closeNodeConsole(rl: readline.Interface): void {
    rl.close();
}