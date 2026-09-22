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

// Stage 1: Read endpoints backed by SQLite
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

// Remaining endpoints from Assignment 1 for now
let tasks = [];
let nextId = 4;

app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const newTask = { id: nextId++, title, done: false };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put('/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const { title, done } = req.body;
  if (title !== undefined) {
    if (title.trim() === '') {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    task.title = title;
  }
  if (done !== undefined) {
    task.done = done;
  }
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const index = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  tasks.splice(index, 1);
  res.status(204).send();
});

if (require.main === module) {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

module.exports = { app, db };
