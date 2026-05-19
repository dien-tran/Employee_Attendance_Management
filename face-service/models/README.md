# Face Service Models

The model weights in this directory are required when the face-service loads
the enrollment or check-in pipeline.

These files are tracked with Git LFS because some ONNX weights are larger than
GitHub's normal file size limit:

- `buffalo_l/*.onnx`
- `anti_spoof/*.pth`

After cloning, install Git LFS and pull the binary weights:

```powershell
git lfs install
git lfs pull
```

If the files are missing, the backend can start for light routes like `/health`,
but enrollment/check-in WebSocket flows will fail when the model singleton is
created.
