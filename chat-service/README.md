# Chat Service

AI chatbot for HR queries with orchestrated agents.

## Port
8000 (FastAPI)

## Architecture
Three-layer agent system:
1. **orchestrator_agent** - LLM classifier routes to wiki|auth-db|core-db|composed
2. **llm_wiki_agent** - Handles staff/attendance questions via markdown summaries
3. **mysql_agent** - NL to SQL execution on auth_db and core_db

## Key Endpoints
- GET /health - Health check
- POST /message - API facade for frontend
- POST /ask - mysql_agent
- POST /ask-wiki - llm_wiki_agent
- POST /ask-orchestrated - orchestrator routing
- POST /generate-sql - SQL generation
- POST /execute-sql - SQL execution

## ETL Pipeline
- Scripts in scripts/hr_etl/
- Generates staff_summary.md and attendance_summary.md
- Runs on startup (if core_db.attendances empty)
- Scheduled every 300s (5 minutes)

## Tech Stack
- Python 3.12+
- FastAPI
- LLM provider: chutes|openrouter
- MySQL dual-source (auth_db, core_db)
- Pydantic for validation

## Env Variables
- AUTH_DB_* - auth database connection
- CORE_DB_* - core database connection
- LLM_PROVIDER - chutes|openrouter
- CHUTES_API_KEY / OPENROUTER_API_KEY
- CLASSIFIER_CONFIDENCE_THRESHOLD (default 0.6)

## Mock Data
Seeds 100 staffs and 5000 attendance events
Top departments: Operations(23), Admin(14), IT(14), Marketing(13), Sales(13)
