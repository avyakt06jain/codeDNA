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

Run the API for the product UI:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn codedna_memory.api:app --host 127.0.0.1 --port 8000
```

In a second PowerShell window, run the verified frontend:

```powershell
Set-Location frontend
npm install
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:5173`, select synthetic PR #87, and run the memory-assisted review. The first run loads local retrieval models and can take longer than subsequent runs.
