# Task CRUD API with SQLite Persistence

A RESTful Task API built with **Node.js**, **Express**, and **SQLite** (`better-sqlite3`). This assignment transitions our CRUD API from transient in-memory storage to disk-backed persistent storage in a SQLite database (`tasks.db`), ensuring data survives server restarts while keeping the API interface intact.

---

## Why SQLite?

1. **Serverless & Zero Setup**: Unlike Postgres or MySQL, SQLite requires no background service, user credentials, or network configuration. It runs entirely in-process.
2. **Single-File Portability**: The entire database lives in a single file (`tasks.db`).
3. **True Persistence**: Unlike in-memory data that vanishes on server restarts, SQLite writes transactions to disk.
4. **Synchronous & Clean Code**: With `better-sqlite3`, queries execute synchronously without unnecessary `async`/`await` overhead.
5. **Separation of Concerns**: The API routes define *what* the application does; SQLite defines *where* data lives. Storage is just an implementation detail under the hood.

---

## Database Location & Auto-Creation

- **Database File**: `tasks.db` located in the project root.
- **Automatic Setup**: When the application boots, `tasks.db` and the `tasks` table are automatically created if they do not exist.
- **Automatic Seeding**: If the `tasks` table is empty (`COUNT(*) === 0`), three initial example tasks are seeded in a single transaction:
  1. `Buy milk` (done: 0)
  2. `Walk the dog` (done: 1)
  3. `Learn Express` (done: 0)
  Restarting the server checks the row count and does not duplicate seeds.
- **Git-Ignored**: `tasks.db` is included in `.gitignore` so that every clean clone initializes fresh.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server (one documented command)
npm start
```

The API starts at `http://localhost:3000`.

---

## DB Browser for SQLite Screenshot

The database table and schema viewed in DB Browser for SQLite:

![DB Browser for SQLite](screenshots/db-browser.png)

---

## Stage 4: SQL by Hand

The database file was inspected and manipulated directly via raw SQL queries:

```sql
-- 1. List every task
SELECT * FROM tasks;

-- 2. Only completed tasks
SELECT * FROM tasks WHERE done = 1;

-- 3. Total task count
SELECT COUNT(*) AS count FROM tasks;

-- 4. Mark every task completed
UPDATE tasks SET done = 1;

-- 5. Delete all completed tasks
DELETE FROM tasks WHERE done = 1;
```

### Example Hand Query & Result

- **Query Executed**:
  ```sql
  SELECT * FROM tasks WHERE done = 1;
  ```
- **Result Returned**:
  ```json
  [ { "id": 2, "title": "Walk the dog", "done": 1 } ]
  ```
- **Observation**: The query filtered the database on disk, immediately returning only the row where `done` equals 1. Any manual updates in DB Browser are reflected instantly in API calls to `GET /tasks` without restarting the server, proving that SQLite is the single source of truth.

---

## API Reference

All write operations use **parameterized queries** (`?` placeholders) to prevent SQL injection vulnerabilities.

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/health` | Healthcheck endpoint | `200` |
| `GET` | `/docs` | Interactive Swagger API documentation | `200` |
| `GET` | `/tasks` | List all tasks (supports query filtering) | `200` |
| `GET` | `/tasks/:id` | Fetch a single task by ID | `200`, `404` |
| `POST` | `/tasks` | Create a new task (`title` required) | `201`, `400` |
| `PUT` | `/tasks/:id` | Update title or done status | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | Remove a task | `204`, `404` |
| `GET` | `/stats` | Aggregate task statistics | `200` |

### Query Parameters for `GET /tasks`

- `search`: Filter tasks whose title contains the substring (`WHERE title LIKE ?`).
  - Example: `GET /tasks?search=milk`
- `done`: Filter by completion status (`WHERE done = ?`).
  - Example: `GET /tasks?done=true` or `GET /tasks?done=false`
- `sort`: Order results (`ORDER BY title ASC` or `ORDER BY id DESC`).
  - Example: `GET /tasks?sort=title`

### Example Responses

**GET /tasks**:
```json
[
  { "id": 1, "title": "Buy milk", "done": false },
  { "id": 2, "title": "Walk the dog", "done": true },
  { "id": 3, "title": "Learn Express", "done": false }
]
```

**GET /stats**:
```json
{
  "total": 3,
  "completed": 1,
  "pending": 2
}
```

---

## Stretch & Design Insights

- **Storage as an Implementation Detail**: The client receives identical JSON responses and status codes as Assignment 1. Automated endpoint tests written for the in-memory API pass without changing a single line of test code, proving that underlying storage architecture does not leak into the public API contract.
- **Indexes**: Added index `idx_tasks_done` on `tasks(done)` and `idx_tasks_title` on `tasks(title)` to accelerate `WHERE` filtering and `ORDER BY` sorting as the dataset scales.
- **Atomic Transactions**: Seeding is enclosed in `db.transaction()` ensuring all-or-nothing execution, preventing partial database corruption.

---

## Stage 6: AI vs Me (Bonus AI Rematch)

An AI assistant was prompted in quarantine (`ai-version/`) to perform the same memory-to-SQLite migration.

### The Full Prompt Given to the AI

```text
Move our in-memory Express CRUD API to SQLite using the better-sqlite3 library.

