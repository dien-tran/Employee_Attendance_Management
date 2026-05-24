from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True)
class RuntimeConfig:
    device: str
    gpu_id: int
    insightface_ctx_id: int
    torch_device: str
    onnx_providers: tuple[str, ...]


def resolve_runtime(runtime_config: Mapping[str, Any] | None = None) -> RuntimeConfig:
    runtime_config = runtime_config or {}
    device = str(runtime_config.get("device", "cpu")).strip().lower()
    if device not in {"cpu", "gpu"}:
        raise ValueError('runtime.device must be either "cpu" or "gpu"')

    gpu_id = int(runtime_config.get("gpu_id", 0))
    if gpu_id < 0:
        raise ValueError("runtime.gpu_id must be greater than or equal to 0")

    if device == "gpu":
        return RuntimeConfig(
            device=device,
            gpu_id=gpu_id,
            insightface_ctx_id=gpu_id,
            torch_device=f"cuda:{gpu_id}",
            onnx_providers=("CUDAExecutionProvider", "CPUExecutionProvider"),
        )

    return RuntimeConfig(
        device=device,
        gpu_id=gpu_id,
        insightface_ctx_id=-1,
        torch_device="cpu",
        onnx_providers=("CPUExecutionProvider",),
    )
