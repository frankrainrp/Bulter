# Butler - C270 Final Project

Butler is an AI-driven personal learning manager for students. It combines a
study chat interface, tasks, calendar planning, notes, document processing,
custom dashboards, and usage controls into one web application.

This submission packages Butler as a C270 LaunchLab final project. The focus is
not only the application, but also the DevOps workflow around it: version
control, CI/CD, Docker containerisation, repeatable deployment, validation,
security scanning, and monitoring.

## Team 2

| Member | App feature ownership | DevOps ownership | Contribution |
| --- | --- | --- | --- |
| Feng Kaiduo | Core architecture, AI chat, integration | CI/CD and integration lead | 26% |
| Yu Fei | Tasks and recurring task workflows | Docker containerisation | 15% |
| Ei Htet Htet Tun | Calendar and schedule planning | Deployment workflow | 15% |
| Hein Thu Nyi Nyi (June) | Notes and study content workflows | Ansible / IaC | 15% |
| Sherlyn | Quality checks and user validation | Testing and security gate | 15% |
| Khen | AI panel / data-source workflows | Monitoring and documentation | 14% |

The contribution table must match the final GitHub commit and PR history before
uploading to LMS.

## Local Development

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The login screen uses the built-in Butler database auth flow. In development,
accounts are stored in `apps/web/data/butler.sqlite` unless
`BUTLER_SQLITE_PATH` points somewhere else.

## CI Validation

```bash
pnpm ci:validate
pnpm test
pnpm build
```

`pnpm ci:validate` and `pnpm test` intentionally fail if
`apps/web/.env.local` is present. Run them from a clean clone or staged package
when validating the downloadable submission.

## Docker Deployment

```bash
docker compose up --build
```

Open `http://localhost:3000`, then verify health:

```bash
curl http://localhost:3000/api/health
```

Docker Compose stores the temporary SQLite auth database in the
`butler-sqlite` named volume.

## C270 DevOps Artefacts

| Requirement | Evidence in this repository |
| --- | --- |
| Version Control | GitHub workflow, branch strategy in final report |
| CI/CD | `.github/workflows/ci.yml` |
| Containerisation | `Dockerfile`, `.dockerignore`, `docker-compose.yml` |
| Deployment | Docker Compose local deployment and Ansible playbook |
| IaC | `ansible/deploy-butler.yml` |
| Testing / validation | `scripts/submission.test.mjs`, `scripts/ci-validate.mjs` |
| DevSecOps | `pnpm audit --audit-level critical` in CI |
| Monitoring | `/api/health` endpoint and Docker healthcheck |

See `docs/C270_FINAL_REPORT.md` for the full project explanation.
