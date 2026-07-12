# Environment Files

This folder keeps shareable environment templates only. Do not put real secrets here.

## Runtime Locations

The running apps read environment files from these locations:

- API runtime: `apps/api/.env`
- Web runtime: `apps/web/.env.local`

Create local runtime files by copying the templates:

```powershell
Copy-Item .\env\api.env.example .\apps\api\.env
Copy-Item .\env\web.env.local.example .\apps\web\.env.local
```

Both runtime files are ignored by git.

## API Variables

- `PORT` controls the Express server port.
- `MONGO_URL` points the Express API to MongoDB.
- `CORS_ORIGIN` must match the web app origin.
- `DEEPSEEK_API_KEY` is required for chat and AI generation.
- `DEEPSEEK_BASE_URL` overrides the DeepSeek endpoint when needed.
- `DEEPSEEK_MODEL` controls the default AI model.
- Searchable PDFs and plain-text documents are extracted locally in the browser; no OCR provider key is required.

## Web Variables

- `BUTLER_API_URL` tells the Next frontend where to proxy `/express-api/*`.
