#!/usr/bin/env python3
"""Снимает верхние половины однобайтовых кодировок с кодеков Python → codepages.json.

Кодеки Python собраны из официальных таблиц Unicode.org и Microsoft, поэтому
незанятые позиции (cp1252 0x81/0x8D/0x8F/0x90/0x9D, cp857 D5/E7/F2, ISO-8859-3
и т. п.) там честно отсутствуют — в JSON они записаны как U+FFFF.
Запуск: python3 tools/encoding-sources/dump-codepages.py
Затем: node tools/build-encoding-tables.js
"""
import json
import os

IDS = {
    'cp437': 'cp437', 'cp850': 'cp850', 'cp852': 'cp852', 'cp855': 'cp855',
    'cp857': 'cp857', 'cp866': 'cp866',
    **{f'windows-{n}': f'cp{n}' for n in range(1250, 1259)},
    'ascii': 'ascii',
    **{f'iso-8859-{n}': f'iso8859_{n}' for n in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16]},
    'koi8-r': 'koi8_r', 'koi8-u': 'koi8_u',
    'mac-roman': 'mac_roman', 'mac-cyrillic': 'mac_cyrillic',
}

UNASSIGNED = '￿'


def upper_half(codec: str) -> str:
    high = ''
    for byte in range(0x80, 0x100):
        try:
            char = bytes([byte]).decode(codec)
        except UnicodeDecodeError:
            char = UNASSIGNED
        if len(char) != 1:
            char = UNASSIGNED
        high += char
    for byte in range(0x80):
        assert bytes([byte]).decode(codec) == chr(byte), (codec, byte)
    return high


def main() -> None:
    pages = {cid: upper_half(codec) for cid, codec in IDS.items()}
    target = os.path.join(os.path.dirname(__file__), 'codepages.json')
    with open(target, 'w', encoding='utf-8') as handle:
        json.dump(pages, handle, ensure_ascii=True, indent=0)
        handle.write('\n')
    for cid, high in pages.items():
        print(f'{cid:13} unassigned {high.count(UNASSIGNED)}')


if __name__ == '__main__':
    main()
