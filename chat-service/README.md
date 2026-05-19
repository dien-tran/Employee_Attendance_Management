# Chatbot HR

Hệ thống chatbot HR gồm 3 lớp chính:
- `mysql_agent`: xử lý câu hỏi chi tiết/cá nhân bằng SQL trên 2 nguồn MySQL (`auth_db`, `core_db`).
- `llm_wiki_agent`: xử lý câu hỏi tổng hợp dựa trên markdown summary.
- `orchestrator_agent`: LLM classifier để route `wiki|auth-db|core-db|composed` (threshold mặc định `0.6`).

## 1. Kiến trúc tổng thể

### 1.1 Thành phần
- `agents/mysql_agent.py`: NL -> SQL -> validate -> execute -> trả lời.
- `agents/llm_wiki_agent.py`: route `staff|attendance` -> load markdown -> trả lời.
- `agents/orchestrator_agent.py`: classifier `wiki|auth-db|core-db|composed` + confidence.
- `agents/common.py`: HTTP client + error payload dùng chung cho OpenRouter/Chutes.
- `mcp_server.py`: expose các tool qua MCP (STDIO).
- `api_server.py`: expose API qua FastAPI để test nhanh.
- `scripts/hr_etl/`: ETL package sinh summary markdown.
  - `extract.py`, `metrics.py`, `transform.py`, `markdown.py`, `pipeline.py`.
- `scripts/run_hr_etl_pipeline.py`: entry-point chạy ETL.
- `schema.sql`: schema MySQL (`staffs`, `attendances`).
- `db.py`: kết nối dual-source DB + `run_auth_select` / `run_core_select`.

### 1.2 Luồng xử lý
1. User gửi câu hỏi vào `/ask-orchestrated` hoặc MCP `ask_orchestrated`.
2. `orchestrator_agent` gọi classifier:
   - Nếu route `llm_wiki_agent` và confidence `>= threshold` -> dùng wiki agent.
   - Ngược lại -> fallback `mysql_agent`.
3. `llm_wiki_agent`:
   - Chọn file `staff_summary.md` hoặc `attendance_summary.md`.
   - Nạp context markdown và trả lời.
4. `mysql_agent`:
   - Sinh SQL từ câu hỏi.
   - Áp SQL guard (read-only, no multi-statement, no comments, cap `LIMIT 50`).
   - Execute MySQL và trả lời theo kết quả.

## 2. API & MCP

### 2.1 FastAPI
Chạy:
```bash
uvicorn api_server:app --reload --port 8000
```

Endpoints:
- `GET /health`
- `POST /message` (API facade cho frontend)
- `GET /schema`
- `POST /generate-sql`
- `POST /execute-sql`
- `POST /ask` (mysql_agent)
- `POST /ask-wiki` (llm_wiki_agent)
- `POST /ask-orchestrated` (orchestrator)

Ví dụ:
```bash
curl -X POST http://127.0.0.1:8000/ask-orchestrated \
  -H "Content-Type: application/json" \
  -d '{"question":"Tỷ lệ đi muộn theo phòng ban tháng này là bao nhiêu?"}'
```

### 2.2 MCP tools
Chạy:
```bash
python mcp_server.py
```

Tools:
- `get_db_schema()`
- `generate_sql(question, context="")`
- `execute_sql(sql)`
- `ask_hr(question, context="")`
- `ask_wiki(question, context="", topic="")`
- `ask_orchestrated(question, context="")`

## 3. ETL Summary Pipeline

Sinh markdown summary:
```bash
python scripts/run_hr_etl_pipeline.py --mode both
```

Các mode:
- `--mode staff`: chỉ xuất `staff_summary.md`
- `--mode attendance`: chỉ xuất `attendance_summary.md`
- `--mode both`: xuất cả 2
- `--mode single`: output legacy single-table

Output mặc định:
- `scripts/wiki_exports/attendance_analytics/staff_summary.md`
- `scripts/wiki_exports/attendance_analytics/attendance_summary.md`

## 4. Cấu hình môi trường

Yêu cầu:
- Python `>=3.12`
- MySQL đã import `schema.sql`

Cài dependencies:
```bash
pip install -r requirements.txt
```

Tạo env:
```bash
cp .env.example .env
```

Biến cấu hình chính:
- DB nguồn auth: `AUTH_DB_HOST`, `AUTH_DB_PORT`, `AUTH_DB_USER`, `AUTH_DB_PASSWORD`, `AUTH_DB_NAME`
- DB nguồn core: `CORE_DB_HOST`, `CORE_DB_PORT`, `CORE_DB_USER`, `CORE_DB_PASSWORD`, `CORE_DB_NAME`
- LLM provider:
  - `LLM_PROVIDER=chutes|openrouter`
  - Nếu `chutes`: `CHUTES_API_KEY`, `CHUTES_MODEL`, `CHUTES_BASE_URL`
  - Nếu `openrouter`: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`
- Orchestrator (optional):
  - `CLASSIFIER_CONFIDENCE_THRESHOLD` (default `0.6`)
  - `ORCHESTRATOR_MODEL` (default theo model của provider đang chọn)
- Wiki paths (optional):
  - `WIKI_STAFF_SUMMARY_PATH`
  - `WIKI_ATTENDANCE_SUMMARY_PATH`
- Logging (optional):
  - `HR_CHATBOT_LOG_LEVEL` (`INFO`/`DEBUG`/...)
  - `HR_CHATBOT_LOG_COLOR` (`auto`/`on`/`off`)
  - `HR_CHATBOT_LOG_NAME_WIDTH` (default `28`)

## 5. Logging & Debug

`/ask-orchestrated` có trace theo flow:
- user query
- classifier decision (route/confidence)
- threshold decision
- selected agent
- fallback reason (nếu có)

## 6. Test

```bash
pytest -q
```

## 7. Lưu ý
- Hiện tại chỉ hỗ trợ read-only query.
- Chưa có masking PII ở tầng response.
- Nếu thiếu `fastmcp`, `mcp_server.py` sẽ báo lỗi yêu cầu cài package.
