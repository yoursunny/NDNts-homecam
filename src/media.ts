export type Mode = "camera"|"screen";

let $video: HTMLVideoElement;
let $canvas: HTMLCanvasElement;
let stream: MediaStream;
let width: number;
let height: number;

export async function startCapture(mode: Mode, maxLength = 640) {
  $video = document.querySelector<HTMLVideoElement>("#p_video")!;
  $canvas = document.querySelector<HTMLCanvasElement>("#p_canvas")!;

  if (mode === "camera") {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  } else {
    stream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: {
        cursor: "always",
      },
      audio: false,
    });
  }

  $video.srcObject = stream;
  await new Promise((resolve) => $video.addEventListener("canplay", resolve));
  await $video.play();

  const { videoWidth, videoHeight } = $video;
  const length = Math.max(videoWidth, videoHeight);
  width = videoWidth / length * maxLength;
  height = videoHeight / length * maxLength;
  $video.width = width;
  $video.height = height;
  $canvas.width = width;
  $canvas.height = height;
}

export async function getImage(type = "image/jpeg", quality = 70): Promise<Blob> {
  $canvas.getContext("2d")!.drawImage($video, 0, 0, width, height);
  return new Promise<Blob>((resolve) => $canvas.toBlob((b) => resolve(b!), type, quality));
}
