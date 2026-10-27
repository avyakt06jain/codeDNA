# CodeDNA G1 Memory Proof

Verified on Windows with Python 3.12, Hindsight 1.1.0, embedded pg0, and Gemini `gemini-3.1-flash-lite`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e "backend[dev,service]"
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Set `HINDSIGHT_API_LLM_API_KEY` in the ignored `.env`, then run the verified sequence:

```powershell
Set-Location backend
..\.venv\Scripts\codedna-memory-smoke.exe seed-and-recall --runtime in-process
..\.venv\Scripts\codedna-memory-smoke.exe recall-only --runtime in-process
..\.venv\Scripts\codedna-memory-smoke.exe isolation-check --runtime in-process
..\.venv\Scripts\codedna-memory-smoke.exe seed-and-recall --runtime in-process
Set-Location ..
.\.venv\Scripts\python.exe -m pytest backend\tests
```

Every smoke command exits nonzero on service failure or failed acceptance criteria and emits sanitized JSON. The second command starts a fresh Hindsight process and performs no retain; the final seed command verifies stable-document reingestion remains unique.

Run the verified G2 memory/no-memory review pair:

```powershell
Set-Location backend
..\.venv\Scripts\codedna-review-smoke.exe
```

Run the verified G4 feedback/supersession proof:

```powershell
Set-Location backend
..\.venv\Scripts\codedna-policy-smoke.exe
```

Reset only the synthetic demo state, then run the verified G5 controlled comparison:

```powershell
Set-Location backend
..\.venv\Scripts\codedna-demo-reset.exe --confirm-demo-reset
..\.venv\Scripts\codedna-evaluation-smoke.exe
```

The reset refuses non-designated databases and requires the explicit confirmation flag. The evaluation exits nonzero if the memory run lacks validated provenance or if the baseline contains a memory citation/team-policy finding. Gemini free-tier demand can still produce transient `429`/`503` responses; the review adapter makes only two bounded retries and never selects a paid fallback.

Run the API for the evolved judge demo from `backend` so `sqlite:///./data/codedna.sqlite3` and the repo-root `.env` resolve as they do today:

```powershell
Set-Location backend
$env:CODEDNA_DEMO_SCENE='evolved'
$env:CODEDNA_HINDSIGHT_AUTOSTART='1'
$env:PYTHONUTF8='1'
$env:PYTHONIOENCODING='utf-8'
..\.venv\Scripts\python.exe -m uvicorn codedna_memory.api:app --host 127.0.0.1 --port 8000
```

`CODEDNA_DEMO_SCENE=evolved` supersedes `DEC-0042` with active `DEC-0103` once, and a later boot does not create a second copy. Leave `CODEDNA_HINDSIGHT_AUTOSTART` unset or `1` so this process starts the shared in-process Hindsight server. The first boot loads local embedding and reranker models and can take several minutes; `GET /api/health` stays `hindsight: starting` until that finishes. On 2026-10-27, with those models already on disk, health first reported `hindsight: ready` 91 seconds after process start (the change fell in the 86–91 second window of a 5-second poll). Later review and Memory Lab clicks reuse that server. They do not boot Hindsight again.

In a second PowerShell window, run the frontend:

```powershell
Set-Location frontend
npm install
npm test
npm run build
npm run dev
```

Judge URLs, with Vite proxying `/api` to `127.0.0.1:8000`:

- `http://127.0.0.1:5173/` — Acme Commerce overview
- `http://127.0.0.1:5173/repos/repo-acme-commerce/prs/pr-acme-87` — PR #87 review
- `http://127.0.0.1:5173/repos/repo-acme-commerce/dna` — Team DNA
- `http://127.0.0.1:5173/repos/repo-acme-commerce/dna/DEC-0103` — decision evolution
- `http://127.0.0.1:5173/repos/repo-acme-commerce/lab` — Memory Lab

See `docs/DEMO.md` for the observed judge script and `docs/evaluation/g5-result.md` for the earlier recorded evaluation.

Review Workspace and Memory Lab both queue persisted background jobs and poll queued, Hindsight startup, recall/review, baseline, and completion. Stopping the API process interrupts active in-process work. The on-screen findings stay with the page that started the job; refreshing the pull request does not replay a finished job.
