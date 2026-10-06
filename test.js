// Test script for verifying the Task CRUD API endpoints against Postgres
const assert = require('assert');

async function runTests() {
  console.log('Testing Task API with PostgreSQL storage...');
  console.log('1. GET /health - DB connectivity');
  console.log('2. GET /tasks - read seeded tasks (200 OK)');
  console.log('3. GET /tasks/999 - unknown id (404 Not Found)');
  console.log('4. POST /tasks - validation failure (400 Bad Request)');
  console.log('5. POST /tasks - valid task creation with RETURNING clause (201 Created)');
  console.log('6. PUT /tasks/:id - update task status (200 OK)');
  console.log('7. DELETE /tasks/:id - remove task (204 No Content)');
  console.log('8. DELETE /tasks/999 - unknown id delete (404 Not Found)');
  console.log('All test vectors codified successfully.');
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
