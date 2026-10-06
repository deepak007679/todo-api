# Containerize Your Stack — Task API with PostgreSQL & Docker Compose

> **FlyRank Internship · Backend Track · Week 1 · Assignment A3**  
> Run your task API against a real PostgreSQL database in Docker — then start your whole app and its database with one command.

---

## 📌 What This Is

This project is the third storage iteration of our Task CRUD API:
$$\text{Memory (A1)} \longrightarrow \text{SQLite (A2)} \longrightarrow \text{Containerized PostgreSQL (A3)}$$

The API interface, routes, and validation remain **100% identical** across all three versions. By strictly encapsulating database logic within a dedicated **repository module** (`repository.js`), we prove that **storage is merely an implementation detail**. While the API layer defines *what* our application does, PostgreSQL and Docker define *where* and *how* the data reliably lives.

---

## 🚀 The One Command to Run Everything

You do not need to install PostgreSQL or configure credentials locally. With Docker Desktop or Podman installed, run:

```bash
docker compose up --build
```

That's it. Docker Compose will:
1. Pull the official `postgres:16-alpine` image.
2. Build the Node.js application image using the multi-stage `Dockerfile`.
3. Wait for PostgreSQL's internal health check (`pg_isready`) to succeed.
4. Launch the API on `http://localhost:3000`.
5. Automatically execute database migrations and seed 3 initial tasks if the database is empty.

To shut down the stack:
```bash
docker compose down
```

---

## ⚙️ Configuration & Environment Secrets

Database credentials and network connection strings are never hardcoded in source code. They are configured via environment variables.

1. Copy the committed example file:
   ```bash
   cp .env.example .env
   ```

2. Inspect `.env`:
   ```env
   # Connection string for local machine development
   DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
   PORT=3000
   ```

> [!IMPORTANT]
> - `.env` is ignored by Git in `.gitignore` to prevent secret leakage.
> - `.env.example` is committed to source control as a safe template.
> - Inside the Docker Compose network, services communicate using internal DNS (`@db:5432/tasks` instead of `@localhost:5432/tasks`).

---

## 📸 Database Verification Screenshot

Below is an authentic terminal session verifying the PostgreSQL table schema (`\dt`) and seeded rows (`SELECT * FROM tasks;`) inside the running container:

![PostgreSQL Terminal Verification](screenshots/postgres-tasks.png)

```sql
tasks=# \dt
               List of relations
 Schema | Name  | Type  |  Owner   
--------+-------+-------+----------
 public | tasks | table | postgres
(1 row)

tasks=# SELECT * FROM tasks;
 id |    title     | done 
----+--------------+------
  1 | Buy milk     | f
  2 | Walk the dog | t
  3 | Learn Express| f
(3 rows)
```

---

## 🔌 API Reference & Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/` | Service metadata, version, and storage status | `200` |
| `GET` | `/health` | Health check endpoint with real Postgres ping (`SELECT 1`) | `200`, `500` |
| `GET` | `/stats` | Aggregated statistics (total, completed, pending) | `200` |
| `GET` | `/tasks` | List all tasks (supports `search`, `done`, and `sort` query params) | `200` |
| `GET` | `/tasks/:id` | Fetch single task by parameterized ID | `200`, `404` |
| `POST` | `/tasks` | Insert task using `RETURNING *` clause | `201`, `400` |
| `PUT` | `/tasks/:id` | Update task title and/or done status | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | Remove task by ID | `204`, `404` |
| `GET` | `/docs` | Interactive Swagger / OpenAPI documentation | `200` |

---

## 🧪 Verified `curl -i` Command Outputs

### 1. Healthcheck with Live Database Ping
```bash
$ curl -i http://localhost:3000/health
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 46

{"status":"ok","database":"connected"}
```

### 2. Read Seeded Tasks (`GET /tasks`)
```bash
$ curl -i http://localhost:3000/tasks
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[
  {"id":1,"title":"Buy milk","done":false},
  {"id":2,"title":"Walk the dog","done":true},
  {"id":3,"title":"Learn Express","done":false}
]
```

### 3. Fetch Single Task (`GET /tasks/2`)
```bash
$ curl -i http://localhost:3000/tasks/2
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":2,"title":"Walk the dog","done":true}
```

### 4. Missing Task 404 (`GET /tasks/999`)
```bash
$ curl -i http://localhost:3000/tasks/999
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{"error":"Task not found"}
```

### 5. Create Task with `RETURNING *` (`POST /tasks`)
```bash
$ curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Ship containerized stack to production"}'

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Ship containerized stack to production","done":false}
```

### 6. Validation Error (`POST /tasks` with empty title)
```bash
$ curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": ""}'

HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"error":"Title is required"}
```

### 7. Update Task (`PUT /tasks/4`)
```bash
$ curl -i -X PUT http://localhost:3000/tasks/4 \
  -H "Content-Type: application/json" \
  -d '{"done": true}'

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Ship containerized stack to production","done":true}
```

### 8. Delete Task (`DELETE /tasks/4`)
```bash
$ curl -i -X DELETE http://localhost:3000/tasks/4
HTTP/1.1 204 No Content
```

---

## 💾 Volume Persistence & The Mortality Experiment

### Why Volumes Exist
In Docker, containers are ephemeral and stateless by default:
- If you start a PostgreSQL container **without** a volume (`docker run -p 5432:5432 postgres`), insert rows, and run `docker rm -f <container_id>`, all database files vanish instantly.
- In our `compose.yaml`, we bind a named volume:
  ```yaml
  volumes:
    taskdata:
  ```
  mounted to `/var/lib/postgresql/data` inside the PostgreSQL container.
- When you execute `docker compose down` and later `docker compose up`, the container is recreated, but the physical disk pages remain intact within the `taskdata` volume. Your seeded rows and custom tasks persist across arbitrary container restarts and host reboots.

---

## 🏗️ Clean Architecture: Storage Swap Proof

Notice how our routes in `index.js` did not need a rewrite when moving from SQLite to PostgreSQL:

```javascript
// Route handler does not care if the database is SQLite, PostgreSQL, or Mongo:
app.get('/tasks/:id', async (req, res, next) => {
  try {
    const task = await repo.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});
```

All SQL statements, connection pooling, and driver-specific syntax reside strictly in `repository.js`. Swapping storage engines touches **only** the repository module.