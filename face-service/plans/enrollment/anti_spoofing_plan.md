# Triển Khai Anti-Spoofing

## Summary
Thêm bước anti-spoofing sau `FaceDetector.detect_one(...)`: nhận ảnh BGR đã decode và `DetectedFace.bbox`, crop vùng mặt, chạy MiniFASNet trên các weights trong `models/anti_spoof/`, rồi trả `OK` hoặc `SPOOF_DETECTED` theo `anti_spoof_threshold`.

## Key Changes
- Thêm service anti-spoofing:
  - Tạo `app/services/anti_spoofing.py`.
  - Interface chính: `AntiSpoofingService(model_config, runtime_config).check_liveness(image, face)`.
  - Input: `image: np.ndarray` BGR và `face: DetectedFace` từ detection.
  - Output dataclass `AntiSpoofResult` gồm `status`, `is_live`, `live_score`, `predicted_label`, `model_scores`, `message`.

- Thêm MiniFASNet runtime tối thiểu:
  - Tạo module nội bộ cho kiến trúc MiniFASNet tương thích với weights `.pth` hiện có.
  - Hỗ trợ model types lấy từ filename: `MiniFASNetV2`, `MiniFASNetV1SE`.
  - Load toàn bộ `.pth` trong `models/anti_spoof/`, sort ổn định theo tên file.
  - Dùng `RuntimeConfig.torch_device`: CPU mặc định, GPU khi `runtime.device: "gpu"`.

- Luồng inference:
  - Convert `DetectedFace.bbox` từ `[x1, y1, x2, y2]` sang `[x, y, w, h]`.
  - Parse filename như `2.7_80x80_MiniFASNetV2.pth` để lấy `scale`, `input_size`, `model_type`.
  - Crop vùng mặt theo `scale`, clamp trong biên ảnh, resize về `80x80`.
  - Convert crop BGR `uint8` sang tensor `float32` shape `1x3xHxW`, range `0..1`.
  - Chạy từng model, softmax, cộng/average prediction.
  - Theo upstream Silent-Face-Anti-Spoofing, label `1` là real/live; `live_score = avg_prediction[1]`.
  - Pass nếu `predicted_label == 1` và `live_score >= config["model"]["anti_spoof_threshold"]`; ngược lại trả `SPOOF_DETECTED`.

## Test Plan
- Compile:
  - `python -m py_compile app\services\anti_spoofing.py`
  - compile thêm module MiniFASNet nếu tách file riêng.
- Load weights:
  - Khởi tạo service bằng `load_config()`.
  - Xác nhận load được `2.7_80x80_MiniFASNetV2.pth` và `4_0_0_80x80_MiniFASNetV1SE.pth`.
- Smoke test:
  - Tạo ảnh BGR giả và `DetectedFace` bbox hợp lệ, gọi `check_liveness(...)`, đảm bảo trả `AntiSpoofResult` không crash.
  - Test bbox sát biên ảnh để crop không vượt index.
  - Test thiếu model dir hoặc không có `.pth` phải raise lỗi rõ ràng.
- Không nối pipeline/WebSocket trong bước này; chỉ làm service anti-spoofing độc lập.

## Assumptions
- Dùng weights hiện có trong `models/anti_spoof/`.
- Giữ `anti_spoof_threshold: 0.7` trong `config.yaml`.
- Không dùng detector Caffe của repo Silent-Face-Anti-Spoofing vì project đã có bbox từ InsightFace.
- Tham chiếu upstream: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing, đặc biệt `anti_spoof_predict.py`, `generate_patches.py`, `utility.py`, và `MiniFASNet.py`.
