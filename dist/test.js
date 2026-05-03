"use strict";
// =============================================================================
// test.ts — smoke-тесты: проверяет компиляцию, НЕ запускает рантайм
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
// ─── Утилиты ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    }
    catch (err) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
    }
}
function assert(condition, msg) {
    if (!condition)
        throw new Error(msg);
}
function assertCompiles(source, msg) {
    const result = (0, index_1.compileIdyllium)(source);
    if (!result.success) {
        const errors = result.errors.map(e => `${e.line}: ${e.message}`).join('\n');
        throw new Error(`${msg || 'Compilation failed'}:\n${errors}`);
    }
}
function assertFails(source, expectedSubstring, msg) {
    const result = (0, index_1.compileIdyllium)(source);
    if (result.success) {
        throw new Error(`${msg || 'Expected compilation to fail, but it succeeded'}`);
    }
    if (expectedSubstring) {
        const hasExpected = result.errors.some(e => e.message.toLowerCase().includes(expectedSubstring.toLowerCase()));
        if (!hasExpected) {
            const errors = result.errors.map(e => e.message).join(', ');
            throw new Error(`Expected error containing "${expectedSubstring}", got: ${errors}`);
        }
    }
}
function assertJsCodeContains(source, expectedSubstring, msg) {
    const result = (0, index_1.compileIdyllium)(source);
    if (!result.success) {
        throw new Error(`Compilation failed: ${result.errors.map(e => e.message).join(', ')}`);
    }
    if (!result.jsCode || !result.jsCode.includes(expectedSubstring)) {
        throw new Error(`${msg || `JS code missing "${expectedSubstring}"`}\nGot: ${result.jsCode?.slice(0, 500)}...`);
    }
}
// ─── Тесты компиляции ──────────────────────────────────────────────────────
console.log('\n🧪 Compilation tests:\n');
test('Hello World compiles', () => {
    assertCompiles(`
        use console;
        main() {
            console.write("Hello, World!", '\\n');
        }
    `);
});
test('Type mismatch detected', () => {
    assertFails(`
        main() {
            int x = 1.7;
        }
    `, 'cannot assign');
});
test('Undeclared variable detected', () => {
    assertFails(`
        use console;
        main() {
            console.write(x);
        }
    `, 'not declared');
});
test('Division always returns float', () => {
    assertCompiles(`
        main() {
            int a = 10;
            int b = 3;
            float c = a / b;
        }
    `);
});
test('Division into int is error', () => {
    assertFails(`
        main() {
            int a = 10;
            int b = 3;
            int c = a / b;
        }
    `, 'cannot assign');
});
test('Missing library import detected', () => {
    assertFails(`
        main() {
            int x = math.abs(-5);
        }
    `, 'not declared');
});
test('Break outside loop detected', () => {
    assertFails(`
        main() {
            break;
        }
    `, 'only valid inside a loop');
});
test('Boolean condition required', () => {
    assertFails(`
        main() {
            if (5) {}
        }
    `, "must be 'bool'");
});
test('Void variable rejected', () => {
    assertFails(`
        main() {
            void x;
        }
    `, 'cannot declare variable of type');
});
test('Function declaration and call', () => {
    assertCompiles(`
        use console;

        int function double(int n) {
            return n * 2;
        }

        main() {
            int x = double(21);
            console.write(x);
        }
    `);
});
test('Class declaration', () => {
    assertCompiles(`
        class Point {
            int x, y;

            void function info() {
                int a = this.x;
            }
        };

        main() {
            Point p;
            p.x = 10;
            p.y = 20;
        }
    `);
});
test('Static array operations', () => {
    assertCompiles(`
        use console;
        main() {
            array<int, 5> nums = [10, 20, 30, 40, 50];
            int x = nums[2];
            console.write(x);
        }
    `);
});
test('Dynamic array operations', () => {
    assertCompiles(`
        use console;
        main() {
            dyn_array<int> nums = [11, 22, 33];
            nums.add(44);
            int x = nums[3];
            console.write(x);
        }
    `);
});
test('Compound assignment operators', () => {
    assertCompiles(`
        main() {
            int x = 10;
            x += 5;
            x -= 2;
            x *= 3;
        }
    `);
});
test('String concatenation compiles', () => {
    assertCompiles(`
        main() {
            string a = "Hello";
            string b = " World";
            string c = a + b;
        }
    `);
});
test('If-else compiles', () => {
    assertCompiles(`
        main() {
            int x = 42;
            if (x > 40) {
                int y = 1;
            } else {
                int y = 0;
            }
        }
    `);
});
test('While loop compiles', () => {
    assertCompiles(`
        main() {
            int i = 0;
            while (i < 3) {
                i += 1;
            }
        }
    `);
});
test('For loop compiles', () => {
    assertCompiles(`
        main() {
            for (int i = 1; i <= 3; i += 1) {
                int x = i;
            }
        }
    `);
});
test('to_int / to_string compiles', () => {
    assertCompiles(`
        main() {
            string s = "123";
            int n = to_int(s);
            string back = to_string(n);
        }
    `);
});
test('Boolean logic compiles', () => {
    assertCompiles(`
        main() {
            bool a = true;
            bool b = false;
            bool c = a and b;
            bool d = a or b;
            bool e = not(a);
            bool f = a xor b;
        }
    `);
});
test('math library compiles', () => {
    assertCompiles(`
        use math;
        main() {
            int a = math.abs(-42);
            float b = math.pow(2, 10);
        }
    `);
});
test('Nested conditions and loops compile', () => {
    assertCompiles(`
        main() {
            for (int i = 1; i <= 3; i += 1) {
                for (int j = 1; j <= 3; j += 1) {
                    if (i == j) {
                        int x = 1;
                    } else {
                        int x = 0;
                    }
                }
            }
        }
    `);
});
test('Array out of bounds is runtime error (compiles fine)', () => {
    // Проверка границ массива — runtime, не compile-time
    // Поэтому компиляция должна проходить успешно
    assertCompiles(`
        main() {
            array<int, 3> arr = [1, 2, 3];
            int x = arr[5];
        }
    `);
});
test('Division by zero compiles (runtime error)', () => {
    assertCompiles(`
        main() {
            int x = div(10, 0);
        }
    `);
});
test('Default parameter values', () => {
    assertCompiles(`
        void function draw_line(int L = 3) {
            string res = "";
        }
        main() {
            draw_line();
            draw_line(5);
        }
    `);
});
test('Named arguments', () => {
    assertCompiles(`
        int function sub(int arg1, int arg2) {
            return arg1 - arg2;
        }
        main() {
            int x = sub(arg2=50, arg1=30);
        }
    `);
});
test('JS code generation produces valid syntax', () => {
    const result = (0, index_1.compileIdyllium)(`
        use console;
        main() {
            int a = 42;
            console.write(a);
        }
    `);
    assert(result.success, 'Compilation failed');
    const jsCode = result.jsCode;
    if (jsCode === null) {
        throw new Error('JS code is null');
    }
    // Проверяем, что сгенерированный код выглядит разумно
    assert(jsCode.includes('async function main()'), 'Missing async function main');
    assert(jsCode.includes('$rt.console.write'), 'Missing console.write call');
});
// ─── Итоги ──────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`─────────────────────────────\n`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test.js.map