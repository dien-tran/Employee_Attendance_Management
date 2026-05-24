# CPU-first backend image. GPU deployment can use a separate Dockerfile later
# because CUDA/PyTorch/ONNX Runtime images need a different base image.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# OpenCV/InsightFace need runtime system libs; insightface may build native
# extensions during pip install, so keep build tools available in this image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libglib2.0-0 \
        libgl1 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-cpu.txt ./requirements-cpu.txt
RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install -r requirements-cpu.txt

COPY app ./app
COPY config ./config

EXPOSE 8083

# Models are mounted at runtime with docker-compose:
# ./models:/app/models:ro
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
