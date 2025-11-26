# idylc.py
#!/usr/bin/env python3
import sys
import os
import argparse
import subprocess
from lexer import Lexer
from parser import Parser, TokenType
from codegen import CodeGenerator
from analyzer import SemanticAnalyzer

def get_real_python():
    if getattr(sys, 'frozen', False):
        return "python3"
    else:
        return sys.executable

def main():
    parser = argparse.ArgumentParser(prog="idylc", description="Компилятор языка Idyllium → Python")
    parser.add_argument("input", help="Исходный файл на Idyllium (.idyl)")
    parser.add_argument("--run", action="store_true", help="Скомпилировать и сразу запустить")
    parser.add_argument("-o", "--output", help="Имя выходного файла (.py)")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Ошибка: файл '{args.input}' не найден.", file=sys.stderr)
        sys.exit(1)
    if not args.input.endswith(".idyl"):
        print("Предупреждение: файл не имеет расширения .idyl", file=sys.stderr)

    output_file = args.output or os.path.splitext(args.input)[0] + ".py"

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            source = f.read()

        lexer0 = Lexer(source, args.input)
        tokens0 = lexer0.tokenize()
        imports = []
        i = 0
        while i < len(tokens0) and tokens0[i].type == TokenType.USE:
            i += 1
            if i >= len(tokens0) or tokens0[i].type != TokenType.IDENTIFIER:
                raise SyntaxError("Ожидалось имя модуля после 'use'")
            imports.append(tokens0[i].lexeme)
            i += 1
            if i >= len(tokens0) or tokens0[i].type != TokenType.SEMICOLON:
                raise SyntaxError("Ожидалась ';' после имени модуля")
            i += 1

        user_libraries = {}
        source_dir = os.path.dirname(os.path.abspath(args.input)) or "."
        BUILTIN_MODULES = {"console", "random", "time", "file"}

        for lib_name in imports:
            if lib_name not in BUILTIN_MODULES:
                lib_path = os.path.join(source_dir, lib_name + ".idyl")
                if not os.path.isfile(lib_path):
                    raise FileNotFoundError(f"Библиотека '{lib_name}' не найдена: {lib_path}")
                with open(lib_path, "r", encoding="utf-8") as f:
                    lib_code = f.read()
                lib_lexer = Lexer(lib_code, lib_path)
                lib_tokens = lib_lexer.tokenize()
                lib_parser = Parser(lib_tokens)
                funcs = lib_parser.parse_as_library()
                user_libraries[lib_name] = funcs

        lexer = Lexer(source, args.input)
        tokens = lexer.tokenize()
        parser = Parser(tokens)
        ast = parser.parse()

        analyzer = SemanticAnalyzer()
        analyzer.analyze(ast, user_libraries=set(user_libraries.keys()))

        generator = CodeGenerator()
        generator.user_libraries = user_libraries
        python_code = generator.generate(ast)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(python_code)

        print(f"Успешно скомпилировано: {args.input} → {output_file}")

        if args.run:
            print(f"\nЗапуск {output_file}...\n")
            result = subprocess.run([get_real_python(), output_file])
            sys.exit(result.returncode)

    except SyntaxError as e:
        print(f"Ошибка синтаксиса: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Ошибка компиляции: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()