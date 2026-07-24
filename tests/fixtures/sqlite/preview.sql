PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    nickname TEXT
);

CREATE TABLE inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE assets (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    payload BLOB
);

INSERT INTO players (name, level, nickname) VALUES
    ('Мира', 12, 'Полярная звезда'),
    ('Лиам', 4, NULL),
    ('Ава', 8, 'Комета');

INSERT INTO inventory (player_id, item, count) VALUES
    (1, 'Лечебное зелье', 3),
    (1, 'Железный меч', 1),
    (2, 'Факел', 5),
    (3, 'Карта', 1);

INSERT INTO assets (id, name, payload) VALUES
    (1, 'Сигнатура PNG', X'89504E470D0A1A0A');

CREATE VIEW experienced_players AS
SELECT name, level, nickname
FROM players
WHERE level >= 8;
