require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const repo = require('./repository');

const app = express();
app.use(express.json());

// Interactive Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Root discovery endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '3.0',
    storage: 'PostgreSQL (Containerized)',
    endpoints: ['/tasks', '/tasks/:id', '/stats', '/health', '/docs']
  });
});

// Health check endpoint (checks database connectivity)
app.get('/health', async (req, res) => {
  try {
    await repo.pingDatabase();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// GET /stats - aggregate statistics
app.get('/stats', async (req, res, next) => {
  try {
    const stats = await repo.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /tasks - list all tasks with optional search, filter, and sorting
app.get('/tasks', async (req, res, next) => {
  try {
    const { search, done, sort } = req.query;
    const tasks = await repo.getAllTasks({ search, done, sort });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id - parameterized single task fetch
app.get('/tasks/:id', async (req, res, next) => {
  try {
    const task = await repo.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// POST /tasks - insert task into PostgreSQL
app.post('/tasks', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const newTask = await repo.createTask(title.trim());
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
});

// PUT /tasks/:id - update task in PostgreSQL
app.put('/tasks/:id', async (req, res, next) => {
  try {
    const { title, done } = req.body;
    if (title === undefined && done === undefined) {
      return res.status(400).json({ error: 'At least one field (title or done) is required' });
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    if (done !== undefined && typeof done !== 'boolean' && done !== 0 && done !== 1) {
      return res.status(400).json({ error: 'Done must be a boolean or 0/1' });
    }

    const parsedDone = done !== undefined ? Boolean(done) : undefined;
    const updated = await repo.updateTask(req.params.id, {
      title: title ? title.trim() : undefined,
      done: parsedDone
    });

    if (!updated) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id - delete task from PostgreSQL
app.delete('/tasks/:id', async (req, res, next) => {
  try {
    const deleted = await repo.deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  repo.initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database on startup:', err);
      process.exit(1);
    });
}

module.exports = { app, repo };
