# Architecture Document: AI Task Processing Platform

## System Overview
The AI Task Processing Platform is a distributed application designed to process text manipulation requests asynchronously. It utilizes a MERN stack (MongoDB, Express, React, Node.js) with a Python worker service for task execution. The system is containerized and orchestrated via Kubernetes (k3s), incorporating GitOps deployment using ArgoCD.

## High-Level Architecture
1. **Frontend (React + Vite)**: A responsive, modern UI built with React. Communicates with the backend API via HTTPS.
2. **Backend API (Node.js + Express)**: Handles user authentication (JWT), task creation, tracking, and serves as the gateway to the database and task queue.
3. **Queue (Redis + Bull)**: Redis acts as the message broker, storing pending tasks. Bull is used in Node.js to push tasks, and the Python worker reads these tasks from Redis in a Bull-compatible format.
4. **Worker (Python)**: Polls the Redis queue, processes tasks (e.g., uppercase, word count), updates task status in MongoDB, and stores results and logs.
5. **Database (MongoDB)**: Stores user accounts, task configurations, execution logs, and final results.

## Key Design Decisions & Strategies

### Worker Scaling Strategy
To handle variable loads, the Python worker is deployed as a Kubernetes `Deployment` backed by a `HorizontalPodAutoscaler` (HPA).
* The HPA monitors CPU and memory utilization of the worker pods.
* As the queue fills up, active workers consume more CPU/memory, triggering the HPA to scale out the number of replicas (configured from 2 up to 10 in our base manifests).
* The worker logic is stateless and idempotent; multiple workers can safely poll Redis concurrently without duplicating work thanks to atomic Redis operations (e.g., `RPOPLPUSH`).

### Handling High Task Volume (100k tasks/day)
1. **Asynchronous Processing**: Tasks do not block the HTTP thread. They are immediately pushed to Redis and a 201 Created response is returned. 100k tasks/day is ~1.15 tasks/second, well within the limits of NodeJS + Redis.
2. **Efficient Queueing**: Redis handles thousands of operations per second in-memory.
3. **Connection Pooling**: Backend and worker services maintain connection pools for MongoDB and Redis, preventing resource exhaustion from constant connection teardown/buildup.
4. **Pagination**: Frontend requests for tasks are paginated (e.g., `?page=1&limit=20`), preventing payload bloat on the API.
5. **Auto-scaling**: As mentioned, the HPA will automatically add worker pods during bursts and remove them during lulls.

### Database Indexing Strategy
To optimize query performance, MongoDB compound indexes are used specifically tailored to how users retrieve tasks:
* `userSchema.index({ email: 1 }, { unique: true })` - Fast login lookup.
* `taskSchema.index({ userId: 1, createdAt: -1 })` - Efficient retrieval of a user's recent tasks (used on the Dashboard).
* `taskSchema.index({ userId: 1, status: 1 })` - Fast filtering of tasks by status (e.g., pending, success) on the Tasks Page.
* `taskSchema.index({ status: 1, createdAt: -1 })` - Helpful for potential internal admin views or garbage collection of old failed tasks.

### Handling Redis Failure
* **Backend**: Configured with `maxRetriesPerRequest` and a custom retry strategy. If Redis fails, Express API endpoints using Bull will degrade gracefully, falling back to sending a `500` error while logging the failure, preventing app crashes.
* **Worker**: The Tenacity library in Python handles exponential backoff and retry logic when connecting to Redis. If a connection is lost during polling, the worker logs the error and sleeps before attempting reconnection, ensuring the worker pod doesn't crashloop endlessly under temporary network partitions.

### Deployment of Staging/Dev vs Production Environments
Deployment is managed exclusively via GitOps using **Argo CD** and **Kustomize**.
1. **Base Resources**: Kept in `infra/k8s/base` containing common deployments, services, and default configurations.
2. **Overlays**: Two Kustomization overlays are created in `infra/k8s/overlays/dev` and `infra/k8s/overlays/prod`.
3. **Environment Differences**:
   * **Dev/Staging**: Modifies the Kustomize `ConfigMap` for `NODE_ENV=development` and debug logging. Keeps replica counts at 1 to save resources. Points ArgoCD to the `dev` overlay.
   * **Production**: Modifies the ConfigMap for `NODE_ENV=production`. Modifies replica counts (e.g., 3 standard replicas for API, higher HPA bounds for workers). Enforces strict resource requests/limits. Points ArgoCD to the `prod` overlay.
4. **CI/CD flow**: The GitHub Action builds images upon `main` branch merges, pushes them to DockerHub, and then automatically commits the new image SHA tags to the `infra` repository. ArgoCD detects this change, calculates the diff, and automatically syncs the new Deployments into Kubernetes without manual intervention.
