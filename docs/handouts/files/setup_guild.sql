-- Схема гильдии: герои, товары, покупки.
-- Скрипт можно запускать сколько угодно раз: старые таблицы сносятся.

DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS players;

CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    class TEXT NOT NULL,
    level INTEGER NOT NULL,
    gold INTEGER NOT NULL
);

CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT UNIQUE NOT NULL,
    price INTEGER NOT NULL,
    rarity TEXT NOT NULL
);

CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    day INTEGER NOT NULL
);

INSERT INTO players (name, class, level, gold) VALUES
    ('Мира', 'маг', 12, 340),
    ('Кай', 'рыцарь', 9, 120),
    ('Лея', 'лучница', 15, 980),
    ('Борис', 'бард', 3, 45);

INSERT INTO items (title, price, rarity) VALUES
    ('Зелье от прокрастинации', 150, 'редкий'),
    ('Второй носок', 5, 'обычный'),
    ('Карманный телепорт домой', 900, 'легендарный'),
    ('Картонный шлем', 25, 'обычный');

INSERT INTO purchases (player_id, item_id, day) VALUES
    (1, 1, 1),
    (3, 3, 2),
    (4, 2, 2),
    (1, 4, 3);
