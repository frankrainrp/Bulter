# Butler - C270 Final Project Report

## 1. Project Overview

Butler is a student-focused personal learning manager. It helps students plan
coursework, track deadlines, manage notes, process study documents, and ask an
AI assistant for help inside one web application.

This fits the C270 LaunchLab problem statement under Campus Solutions because
the product solves a real student workflow problem: course tasks, revision
materials, calendar planning, and AI support are normally scattered across
separate tools.

## 2. Target Users

The target users are Republic Polytechnic students who need a lightweight way to
manage learning materials, deadlines, revision notes, and project work.

## 3. Main Application Features

| Feature | Description | Demo value |
| --- | --- | --- |
| AI study chat | Student can ask study and planning questions in the Butler interface. | Shows intelligent learning support. |
| Tasks and recurring tasks | Student can create, track, and review study tasks. | Shows CRUD and workflow logic. |
| Calendar planning | Student can view deadlines and plan weekly work. | Shows schedule management. |
| Notes | Student can capture study notes and preview content. | Shows learning record management. |
| Document processing | Student can upload or process study files for extraction and planning. | Shows API-backed workflow. |
| Custom panels | Student can create dashboards from data sources. | Shows extensibility. |
| Billing / credits prototype | Tracks usage and product-readiness concerns. | Shows maintainability and future business model thinking. |

## 4. Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Workspace | pnpm 9, Turborepo |
| Authentication | Butler email/password login with temporary SQLite session storage |
| Local storage | Dexie / IndexedDB and browser storage |
| Server-side database | SQLite via `better-sqlite3` for the current login gate |
| AI integration | OpenAI-compatible server routes |
| Validation | Zod and custom API guards |
| DevOps | GitHub Actions, Docker, Docker Compose, Ansible |

## 5. System Architecture

```mermaid
flowchart LR
  Student[Student Browser] --> Web[Next.js Web App]
  Web --> UI[Tasks, Calendar, Notes, Panels]
  Web --> API[Next.js API Routes]
  API --> AI[AI Provider APIs]
  API --> Parser[Document / OCR Processing]
  Web --> LocalDB[IndexedDB / Local Browser Storage]
  GitHub[GitHub Repository] --> Actions[GitHub Actions CI]
  Actions --> Build[Build and Tests]
  Build --> Docker[Docker Image]
  Docker --> Deploy[Docker Compose / Ansible Deployment]
  Deploy --> Health[/api/health Monitoring]
```

## 6. Version Control and Collaboration

The expected GitHub workflow is:

1. Work from `dev` or a feature branch.
2. Use branch names such as `feature/tasks`, `feature/docker`, and
   `feature/ansible-deploy`.
3. Open pull requests into `dev`.
4. Require CI to pass before merge.
5. Merge tested work into `main` for final submission.

This supports C270's requirement for commits, branches, pull requests, and
visible team collaboration.

## 7. CI/CD Pipeline

The workflow in `.github/workflows/ci.yml` runs on pushes and pull requests.

Pipeline stages:

| Stage | Purpose |
| --- | --- |
| Install | Reproducible install using pnpm 9 and the lockfile. |
| Validate | Checks required DevOps files, health endpoint, and no local `.env.local`. |
| Test | Runs Node automated tests for submission-critical evidence. |
| Build | Builds the production Next.js web app. |
| Security scan | Runs `pnpm audit --audit-level critical`. |
| Container build | Builds the Docker image to prove the app is containerisable. |

Only a successful pipeline should be allowed to proceed to merge or deployment.

## 8. Containerisation and Deployment

The `Dockerfile` uses a multi-stage build:

1. Install dependencies with pnpm.
2. Build the Next.js app.
3. Copy the built workspace into the runtime image.
4. Run the production Next.js server on port 3000.

`docker-compose.yml` starts the web service and includes a health check against
`/api/health`. It also mounts a named volume for the temporary SQLite login
database used by the current development mainline.

Deployment options:

| Option | How it is demonstrated |
| --- | --- |
| Local deployment | `docker compose up --build` exposes the app at `localhost:3000`. |
| Server deployment | `ansible/deploy-butler.yml` installs Docker, clones the repo, starts Compose, and verifies health. |
| Cloud deployment | The same Docker build can be deployed on Render, Railway, a VM, or other container platforms. |

## 9. Infrastructure as Code

The Ansible playbook demonstrates repeatable deployment:

- Install Docker and Docker Compose plugin.
- Check out the project repository.
- Build and run the project with Docker Compose.
- Verify the health endpoint.

This addresses C270's automation and Infrastructure as Code requirement.

## 10. Testing, Validation, and DevSecOps

Testing and validation evidence:

- `scripts/submission.test.mjs` checks the health endpoint, final report mapping,
  and secret exclusion.
- `scripts/ci-validate.mjs` checks required DevOps artefacts and configuration.
- `pnpm build` validates TypeScript and Next.js production build.
- `pnpm audit --audit-level critical` provides a dependency security gate.

The repository also contains security documentation from the Butler project,
showing awareness of authentication, API limits, SSRF risks, file upload risks,
and response headers.

## 11. Monitoring and Reliability

The app exposes `/api/health`, returning service status and timestamp. Docker
Compose uses this endpoint as a container health check. During deployment, the
Ansible playbook also verifies this endpoint after startup.

Reliability decisions:

- Pin pnpm version to avoid inconsistent installs.
- Use lockfile-based dependency installation.
- Build a production Docker image instead of relying on a developer machine.
- Exclude `.env.local` from the submission package.

## 12. Scalability, Reliability, and Maintainability

| Consideration | Current approach | Future improvement |
| --- | --- | --- |
| Scalability | Next.js app can run in a container and be moved to cloud hosting. | Add managed database and horizontal scaling. |
| Reliability | CI build, Docker image, health check, and repeatable deployment. | Add uptime monitoring and rollback strategy. |
| Maintainability | TypeScript, modular components, documented DevOps flow. | Add more feature-level automated tests. |
| Security | API guards, security headers, audit scan, secret exclusion, and temporary SQLite login. | Move auth to a managed database, add email verification, and add a server-side billing ledger. |

## 13. Team Contribution Table

| Member | App contribution | DevOps contribution | Contribution |
| --- | --- | --- | --- |
| Feng Kaiduo | Core architecture, AI chat, integration | CI/CD and integration lead | 26% |
| Yu Fei | Tasks and recurring task workflows | Docker containerisation | 15% |
| Ei Htet Htet Tun | Calendar and schedule planning | Deployment workflow | 15% |
| Hein Thu Nyi Nyi (June) | Notes and study content workflows | Ansible / IaC | 15% |
| Sherlyn | Quality checks and user validation | Testing and security gate | 15% |
| Khen | AI panel / data-source workflows | Monitoring and documentation | 14% |

Total: 100%.

This table must reflect the final GitHub commit and pull request history at the
time of submission.

## 14. Final Demo Script

1. Open the deployed app at `http://localhost:3000`.
2. Show the main Butler interface and key learning-management features.
3. Show GitHub branches, pull requests, and commit history.
4. Open GitHub Actions and show the CI pipeline stages.
5. Run or explain `docker compose up --build`.
6. Open `http://localhost:3000/api/health`.
7. Explain the Ansible deployment playbook.
8. Show the contribution table and each member's feature / DevOps ownership.
