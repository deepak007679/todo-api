const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    )
  `);
  const res = await pool.query('SELECT COUNT(*) FROM tasks');
  if (parseInt(res.rows[0].count) === 0) {
    await pool.query("INSERT INTO tasks (title, done) VALUES ('Buy milk', false), ('Walk the dog', true), ('Learn Express', false)");
  }
}

app.get('/tasks', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id ASC');
  res.json(rows);
});

app.get('/tasks/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const { rows } = await pool.query('INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING *', [title.trim()]);
  res.status(201).json(rows[0]);
});

app.put('/tasks/:id', async (req, res) => {
  const { title, done } = req.body;
  const { rows } = await pool.query('UPDATE tasks SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING *', [title, done, req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

app.delete('/tasks/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
init().then(() => {
  app.listen(PORT, () => console.log(`AI version running on port ${PORT}`));
}).catch(console.error);
