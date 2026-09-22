const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(express.json());

const db = new Database(path.join(__dirname, 'tasks.db'));

// AI generated table creation
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0
  )
`);

// AI generated seed logic (no transaction used)
const count = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
if (count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  insert.run('Buy milk', 0);
  insert.run('Walk the dog', 1);
  insert.run('Learn Express', 0);
}

app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /tasks: returns raw DB rows without mapping done to boolean
app.get('/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks').all();
  res.json(rows);
});

// GET /tasks/:id
app.get('/tasks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(row);
});

// POST /tasks
app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(title.trim());
  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newTask);
});

// PUT /tasks/:id
app.put('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const { title, done } = req.body;
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Invalid body' });
  }

  const updatedTitle = title !== undefined ? title : task.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : task.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, req.params.id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(204).send();
});

if (require.main === module) {
  app.listen(3000, () => {
    console.log('AI version running on port 3000');
  });
}

module.exports = { app, db };
