# Butler

Butler is an AI study agent that helps users manage daily study tasks, set goals and keep track of notes. Custom panels let users build a study workspace around their own needs.

An independent personal project, designed and developed by Feng Kaiduo.

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
