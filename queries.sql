-- FlyRank Backend Track - Week 1 Assignment A3: Containerize your stack
-- PostgreSQL Parameterized Queries

-- 1. Create table with SERIAL primary key and BOOLEAN done
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Seed initial tasks (if table is empty)
INSERT INTO tasks (title, done) VALUES 
  ('Buy milk', FALSE),
  ('Walk the dog', TRUE),
  ('Learn Express', FALSE);

-- 3. Read operations (Stage 2)
-- List all tasks
SELECT * FROM tasks ORDER BY id ASC;

-- Parameterized single task fetch
SELECT * FROM tasks WHERE id = $1;

-- Filter by completion status
SELECT * FROM tasks WHERE done = TRUE;

-- 4. Write operations with RETURNING clause (Stage 3)
-- Insert task and return generated row
INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *;

-- Update task
UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *;

-- Delete task
DELETE FROM tasks WHERE id = $1 RETURNING id;

-- 5. Health & Stats
SELECT 1;
SELECT COUNT(*) AS count FROM tasks;
SELECT COUNT(*) AS count FROM tasks WHERE done = TRUE;
