# Mini Credit Insights Service (Starter)

A starter scaffold for the Zeeh Africa take-home. Build a backend that ingests bank statements (CSV), computes insights, and integrates with a mock credit bureau.

## Quick Start
1. Copy `.env.example` to `.env` and edit values.
2. `npm install`
3. `docker compose up` (runs Postgres + mock bureau + API in dev mode)
4. Run Prisma: `npm run prisma:migrate` then `npm run prisma:generate`
5. Visit `http://localhost:3000/docs` (once you mount your OpenAPI).

## Scripts
- `npm run dev` – start in dev (ts-node-dev)
- `npm run build` – compile TypeScript
- `npm test` – run tests

## Folders
- `src/` – app code (routes, controllers, services, middleware, utils)
- `prisma/` – Prisma schema & migrations
- `tests/` – unit & integration tests (includes mock bureau)
- `sample-data/` – sample CSV files for testing
- `scripts/` – utility scripts including automated testing

## API Endpoints

### Authentication
- `POST /auth/register` – Register new user (Admin only)
- `POST /auth/login` – User login

### Statements
- `POST /statements/upload` – Upload CSV bank statement
- `GET /statements/:id` – Get statement details and transactions

### Insights
- `POST /insights/run` – Compute financial insights from statement
- `GET /insights/:id` – Get computed insights

### Credit Bureau
- `POST /bureau/check` – Perform credit check
- `GET /bureau/report/:bvn` – Get credit report by BVN

### Audit Logs (Admin only)
- `GET /audit/logs` – Get paginated audit logs with filtering
- `GET /audit/logs/:id` – Get specific audit log
- `GET /audit/actions` – Get list of available audit actions
- `GET /audit/target-types` – Get list of audit target types
- `GET /audit/summary` – Get audit statistics and summaries

### System
- `GET /health` – Health check
- `GET /metrics` – Basic metrics
- `GET /docs` – API documentation (Swagger UI)

## Testing

### Automated Testing
```bash
# Run the complete test suite
./scripts/test-api.sh
```

### Manual Testing
Use the sample data in `sample-data/sample-statement.csv` to test the API:
1. Start server: `npm run dev`
2. Create admin user and login
3. Upload CSV statement
4. Compute insights
5. Check audit logs

## Notes
- Implement CSV parsing in `services/insightsService.ts`.
- Implement bureau client with retries/timeouts in `services/bureauClient.ts`.
- Expose OpenAPI at `/docs` using `swagger-ui-express`.
- Comprehensive audit logging for all operations.
- Role-based access control (RBAC) enforced on all endpoints.
