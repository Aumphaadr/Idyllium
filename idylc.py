#!/usr/bin/env python3
# idylc.py

import sys
import os
import argparse
import subprocess
from lexer import Lexer
from parser import Parser
from codegen import CodeGenerator
from analyzer import SemanticAnalyzer

def main():
    parser = argparse.ArgumentParser(
        prog="idylc",
        description="Компилятор языка Idyllium → Python"
    )
    parser.add_argument("input", help="Исходный файл на Idyllium (.idyl)")
    parser.add_argument("--run", action="store_true", help="Скомпилировать и сразу запустить")
    parser.add_argument("-o", "--output", help="Имя выходного файла (.py)")

    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Ошибка: файл '{args.input}' не найден.", file=sys.stderr)
        sys.exit(1)

    if not args.input.endswith(".idyl"):
        print("Предупреждение: файл не имеет расширения .idyl", file=sys.stderr)

    # Определяем имя выходного файла
    if args.output:
        output_file = args.output
    else:
        base = os.path.splitext(args.input)[0]
        output_file = base + ".py"

    try:
        # Чтение исходника
        with open(args.input, "r", encoding="utf-8") as f:
            source = f.read()

        # Компиляция
        lexer = Lexer(source)
        tokens = lexer.tokenize()
        parser = Parser(tokens)
        ast = parser.parse()

        analyzer = SemanticAnalyzer()
        analyzer.analyze(ast)
        
        generator = CodeGenerator()
        python_code = generator.generate(ast)

        # Запись .py файла
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(python_code)

        print(f"Успешно скомпилировано: {args.input} → {output_file}")

        # Запуск, если нужно
        if args.run:
            print(f"\nЗапуск {output_file}...\n")
            result = subprocess.run([sys.executable, output_file])
            sys.exit(result.returncode)

    except SyntaxError as e:
        print(f"Ошибка синтаксиса: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Ошибка компиляции: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()