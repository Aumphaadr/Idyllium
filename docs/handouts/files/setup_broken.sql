-- В этом скрипте спрятана ровно одна ошибка. Найдите её по письму SQLite!

DROP TABLE IF EXISTS pets;

CREATE TABLE pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    age INTEGER
);

INSERT INTO pets (name, kind, age) VALUES ('Батон', 'хомяк', 2);
INSERT INTO pets (name, kind, age) VALUES ('Изюм', 'кот', 5);

INSERT INTO pets (name, kind, age) VALUES ('Гоша', 'попугай' 12);

INSERT INTO pets (name, kind, age) VALUES ('Плюшка', 'хомяк', 1);
