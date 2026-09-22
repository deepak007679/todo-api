-- FlyRank Backend Track - Week 3 Assignment A2: Stage 4 SQL by Hand

-- 1. List every task
SELECT * FROM tasks;

-- 2. Only completed tasks
SELECT * FROM tasks WHERE done = 1;

-- 3. How many tasks are there?
SELECT COUNT(*) AS count FROM tasks;

-- 4. Mark every task completed
UPDATE tasks SET done = 1;

-- 5. Delete all completed tasks
DELETE FROM tasks WHERE done = 1;
