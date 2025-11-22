# System Architecture

A modular architecture designed for reliability, scalability, and clean separation between:

- **Frontend (Next.js)**
- **Backend API (Express)**
- **Background Worker (Bull Queue)**
- **MongoDB**
- **Redis Queue**

## 1️⃣ High-Level Architecture Diagram

```mermaid
flowchart LR
    A[Job Feeds (XML/JSON)] -->|fetcher| B(Express API Server)
    B -->|enqueue items| C(Redis Queue)
    C --> D(Worker Process)
    D -->|upsert| E[(MongoDB)]
    D -->|update stats| F[(Import Logs)]
    B --> G[Next.js Admin Client]
    G -->|view logs| F
    G -->|view jobs| E
    G -->|trigger reimport| B
```

## 2️⃣ Backend Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant Queue
    participant Worker
    participant Mongo

    User->>Frontend: Open Dashboard
    Frontend->>API: GET /api/import-logs
    API->>Mongo: Query import_logs
    Mongo-->>API: Logs returned
    API-->>Frontend: Render logs

    User->>Frontend: Trigger Reimport
    Frontend->>API: POST /api/reimport
    API->>Queue: Add N items
    Queue->>Worker: Process jobs (concurrency N)
    Worker->>Mongo: Upsert Job
    Worker->>Mongo: Update ImportLog stats
```

## 3️⃣ Queue Processing Flow

```mermaid
flowchart TD
    A[Job Item] --> B{Parse + Validate}
    B -->|valid| C[Determine externalId]
    C --> D[Upsert Job in MongoDB]
    D -->|new| E[Increment newJobs]
    D -->|updated| F[Increment updatedJobs]
    B -->|invalid| G[Record failure]
```

## 4️⃣ MongoDB Schema Design

### Job Schema

```json
{
  "title": "...",
  "company": "...",
  "location": "...",
  "externalId": "unique-field",
  "sourceFeed": "jobicy.com",
  "raw": {},
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Import Log Schema

```json
{
  "timestamp": "...",
  "fileName": "feed-url",
  "totalFetched": 0,
  "newJobs": 0,
  "updatedJobs": 0,
  "failedJobs": 0,
  "failures": []
}
```

