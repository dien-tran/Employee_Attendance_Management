export const CAMERA_FRAME_WIDTH = 640
export const CAMERA_FRAME_HEIGHT = 480
export const CAMERA_FRAME_ASPECT_RATIO = CAMERA_FRAME_WIDTH / CAMERA_FRAME_HEIGHT
export const CAMERA_FRAME_JPEG_QUALITY = 0.95

export type FaceBoundingBox = [number, number, number, number]

export interface FaceBoundingRect {
  x: number
  y: number
  width: number
  height: number
}

export function drawVideoCoverFrame(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
) {
  if (!video || !canvas || video.readyState < 2) {
    return false
  }

  const sourceWidth = video.videoWidth || CAMERA_FRAME_WIDTH
  const sourceHeight = video.videoHeight || CAMERA_FRAME_HEIGHT

  canvas.width = CAMERA_FRAME_WIDTH
  canvas.height = CAMERA_FRAME_HEIGHT

  const context = canvas.getContext("2d")
  if (!context) {
    return false
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"

  const sourceAspectRatio = sourceWidth / sourceHeight
  let cropX = 0
  let cropY = 0
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight

  if (sourceAspectRatio > CAMERA_FRAME_ASPECT_RATIO) {
    cropWidth = sourceHeight * CAMERA_FRAME_ASPECT_RATIO
    cropX = (sourceWidth - cropWidth) / 2
  } else {
    cropHeight = sourceWidth / CAMERA_FRAME_ASPECT_RATIO
    cropY = (sourceHeight - cropHeight) / 2
  }

  context.fillStyle = "#000000"
  context.fillRect(0, 0, CAMERA_FRAME_WIDTH, CAMERA_FRAME_HEIGHT)
  context.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    CAMERA_FRAME_WIDTH,
    CAMERA_FRAME_HEIGHT,
  )

  return true
}

export function canvasToJpegDataUrl(canvas: HTMLCanvasElement | null) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return null
  }

  return canvas.toDataURL("image/jpeg", CAMERA_FRAME_JPEG_QUALITY)
}

export function normalizeFaceBoundingBox(value: unknown): FaceBoundingBox | null {
  if (!Array.isArray(value) || value.length < 4) {
    return null
  }

  const box = value.slice(0, 4).map((coordinate) => Number(coordinate))
  if (box.some((coordinate) => !Number.isFinite(coordinate))) {
    return null
  }

  return box as FaceBoundingBox
}

export function faceBoundingBoxToRect(box: FaceBoundingBox | null): FaceBoundingRect | null {
  if (!box) {
    return null
  }

  const [x1, y1, x2, y2] = box
  const x = Math.max(0, Math.min(x1, x2))
  const y = Math.max(0, Math.min(y1, y2))
  const right = Math.min(CAMERA_FRAME_WIDTH, Math.max(x1, x2))
  const bottom = Math.min(CAMERA_FRAME_HEIGHT, Math.max(y1, y2))

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  }
}

export function createFaceWebSocketUrl(path: string) {
  if (typeof window === "undefined") {
    return path
  }

  const configuredBase = process.env.NEXT_PUBLIC_FACE_WS_BASE_URL
  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, "")}${path}`
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}${path}`
}
