'use client';

import { useEffect, useRef, useState } from 'react';

type EnrollmentResponse = {
  status: 'GOOD_FRAME' | 'REJECTED' | 'ENROLLMENT_COMPLETE' | 'ERROR';
  accepted_count?: number;
  required_count?: number;
  anti_spoof_score?: number;
  face_bbox?: [number, number, number, number];
  anti_spoof_predicted_label?: number;
  anti_spoof_model_scores?: Record<string, number[]>;
  anti_spoof_crop_boxes?: Record<string, number[]>;
  anti_spoof_debug_crop_paths?: Record<string, string>;
  anti_spoof_source_frame_path?: string;
  anti_spoof_image_shape?: number[];
  anti_spoof_crop_stats?: Record<string, CropStats>;
  reason?: string;
  message: string;
  details?: {
    face_bbox?: [number, number, number, number];
    live_score?: number;
    predicted_label?: number;
    model_scores?: Record<string, number[]>;
    crop_boxes?: Record<string, number[]>;
    debug_crop_paths?: Record<string, string>;
    source_frame_path?: string;
    image_shape?: number[];
    crop_stats?: Record<string, CropStats>;
    [key: string]: unknown;
  };
  data?: {
    embedding_id: string;
    employee_id: string;
    full_name: string;
    date_of_birth: string;
    num_frames_used: number;
    anti_spoof_score_avg: number;
    quality_score_avg: number;
  };
};

type CropStats = {
  shape?: number[];
  color_space?: string;
  bgr_mean?: number[];
  bgr_min?: number[];
  bgr_max?: number[];
};

// Gửi frame quá nhanh trong lúc backend chạy AI CPU có thể làm preview/capture
// bị giật, mờ và kéo anti-spoofing score xuống. 600ms vẫn đủ realtime để user
// chỉnh mặt, nhưng nhẹ hơn nhiều so với 300ms.
const FRAME_INTERVAL_MS = 600;
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const CAPTURE_ASPECT_RATIO = CAPTURE_WIDTH / CAPTURE_HEIGHT;

function enrollmentWsUrl() {
  // Có thể override bằng env nếu backend chạy host/port khác:
  // NEXT_PUBLIC_ENROLLMENT_WS_URL=ws://127.0.0.1:8000/api/v1/enroll/ws
  return (
    process.env.NEXT_PUBLIC_ENROLLMENT_WS_URL ??
    'ws://127.0.0.1:8000/api/v1/enroll/ws'
  );
}