Key Requirements:
1. Use SQLite with better-sqlite3 storing data in a local file named tasks.db.
2. Ensure the tasks table exists with columns: id (integer primary key), title (text not null), done (integer/boolean).
3. If the tasks table is empty, seed 3 sample tasks:
   - 'Buy milk' (done: false/0)
   - 'Walk the dog' (done: true/1)
   - 'Learn Express' (done: false/0)
   Do not duplicate these sample tasks on subsequent server restarts.
4. Implement all standard CRUD endpoints keeping the exact same request and response structure:
   - GET /tasks: list all tasks
   - GET /tasks/:id: return single task or 404 { error: 'Task not found' }
   - POST /tasks: create task with title, returning 201 with created task; return 400 { error: 'Title is required' } if title missing or empty
   - PUT /tasks/:id: update title and/or done status, returning updated task; return 404 if not found, 400 if invalid body
   - DELETE /tasks/:id: delete task, returning 204 with empty body; return 404 if not found
5. Always use parameterized queries for all SQL queries to prevent SQL injection.
```

### Analysis & Diff Answers

1. **What did it do better — and can you explain it?**
   - **Cleaner DELETE Handling**: The AI ran `DELETE FROM tasks WHERE id = ?` immediately and checked `info.changes === 0` to return `404`. This avoids performing an unnecessary preliminary `SELECT` check before deleting, reducing database disk operations.
2. **What did it get wrong or quietly ignore?**
   - **Response Contract Violation (Integer vs Boolean)**: The AI returned SQLite rows directly (`done: 0` / `done: 1`) instead of maintaining the boolean contract (`done: false` / `done: true`) established in Assignment 1. Strict frontend clients or contract tests checking `typeof res.body[0].done === 'boolean'` would fail.
   - **Missing Transaction Safety**: The AI inserted the three sample tasks with three sequential `insert.run()` calls rather than inside an atomic `db.transaction()`. If the process failed mid-seed, partial data could be written.
   - **Lax Validation**: In `PUT /tasks/:id`, the AI did not check for whitespace-only titles (`title.trim() === ''`).
3. **What did your prompt forget to specify — and what did the AI silently decide for you?**
   - The prompt specified keeping the "exact same request and response structure", but did not explicitly emphasize that SQLite represents booleans as `0/1` and must be mapped back to JSON booleans upon serialization. The AI silently decided to return raw database columns as-is.
   - The prompt did not specify transaction requirements or indexing.

### Rematch & Prompt Improvement

- **Improved Prompt**:
  > *"Migrate the Express API to SQLite using `better-sqlite3`. Table schema: `id` (INTEGER PRIMARY KEY), `title` (TEXT NOT NULL), `done` (INTEGER NOT NULL DEFAULT 0). Wrap multi-row initial seeds in an atomic transaction. Format all API responses so `done` is mapped to an explicit JavaScript boolean (`true`/`false`) to preserve contract parity with Assignment 1. Add `.trim()` validation on title updates in PUT."*
- **What Changed**: The improved prompt explicitly enforces schema typing, transaction safety, and response serialization rules, removing AI ambiguity and preventing subtle runtime contract bugs.