export interface CaptureResult {
  stream: MediaStream;
  width: number;
  height: number;
  $video: HTMLVideoElement;
  $canvas: HTMLCanvasElement;
}

export async function startCapture(mode: "camera"|"screen"): Promise<CaptureResult> {
  let stream: MediaStream;
  if (mode === "screen") {
    stream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: {
        cursor: "always",
      },
      audio: false,
    });
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  }

  const $video = document.querySelector("#app_video") as HTMLVideoElement;
  $video.srcObject = stream;
  $video.classList.remove("hidden");
  await new Promise((resolve) => $video.addEventListener("canplay", resolve));
  await $video.play();

  let { videoWidth: width, videoHeight: height } = $video;
  const length = Math.max(width, height);
  width = width / length * 600;
  height = height / length * 600;
  $video.width = width;
  $video.height = height;

  const $canvas = document.querySelector("#app_canvas") as HTMLCanvasElement;
  $canvas.width = width;
  $canvas.height = height;
  return { stream, width, height, $video, $canvas };
}
