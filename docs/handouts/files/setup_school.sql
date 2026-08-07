-- Учебная база школы: ученики, предметы, оценки.

DROP TABLE IF EXISTS marks;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS students;

CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    grade_level INTEGER NOT NULL
);

CREATE TABLE subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT UNIQUE NOT NULL,
    cabinet INTEGER
);

CREATE TABLE marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    value INTEGER NOT NULL
);

INSERT INTO students (name, grade_level) VALUES
    ('Агата', 8),
    ('Тимур', 8),
    ('Слава', 9);

INSERT INTO subjects (title, cabinet) VALUES
    ('Информатика', 214),
    ('Алхимия', 7),
    ('Физкультура', NULL);

INSERT INTO marks (student_id, subject_id, value) VALUES
    (1, 1, 5), (1, 2, 4), (2, 1, 3), (3, 1, 5), (3, 3, 4);
