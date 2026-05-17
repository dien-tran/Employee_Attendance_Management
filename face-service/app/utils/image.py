import base64
import binascii

import cv2
import numpy as np


def decode_base64_image(data: str) -> np.ndarray:
    """Decode a base64 image or data URL into an OpenCV BGR image."""
    if not isinstance(data, str) or not data.strip():
        raise ValueError("Image data must be a non-empty base64 string")

    payload = data.strip()
    if "," in payload:
        payload = payload.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 image data") from exc

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Decoded data is not a valid image")

    return image
