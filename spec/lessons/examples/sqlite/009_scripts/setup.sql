-- Скрипт может содержать комментарии и несколько SQL-команд.

DROP TABLE IF EXISTS achievements;

CREATE TABLE achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    points INTEGER NOT NULL
);

INSERT INTO achievements (title, points) VALUES
    ('First Steps', 10),
    ('Treasure Hunter', 25),
    ('Dragon Slayer', 100);
