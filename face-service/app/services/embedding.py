from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, Sequence

import numpy as np


if TYPE_CHECKING:
    from app.services.detection import DetectedFace


class EmbeddingService:
    def __init__(self, qdrant_config: Mapping[str, Any] | None = None) -> None:
        # qdrant_config thường được truyền từ config["qdrant"]. Ví dụ:
        # embedding_service = EmbeddingService(config["qdrant"])
        # embedding = embedding_service.extract(detected_face)
        # final_embedding = embedding_service.average_and_normalize(good_embeddings)

        # embedding_dim là số chiều vector ArcFace. buffalo_l trả 512-D, và Qdrant
        # collection cũng phải tạo cùng dim này để lưu/search cosine đúng.
        qdrant_config = qdrant_config or {}
        self.embedding_dim = int(qdrant_config.get("embedding_dim", 512))

    def extract(self, face: DetectedFace) -> np.ndarray:
        # face.normed_embedding được InsightFace buffalo_l tạo trong bước detection.
        # Nó đã là vector ArcFace L2-normalized cho từng frame riêng lẻ.
        if face.normed_embedding is None:
            raise ValueError("Detected face does not contain normed_embedding")

        return self._validate_embedding(face.normed_embedding, name="face.normed_embedding")

    def average_and_normalize(self, embeddings: Sequence[np.ndarray]) -> np.ndarray:
        # embeddings là list các vector từ những frame đã pass:
        # Detection -> Anti-Spoofing -> Quality Gate.
        # Ví dụ: good_embeddings.append(embedding_service.extract(detected_face))
        if not embeddings:
            raise ValueError("embeddings must contain at least one vector")

        validated_embeddings = [
            self._validate_embedding(embedding, name=f"embeddings[{index}]")
            for index, embedding in enumerate(embeddings)
        ]

        # Stack thành ma trận shape [num_frames, embedding_dim], rồi lấy mean theo
        # trục frame để tạo centroid đại diện cho nhân viên.
        embedding_matrix = np.stack(validated_embeddings, axis=0)
        average_embedding = embedding_matrix.mean(axis=0)

        # Cực kỳ quan trọng: average của các vector đã L2-normalized KHÔNG tự
        # normalized. Phải normalize lại trước khi lưu Qdrant cosine distance.
        return self.l2_normalize(average_embedding)

    def l2_normalize(self, vector: np.ndarray) -> np.ndarray:
        # L2 norm = sqrt(sum(vector_i^2)). Sau normalize, norm vector phải xấp xỉ 1.
        validated_vector = self._validate_embedding(vector, name="vector")
        norm = float(np.linalg.norm(validated_vector))
        if norm <= 0.0:
            raise ValueError("Cannot L2-normalize a zero vector")

        return (validated_vector / norm).astype(np.float32)

    def _validate_embedding(self, embedding: np.ndarray, name: str) -> np.ndarray:
        # Chấp nhận input numpy array, ép về float32 để thống nhất với model output
        # và format vector sẽ gửi sang Qdrant.
        if not isinstance(embedding, np.ndarray):
            raise TypeError(f"{name} must be a numpy.ndarray")

        vector = embedding.astype(np.float32, copy=False)
        if vector.ndim != 1:
            raise ValueError(f"{name} must be a 1-D vector")

        if vector.shape[0] != self.embedding_dim:
            raise ValueError(
                f"{name} must have dimension {self.embedding_dim}, got {vector.shape[0]}"
            )

        if not np.all(np.isfinite(vector)):
            raise ValueError(f"{name} contains NaN or infinite values")

        return vector
