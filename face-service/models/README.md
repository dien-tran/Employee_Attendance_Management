# Face Service Models

Model weights required for face-service enrollment and check-in pipelines.

## Files (tracked via Git LFS)
- buffalo_l/*.onnx - InsightFace models (detection, alignment, embedding)
- anti_spoof/*.pth - MiniFASNet for liveness detection

## Setup
```powershell
git lfs install
git lfs pull
```

## Note
Without these files, backend starts but enrollment/check-in WebSocket flows will fail when model singleton is created.
