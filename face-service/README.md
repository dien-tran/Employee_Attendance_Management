# Face Service

Face recognition and biometrics processing service.

## Tech Stack
- Python 3, FastAPI
- InsightFace (buffalo_l) - Detection/Alignment + ArcFace Embedding (512-D)
- MiniFASNet - Liveness Detection (anti-spoofing)
- Qdrant - Vector database for face embeddings
- MySQL - Employee information

## Port
8000 (backend), 3000 (frontend test)

## Key Features

### Face Enrollment
- WebSocket endpoint: /api/v1/enroll/ws
- Multi-frame capture for quality
- Detection -> Anti-Spoofing -> Quality Gate -> Embedding pipeline
- Average and L2-normalize embeddings before saving to Qdrant
- Metadata: employee_id, full_name, date_of_birth (ISO YYYY-MM-DD)

### Check-in/Check-out
- WebSocket endpoint: /api/v1/checkin/ws
- Real-time face recognition via camera
- Anti-spoofing on all frames
- Cooldown mechanism to prevent duplicate check-ins
- Syncs attendance records via internal API to core-service

### Quality Gate
Checks: blur, brightness, pitch/yaw <= 20°, face size
Rejects noisy/eye-closed/angled frames

### Anti-Spoofing
- Live score detection for photo/screen attacks
- Uses MiniFASNet model
- Default color space: bgr (OpenCV)

## Directory Structure
```
app/
  api/v1/ - API endpoints & WebSocket routers
  pipeline/ - Enrollment and Checkin pipelines
  services/ - AI services (detection, embedding, vector_db)
  schemas/ - Pydantic models
  core/ - Config, exceptions, dependencies
  utils/ - Helper functions
config/config.yaml - Configuration
models/ - Model weights (git-lfs)
frontend/ - Next.js test UI
```

## Dev Commands
- Backend: `docker compose up -d backend`
- Frontend: `cd frontend && npm run dev`
- CPU: `pip install -r requirements-cpu.txt`
- GPU: `pip install -r requirements-gpu.txt`

## Key Rules
- All parameters from config.yaml, no hardcoding
- Quality Gate before embedding
- L2-normalize before Qdrant save
- Use singleton services from get_service_container()
- WebSocket schema validation required
