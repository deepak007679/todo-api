const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:dev@localhost:5432/tasks';

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

// Format task to guarantee boolean type and number ID
const formatTask = (row) => ({
  id: Number(row.id),
  title: row.title,
  done: Boolean(row.done)
});

// Initialize database schema and seed data
async function initDb(retries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Create table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          done BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
        CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
      `);

      // 2. Check row count for seed-once rule
      const res = await pool.query('SELECT COUNT(*) AS count FROM tasks');
      const count = parseInt(res.rows[0].count, 10);

      if (count === 0) {
        console.log('Database empty. Seeding initial example tasks...');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', ['Buy milk', false]);
          await client.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', ['Walk the dog', true]);
          await client.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', ['Learn Express', false]);
          await client.query('COMMIT');
          console.log('Seeded 3 initial tasks successfully.');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        console.log(`Database already contains ${count} tasks. Skipping seeding.`);
      }

      console.log('PostgreSQL database initialized successfully.');
      return;
    } catch (err) {
      console.warn(`Postgres connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        console.error('Could not connect to PostgreSQL after multiple attempts.');
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Stage 2 & 3: Repository queries
async function getAllTasks({ search, done, sort } = {}) {
  let sql = 'SELECT * FROM tasks';
  const conditions = [];
  const params = [];

  if (search !== undefined && search.trim() !== '') {
    params.push(`%${search.trim()}%`);
    conditions.push(`title ILIKE $${params.length}`);
  }

  if (done !== undefined) {
    if (done === 'true' || done === '1' || done === true) {
      params.push(true);
      conditions.push(`done = $${params.length}`);
    } else if (done === 'false' || done === '0' || done === false) {
      params.push(false);
      conditions.push(`done = $${params.length}`);
    }
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  if (sort === 'title') {
    sql += ' ORDER BY title ASC';
  } else if (sort === 'id_desc') {
    sql += ' ORDER BY id DESC';
  } else {
    sql += ' ORDER BY id ASC';
  }

  const res = await pool.query(sql, params);
  return res.rows.map(formatTask);
}

async function getTaskById(id) {
  const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  return formatTask(res.rows[0]);
}

async function createTask(title) {
  const res = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
    [title, false]
  );
  return formatTask(res.rows[0]);
}

async function updateTask(id, { title, done }) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const newTitle = title !== undefined ? title : existing.title;
  const newDone = done !== undefined ? done : existing.done;

  const res = await pool.query(
    'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
    [newTitle, newDone, id]
  );
  return formatTask(res.rows[0]);
}

async function deleteTask(id) {
  const res = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
  return res.rowCount > 0;
}

async function getStats() {
  const totalRes = await pool.query('SELECT COUNT(*) AS count FROM tasks');
  const completedRes = await pool.query('SELECT COUNT(*) AS count FROM tasks WHERE done = TRUE');
  const total = parseInt(totalRes.rows[0].count, 10);
  const completed = parseInt(completedRes.rows[0].count, 10);
  return {
    total,
    completed,
    pending: total - completed
  };
}

async function pingDatabase() {
  await pool.query('SELECT 1');
  return true;
}

module.exports = {
  pool,
  initDb,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getStats,
  pingDatabase
};
