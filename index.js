const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');

const app = express();
app.use(express.json());

// Open database connection
const db = new Database(path.join(__dirname, 'tasks.db'));

// Create tasks table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed 3 example tasks if the table is empty
const countRow = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (countRow.count === 0) {
  const insertTask = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const seedTransaction = db.transaction(() => {
    insertTask.run('Buy milk', 0);
    insertTask.run('Walk the dog', 1);
    insertTask.run('Learn Express', 0);
  });
  seedTransaction();
}

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Helper to format task ensuring boolean done property
const formatTask = (task) => ({
  id: task.id,
  title: task.title,
  done: Boolean(task.done)
});

// Stage 1: Read endpoints
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.json(tasks.map(formatTask));
});

app.get('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(formatTask(task));
});

// Stage 2: Create new task
app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const trimmedTitle = title.trim();
  const insertStmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const info = insertStmt.run(trimmedTitle, 0);

  const newTask = {
    id: Number(info.lastInsertRowid),
    title: trimmedTitle,
    done: false
  };

  res.status(201).json(newTask);
});

// Stage 3: Update and delete endpoints
app.put('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, done } = req.body;
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'At least one field (title or done) is required' });
  }

  let newTitle = existing.title;
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    newTitle = title.trim();
  }

  let newDone = existing.done;
  if (done !== undefined) {
    if (typeof done !== 'boolean' && done !== 0 && done !== 1) {
      return res.status(400).json({ error: 'Done must be a boolean or 0/1' });
    }
    newDone = done ? 1 : 0;
  }

  const updateStmt = db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?');
  updateStmt.run(newTitle, newDone, req.params.id);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(formatTask(updatedTask));
});

app.delete('/tasks/:id', (req, res) => {
  const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  const info = deleteStmt.run(req.params.id);

  if (info.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

if (require.main === module) {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

module.exports = { app, db };
