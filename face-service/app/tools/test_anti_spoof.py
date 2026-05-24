from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import cv2

from app.core.config import load_config
from app.core.runtime import resolve_runtime
from app.services.anti_spoofing import AntiSpoofingService
from app.services.detection import FaceDetector


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run face detection and anti-spoofing directly on static images.",
    )
    parser.add_argument(
        "--input",
        default="TestImage",
        help="Image file or directory of images. Default: TestImage",
    )
    parser.add_argument(
        "--output",
        default="log/anti_spoof_static_results.json",
        help="JSON result path. Default: log/anti_spoof_static_results.json",
    )
    parser.add_argument(
        "--resize",
        default="480x640",
        help="Also test a resized variant, written as WIDTHxHEIGHT. Default: 480x640",
    )
    parser.add_argument(
        "--no-resize",
        action="store_true",
        help="Only test the original image size.",
    )
    parser.add_argument(
        "--no-write-json",
        action="store_true",
        help="Print results only; do not write JSON.",
    )
    return parser.parse_args()


def parse_resize(value: str) -> tuple[int, int]:
    try:
        width_text, height_text = value.lower().split("x", 1)
        width = int(width_text)
        height = int(height_text)
    except ValueError as exc:
        raise ValueError("--resize must use WIDTHxHEIGHT, for example 480x640") from exc

    if width <= 0 or height <= 0:
        raise ValueError("--resize dimensions must be positive")
    return width, height


def iter_images(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]

    if not input_path.exists():
        raise FileNotFoundError(f"Input path not found: {input_path}")

    images = sorted(
        path
        for path in input_path.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )
    if not images:
        raise FileNotFoundError(f"No supported image files found in: {input_path}")
    return images


def bbox_to_list(face: Any) -> list[float] | None:
    if face is None:
        return None
    return [float(value) for value in face.bbox[:4]]


def run_variant(
    detector: FaceDetector,
    anti_spoofing: AntiSpoofingService,
    image_path: Path,
    variant: str,
    image: Any,
) -> dict[str, Any]:
    detection = detector.detect_one(image)
    result: dict[str, Any] = {
        "image": str(image_path),
        "variant": variant,
        "image_shape": list(image.shape),
        "detect_status": detection.status,
        "detect_message": detection.message,
        "face_count": detection.face_count,
        "bbox": bbox_to_list(detection.face),
        "det_score": float(detection.face.det_score) if detection.face is not None else None,
    }

    if detection.face is None:
        return result

    anti = anti_spoofing.check_liveness(image, detection.face)
    result.update(
        {
            "anti_status": anti.status,
            "is_live": anti.is_live,
            "live_score": anti.live_score,
            "predicted_label": anti.predicted_label,
            "model_scores": anti.model_scores,
            "crop_boxes": anti.crop_boxes,
            "debug_crop_paths": anti.debug_crop_paths,
            "source_frame_path": anti.source_frame_path,
            "crop_stats": anti.crop_stats,
        }
    )
    return result


def run() -> list[dict[str, Any]]:
    args = parse_args()
    input_path = Path(args.input)
    resize_size = parse_resize(args.resize)

    config = load_config()
    runtime = resolve_runtime(config["runtime"])
    detector = FaceDetector(config["model"], runtime)
    anti_spoofing = AntiSpoofingService(config["model"], runtime)

    results: list[dict[str, Any]] = []
    for image_path in iter_images(input_path):
        image = cv2.imread(str(image_path))
        if image is None:
            results.append(
                {
                    "image": str(image_path),
                    "variant": "original",
                    "error": "OpenCV could not read this image",
                }
            )
            continue

        results.append(run_variant(detector, anti_spoofing, image_path, "original", image))

        if not args.no_resize:
            width, height = resize_size
            resized = cv2.resize(image, (width, height), interpolation=cv2.INTER_AREA)
            results.append(
                run_variant(
                    detector,
                    anti_spoofing,
                    image_path,
                    f"resized_{width}x{height}",
                    resized,
                )
            )

    if not args.no_write_json:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(results, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    return results


def print_summary(results: list[dict[str, Any]]) -> None:
    print("")
    print("Anti-spoofing static image results")
    print("-" * 110)
    header = f"{'image':36} {'variant':16} {'detect':18} {'anti':16} {'live%':>8} {'label':>6}"
    print(header)
    print("-" * 110)
    for item in results:
        image_name = Path(str(item.get("image", ""))).name[:36]
        variant = str(item.get("variant", ""))[:16]
        detect = str(item.get("detect_status", item.get("error", "")))[:18]
        anti = str(item.get("anti_status", "--"))[:16]
        live = item.get("live_score")
        live_text = "--" if live is None else f"{float(live) * 100:7.2f}"
        label = item.get("predicted_label")
        label_text = "--" if label is None else str(label)
        print(f"{image_name:36} {variant:16} {detect:18} {anti:16} {live_text:>8} {label_text:>6}")

    print("-" * 110)
    print("Full JSON details are written to log/anti_spoof_static_results.json by default.")


def main() -> None:
    print_summary(run())


if __name__ == "__main__":
    main()