export default function Home() {
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [status, setStatus] = useState('');
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [requiredCount, setRequiredCount] = useState(10);
  const [lastReason, setLastReason] = useState('');
  const [antiSpoofScore, setAntiSpoofScore] = useState<number | null>(null);
  const [antiSpoofScoreAvg, setAntiSpoofScoreAvg] = useState<number | null>(null);
  const [antiSpoofPredictedLabel, setAntiSpoofPredictedLabel] = useState<number | null>(null);
  const [antiSpoofModelScores, setAntiSpoofModelScores] = useState<Record<string, number[]> | null>(
    null,
  );
  const [antiSpoofCropBoxes, setAntiSpoofCropBoxes] = useState<Record<string, number[]> | null>(
    null,
  );
  const [antiSpoofDebugCropPaths, setAntiSpoofDebugCropPaths] = useState<Record<
    string,
    string
  > | null>(null);
  const [antiSpoofCropStats, setAntiSpoofCropStats] = useState<Record<string, CropStats> | null>(
    null,
  );
  const [antiSpoofSourceFramePath, setAntiSpoofSourceFramePath] = useState<string | null>(null);
  const [antiSpoofImageShape, setAntiSpoofImageShape] = useState<number[] | null>(null);
  const [faceBox, setFaceBox] = useState<[number, number, number, number] | null>(null);
  const [videoSize, setVideoSize] = useState({ width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT });
  const [embeddingId, setEmbeddingId] = useState('');
  const [lastBackendResponse, setLastBackendResponse] = useState<EnrollmentResponse | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  function drawVideoToCanvas() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // readyState >= 2 nghĩa là video đã có frame hiện tại để drawImage.
    if (!video || !canvas || video.readyState < 2) {
      return false;
    }

    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;

    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }

    // Preview và frame gửi backend dùng cùng một canvas. Cover-center giúp
    // khung luôn đầy, nằm giữa và tránh dải trống khi webcam trả stream 16:9.
    const sourceAspectRatio = sourceWidth / sourceHeight;
    let cropX = 0;
    let cropY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceAspectRatio > CAPTURE_ASPECT_RATIO) {
      cropWidth = sourceHeight * CAPTURE_ASPECT_RATIO;
      cropX = (sourceWidth - cropWidth) / 2;
    } else {
      cropHeight = sourceWidth / CAPTURE_ASPECT_RATIO;
      cropY = (sourceHeight - cropHeight) / 2;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);

    // CSS đang mirror video để người dùng dễ căn mặt, nhưng canvas lấy frame gốc.
    // Backend không cần ảnh mirror; chỉ cần ảnh JPEG base64 đúng format.
    context.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      CAPTURE_WIDTH,
      CAPTURE_HEIGHT,
    );

    return true;
  }

  useEffect(() => {
    if (isCameraOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraOpen, stream]);

  useEffect(() => {
    if (!isCameraOpen || !stream) {
      return;
    }

    const renderPreview = () => {
      drawVideoToCanvas();
      previewFrameRef.current = window.requestAnimationFrame(renderPreview);
    };

    previewFrameRef.current = window.requestAnimationFrame(renderPreview);

    return () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current);
        previewFrameRef.current = null;
      }
    };
  }, [isCameraOpen, stream]);

  useEffect(() => {
    // Cleanup khi user rời trang: dừng interval, đóng socket, tắt camera.
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current);
        previewFrameRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  };

  const openCamera = async () => {
    if (!employeeId.trim() || !fullName.trim() || !dateOfBirth) {
      alert('Vui lòng điền đủ ID nhân viên, Họ tên và Ngày sinh!');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          // Webcam laptop thường là landscape. Dùng 4:3 để frame nằm giữa,
          // ít padding hơn 3:4 và vẫn đủ gần cho enrollment/check-in.
          width: { ideal: CAPTURE_WIDTH },
          height: { ideal: CAPTURE_HEIGHT },
          aspectRatio: { ideal: CAPTURE_ASPECT_RATIO },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraOpen(true);
      setStatus('Camera đang mở. Sẵn sàng thu thập khuôn mặt.');
      setLastReason('');
      setAntiSpoofScore(null);
      setAntiSpoofScoreAvg(null);
      setAntiSpoofPredictedLabel(null);
      setAntiSpoofModelScores(null);
      setAntiSpoofCropBoxes(null);
      setAntiSpoofDebugCropPaths(null);
      setAntiSpoofCropStats(null);
      setAntiSpoofSourceFramePath(null);
      setAntiSpoofImageShape(null);
      setFaceBox(null);
      setEmbeddingId('');
      setLastBackendResponse(null);
    } catch (error) {
      console.error('Lỗi khi mở camera:', error);
      setStatus('Không thể mở camera. Vui lòng cấp quyền truy cập.');
    }
  };

  const closeCamera = () => {
    stopEnrollment();
    stopCameraStream();
    setFaceBox(null);
    setIsCameraOpen(false);
    setStatus('Đã đóng camera.');
  };

  const stopEnrollment = () => {
    // Dừng timer gửi frame trước, sau đó đóng socket nếu còn mở.
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsCollecting(false);
  };

  const captureFrameAsBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawVideoToCanvas()) {
      return null;
    }

    // JPEG quality cao hơn giúp MiniFASNet thấy rõ texture mặt hơn. Anti-spoofing
    // nhạy với nhiễu nén, nên không nên nén quá mạnh.
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const sendFrame = (socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const image = captureFrameAsBase64();
    if (!image) {
      setStatus('Video chưa sẵn sàng, đang chờ frame camera...');
      return;
    }

    // Payload này khớp với EnrollmentCaptureMessage ở backend.
    socket.send(
      JSON.stringify({
        action: 'capture',
        employee_id: employeeId.trim(),
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        image,
      }),
    );
  };

  const handleEnrollmentResponse = (response: EnrollmentResponse) => {
    // Giữ lại response cuối cùng để UI debug hiển thị rõ backend đã trả field gì.
    // Ví dụ khi anti-spoofing vẫn thấp, ta cần xem details.model_scores,
    // details.crop_boxes và details.debug_crop_paths có xuất hiện hay không.
    setLastBackendResponse(response);
    console.debug('Enrollment WebSocket response:', response);

    if (typeof response.accepted_count === 'number') {
      setAcceptedCount(response.accepted_count);
    }
    if (typeof response.required_count === 'number') {
      setRequiredCount(response.required_count);
    }

    setStatus(response.message);
    setLastReason(response.reason ?? '');

    // GOOD_FRAME trả anti_spoof_score trực tiếp. Nếu frame bị reject do spoof,
    // backend đặt live_score trong details để UI vẫn hiển thị score vừa đo.
    if (typeof response.anti_spoof_score === 'number') {
      setAntiSpoofScore(response.anti_spoof_score);
    } else if (typeof response.details?.live_score === 'number') {
      setAntiSpoofScore(response.details.live_score);
    }

    if (typeof response.anti_spoof_predicted_label === 'number') {
      setAntiSpoofPredictedLabel(response.anti_spoof_predicted_label);
    } else if (typeof response.details?.predicted_label === 'number') {
      setAntiSpoofPredictedLabel(response.details.predicted_label);
    }

    const nextModelScores = response.anti_spoof_model_scores ?? response.details?.model_scores;
    if (nextModelScores) {
      setAntiSpoofModelScores(nextModelScores);
    }

    const nextCropBoxes = response.anti_spoof_crop_boxes ?? response.details?.crop_boxes;
    if (nextCropBoxes) {
      setAntiSpoofCropBoxes(nextCropBoxes);
    }

    const nextDebugCropPaths =
      response.anti_spoof_debug_crop_paths ?? response.details?.debug_crop_paths;
    if (nextDebugCropPaths) {
      setAntiSpoofDebugCropPaths(nextDebugCropPaths);
    }

    const nextCropStats = response.anti_spoof_crop_stats ?? response.details?.crop_stats;
    if (nextCropStats) {
      setAntiSpoofCropStats(nextCropStats);
    }

    const nextSourceFramePath =
      response.anti_spoof_source_frame_path ?? response.details?.source_frame_path;
    if (nextSourceFramePath) {
      setAntiSpoofSourceFramePath(nextSourceFramePath);
    }

    const nextImageShape = response.anti_spoof_image_shape ?? response.details?.image_shape;
    if (nextImageShape) {
      setAntiSpoofImageShape(nextImageShape);
    }

    const nextFaceBox = response.face_bbox ?? response.details?.face_bbox;
    if (nextFaceBox) {
      setFaceBox(nextFaceBox);
    } else if (response.reason === 'NO_FACE' || response.reason === 'MULTIPLE_FACES') {
      setFaceBox(null);
    }

    if (response.status === 'ENROLLMENT_COMPLETE') {
      setEmbeddingId(response.data?.embedding_id ?? '');
      setAntiSpoofScoreAvg(response.data?.anti_spoof_score_avg ?? null);
      stopEnrollment();
      return;
    }

    if (response.status === 'ERROR') {
      stopEnrollment();
    }
  };

  const startEnrollment = () => {
    if (!videoRef.current || !stream) {
      setStatus('Camera chưa sẵn sàng.');
      return;
    }

    stopEnrollment();
    setAcceptedCount(0);
    setRequiredCount(10);
    setLastReason('');
    setAntiSpoofScore(null);
    setAntiSpoofScoreAvg(null);
    setAntiSpoofPredictedLabel(null);
    setAntiSpoofModelScores(null);
    setAntiSpoofCropBoxes(null);
    setAntiSpoofDebugCropPaths(null);
    setAntiSpoofCropStats(null);
    setAntiSpoofSourceFramePath(null);
    setAntiSpoofImageShape(null);
    setFaceBox(null);
    setEmbeddingId('');
    setLastBackendResponse(null);
    setStatus('Đang kết nối backend enrollment...');

    const socket = new WebSocket(enrollmentWsUrl());
    wsRef.current = socket;

    socket.onopen = () => {
      setIsCollecting(true);
      setStatus('Đang thu thập frame...');

      // Gửi frame đầu tiên ngay, sau đó gửi mỗi 300ms theo plan.
      sendFrame(socket);
      intervalRef.current = window.setInterval(() => {
        sendFrame(socket);
      }, FRAME_INTERVAL_MS);  
    };

    socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data) as EnrollmentResponse;
        handleEnrollmentResponse(response);
      } catch (error) {
        console.error('Không parse được response WebSocket:', error);
        setStatus('Backend trả response không hợp lệ.');
        stopEnrollment();
      }
    };

    socket.onerror = () => {
      setStatus('Không thể kết nối WebSocket backend.');
      stopEnrollment();
    };

    socket.onclose = () => {
      setIsCollecting(false);
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  };

  const progressPercent =
    requiredCount > 0 ? Math.min(100, Math.round((acceptedCount / requiredCount) * 100)) : 0;
  const antiSpoofPercent =
    antiSpoofScore === null ? null : Math.max(0, Math.min(100, antiSpoofScore * 100));
  const antiSpoofAvgPercent =
    antiSpoofScoreAvg === null ? null : Math.max(0, Math.min(100, antiSpoofScoreAvg * 100));
  const faceBoxRect =
    faceBox === null
      ? null
      : {
        x: faceBox[0],
        y: faceBox[1],
        width: Math.max(0, faceBox[2] - faceBox[0]),
        height: Math.max(0, faceBox[3] - faceBox[1]),
      };
  const antiSpoofDebugRows = antiSpoofModelScores
    ? Object.entries(antiSpoofModelScores).map(([modelName, scores]) => ({
      modelName,
      fake0: scores[0] ?? 0,
      live1: scores[1] ?? 0,
      fake2: scores[2] ?? 0,
      cropBox: antiSpoofCropBoxes?.[modelName],
      debugCropPath: antiSpoofDebugCropPaths?.[modelName],
      cropStats: antiSpoofCropStats?.[modelName],
    }))
    : [];

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">Đăng Ký Khuôn Mặt</h1>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                ID Nhân Viên
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={isCameraOpen}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-zinc-100"
                placeholder="VD: NV001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Họ Tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={isCameraOpen}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-zinc-100"
                placeholder="VD: Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Ngày Sinh
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                disabled={isCameraOpen}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-zinc-100"
              />
            </div>

            {!isCameraOpen ? (
              <button
                onClick={openCamera}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Mở Camera
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={startEnrollment}
                  disabled={isCollecting}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-zinc-400"
                >
                  Bắt Đầu
                </button>
                <button
                  onClick={closeCamera}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Đóng Camera
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-[720px] overflow-hidden rounded-md bg-black">
            {isCameraOpen ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(event) => {
                    // Overlay bbox dùng hệ tọa độ của canvas gửi backend,
                    // không dùng raw videoWidth/videoHeight của webcam.
                    void event;
                    setVideoSize({
                      width: CAPTURE_WIDTH,
                      height: CAPTURE_HEIGHT,
                    });
                  }}
                  className="hidden"
                />
                <canvas
                  ref={canvasRef}
                  className="h-full w-full scale-x-[-1]"
                />
                {faceBoxRect && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
                    viewBox={`0 0 ${videoSize.width} ${videoSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <rect
                      x={faceBoxRect.x}
                      y={faceBoxRect.y}
                      width={faceBoxRect.width}
                      height={faceBoxRect.height}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={faceBoxRect.x}
                      y={Math.max(18, faceBoxRect.y - 8)}
                      fill="#22c55e"
                      fontSize="16"
                      fontWeight="700"
                      vectorEffect="non-scaling-stroke"
                    >
                      Face
                    </text>
                  </svg>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Camera chưa mở
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Frame đạt</span>
              <span>
                {acceptedCount}/{requiredCount}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Liveness score</span>
              <span>
                {antiSpoofPercent === null ? '--' : `${antiSpoofPercent.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${antiSpoofPercent ?? 0}%` }}
              />
            </div>
            {antiSpoofAvgPercent !== null && (
              <div className="mt-2 text-xs text-zinc-500">
                Trung bình phiên: {antiSpoofAvgPercent.toFixed(1)}%
              </div>
            )}
            {antiSpoofPercent !== null && antiSpoofPercent < 50 && (
              <div className="mt-2 text-xs text-red-600">
                Score thấp: hãy tăng ánh sáng, nhìn thẳng camera và lùi ra xa hơn.
              </div>
            )}
            {antiSpoofDebugRows.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
                {antiSpoofPredictedLabel !== null && (
                  <div>Predicted label: {antiSpoofPredictedLabel} (label 1 = live)</div>
                )}
                {antiSpoofDebugRows.map((row) => (
                  <div key={row.modelName} className="space-y-0.5">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <span className="truncate">{row.modelName}</span>
                      <span>
                        live {(row.live1 * 100).toFixed(1)}% | fake0{' '}
                        {(row.fake0 * 100).toFixed(1)}% | fake2 {(row.fake2 * 100).toFixed(1)}%
                      </span>
                    </div>
                    {row.cropBox && (
                      <div className="truncate text-zinc-500">crop box: [{row.cropBox.join(', ')}]</div>
                    )}
                    {row.debugCropPath && (
                      <div className="truncate text-zinc-500">debug crop: {row.debugCropPath}</div>
                    )}
                    {row.cropStats?.bgr_mean && (
                      <div className="truncate text-zinc-500">
                        mean BGR: [{row.cropStats.bgr_mean.map((value) => value.toFixed(1)).join(', ')}]
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {lastBackendResponse && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-zinc-800">
              <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
                <span>Backend debug</span>
                <span className="rounded bg-white px-2 py-0.5 text-xs">
                  {lastBackendResponse.status}
                </span>
              </div>
              <div>Reason: {lastBackendResponse.reason ?? '--'}</div>
              <div>Predicted label: {antiSpoofPredictedLabel ?? '--'} (label 1 = live)</div>
              <div>Face bbox: {faceBox ? `[${faceBox.map((value) => value.toFixed(1)).join(', ')}]` : '--'}</div>
              {antiSpoofDebugRows.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {antiSpoofDebugRows.map((row) => (
                    <div key={`debug-${row.modelName}`} className="rounded bg-white p-2">
                      <div className="font-medium">{row.modelName}</div>
                      <div>
                        live {(row.live1 * 100).toFixed(1)}% | fake0{' '}
                        {(row.fake0 * 100).toFixed(1)}% | fake2 {(row.fake2 * 100).toFixed(1)}%
                      </div>
                      <div>crop: {row.cropBox ? `[${row.cropBox.join(', ')}]` : '--'}</div>
                      {row.cropStats?.bgr_mean && (
                        <div>
                          mean BGR: [{row.cropStats.bgr_mean.map((value) => value.toFixed(1)).join(', ')}]
                        </div>
                      )}
                      {row.debugCropPath && <div className="truncate">file: {row.debugCropPath}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded bg-white p-2 text-red-700">
                  Chưa nhận được model_scores từ backend. Hãy reload frontend và kiểm tra backend đã
                  restart bằng image mới.
                </div>
              )}
              <div className="mt-2 rounded bg-white p-2">
                <div>
                  source shape: {antiSpoofImageShape ? `[${antiSpoofImageShape.join(', ')}]` : '--'}
                </div>
                <div className="truncate">source frame: {antiSpoofSourceFramePath ?? '--'}</div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Raw response</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-[11px]">
                  {JSON.stringify(lastBackendResponse, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {status && (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <div>{status}</div>
              {lastReason && <div className="mt-1 font-medium">Lý do: {lastReason}</div>}
              {embeddingId && (
                <div className="mt-1 break-all font-mono text-xs">Embedding ID: {embeddingId}</div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
