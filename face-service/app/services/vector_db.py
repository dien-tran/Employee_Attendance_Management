from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping
from uuid import UUID, uuid4

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http import models


@dataclass(frozen=True)
class FaceSearchHit:
    """One Qdrant face search result returned to the check-in pipeline."""

    point_id: str | int
    score: float
    payload: dict[str, Any]


class VectorDBService:
    def __init__(self, qdrant_config: Mapping[str, Any]) -> None:
        # qdrant_config được truyền từ config["qdrant"]. Ví dụ:
        # vector_db = VectorDBService(config["qdrant"])
        # vector_db.ensure_collection()
        # embedding_id = vector_db.upsert_face_embedding(final_embedding, metadata)

        # host/port là REST endpoint của Qdrant trong docker-compose.yml.
        self.host = str(qdrant_config["host"])
        self.port = int(qdrant_config["port"])

        # collection_name là nơi lưu vector khuôn mặt. Dim phải khớp final embedding.
        self.collection_name = str(qdrant_config["collection_name"])
        self.embedding_dim = int(qdrant_config["embedding_dim"])

        # QdrantClient giữ connection config; service này không tự start Docker.
        self.client = QdrantClient(host=self.host, port=self.port)

    def ensure_collection(self) -> None:
        # Collection phải tồn tại trước khi upsert. Dùng COSINE vì embeddings đã
        # được L2-normalize ở EmbeddingService.average_and_normalize(...).
        if self.client.collection_exists(collection_name=self.collection_name):
            return

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(
                size=self.embedding_dim,
                distance=models.Distance.COSINE,
            ),
        )

    def upsert_face_embedding(
        self,
        embedding: np.ndarray,
        metadata: Mapping[str, Any],
        point_id: str | int | None = None,
    ) -> str:
        # embedding phải là final vector từ EmbeddingService.average_and_normalize(...).
        # Không truyền average vector chưa normalize vào đây.
        vector = self._validate_embedding(embedding)

        # metadata là payload đi kèm vector trong Qdrant. Pipeline/schema sau này
        # sẽ chuẩn hóa field bắt buộc như employee_id, full_name, date_of_birth...
        payload = self._validate_metadata(metadata)

        # point_id là id của record trong Qdrant. Qdrant chỉ nhận unsigned integer
        # hoặc UUID string, không nhận string bất kỳ như "NV001".
        # Nếu caller không truyền, service tự tạo UUID string cho enrollment mới.
        embedding_id = self._resolve_point_id(point_id)

        point = models.PointStruct(
            id=embedding_id,
            vector=vector.tolist(),
            payload=payload,
        )

        self.client.upsert(
            collection_name=self.collection_name,
            points=[point],
        )
        return str(embedding_id)

    def search_face(
        self,
        embedding: np.ndarray,
        limit: int = 1,
        score_threshold: float | None = None,
    ) -> list[FaceSearchHit]:
        """Search enrolled face embeddings in Qdrant.

        Args:
            embedding: ArcFace 512-D vector that has already been L2-normalized.
                Example: `np.ndarray shape (512,)`.
            limit: Maximum number of matches to return. Example: `1`.
            score_threshold: Optional cosine similarity threshold. Example:
                `0.55`.

        Returns:
            List of `FaceSearchHit`; returns an empty list when Qdrant has no
            match above `score_threshold`.

        Raises:
            ValueError: If `embedding` has the wrong shape, is not
                L2-normalized, or contains NaN/Inf. Also raised when `limit` is
                less than 1.

        Example:
            `hits = vector_db.search_face(face_embedding, limit=1, score_threshold=0.55)`
        """

        if limit < 1:
            raise ValueError("limit must be greater than or equal to 1")

        # Reuse `_validate_embedding(...)` so 512-D/L2-normalized rules stay
        # identical between enrollment upsert and check-in search.
        vector = self._validate_embedding(embedding)

        response = self.client.query_points(
            collection_name=self.collection_name,
            query=vector.tolist(),
            limit=limit,
            with_payload=True,
            with_vectors=False,
            score_threshold=score_threshold,
        )

        hits: list[FaceSearchHit] = []
        for point in response.points:
            # Qdrant collection uses cosine distance, so a higher score means
            # the searched face embedding is more similar to the enrolled one.
            hits.append(
                FaceSearchHit(
                    point_id=point.id,
                    score=float(point.score),
                    payload=dict(point.payload or {}),
                )
            )
        return hits

    def _validate_embedding(self, embedding: np.ndarray) -> np.ndarray:
        # Qdrant nhận list float, nhưng validate ở numpy trước để bắt lỗi sớm.
        if not isinstance(embedding, np.ndarray):
            raise TypeError("embedding must be a numpy.ndarray")

        vector = embedding.astype(np.float32, copy=False)
        if vector.ndim != 1:
            raise ValueError("embedding must be a 1-D vector")

        if vector.shape[0] != self.embedding_dim:
            raise ValueError(
                f"embedding must have dimension {self.embedding_dim}, got {vector.shape[0]}"
            )

        if not np.all(np.isfinite(vector)):
            raise ValueError("embedding contains NaN or infinite values")

        # Final embedding phải có L2 norm xấp xỉ 1.0 để cosine similarity ổn định.
        # Dùng tolerance nhỏ để tránh reject vì sai số float32.
        norm = float(np.linalg.norm(vector))
        if not np.isclose(norm, 1.0, atol=1e-3):
            raise ValueError(f"embedding must be L2-normalized before Qdrant upsert, norm={norm}")

        return vector

    @staticmethod
    def _validate_metadata(metadata: Mapping[str, Any]) -> dict[str, Any]:
        # Metadata không được rỗng vì payload là nơi lưu thông tin employee_id,
        # full_name, date_of_birth, enrolled_at, score averages...
        if not isinstance(metadata, Mapping):
            raise TypeError("metadata must be a mapping")
        if not metadata:
            raise ValueError("metadata must not be empty")

        # Ép về dict thường để Qdrant client serialize ổn định.
        return dict(metadata)

    @staticmethod
    def _resolve_point_id(point_id: str | int | None) -> str | int:
        if point_id is None:
            return str(uuid4())

        if isinstance(point_id, int):
            if point_id < 0:
                raise ValueError("point_id integer must be unsigned")
            return point_id

        if isinstance(point_id, str):
            # UUID(...) validate format và trả về canonical lowercase UUID string.
            # Ví dụ hợp lệ: "550e8400-e29b-41d4-a716-446655440000".
            try:
                return str(UUID(point_id))
            except ValueError as exc:
                raise ValueError("point_id string must be a valid UUID") from exc

        raise TypeError("point_id must be None, an unsigned integer, or a UUID string")
