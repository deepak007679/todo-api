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
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
  CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
`);

// Seed 3 example tasks inside a transaction if table is empty
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
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks', '/tasks/:id', '/stats', '/health', '/docs']
  });
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

// GET /stats - aggregate statistics computed directly in SQL
app.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const completed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE done = 1').get().count;
  const pending = total - completed;

  res.json({
    total,
    completed,
    pending
  });
});

// GET /tasks - supports SQL search, filtering by done status, and sorting
app.get('/tasks', (req, res) => {
  const { search, done, sort } = req.query;
  let sql = 'SELECT * FROM tasks';
  const conditions = [];
  const params = [];

  if (search !== undefined && search.trim() !== '') {
    conditions.push('title LIKE ?');
    params.push(`%${search.trim()}%`);
  }

  if (done !== undefined) {
    if (done === 'true' || done === '1') {
      conditions.push('done = ?');
      params.push(1);
    } else if (done === 'false' || done === '0') {
      conditions.push('done = ?');
      params.push(0);
    }
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  if (sort === 'title') {
    sql += ' ORDER BY title COLLATE NOCASE ASC';
  } else if (sort === 'id_desc') {
    sql += ' ORDER BY id DESC';
  } else {
    sql += ' ORDER BY id ASC';
  }

  const tasks = db.prepare(sql).all(...params);
  res.json(tasks.map(formatTask));
});

// GET /tasks/:id - parameterized single task fetch
app.get('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(formatTask(task));
});

// POST /tasks - insert task into SQLite
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

// PUT /tasks/:id - update task in SQLite
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

// DELETE /tasks/:id - delete task from SQLite
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
