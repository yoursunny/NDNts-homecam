import { Endpoint } from "@ndn/endpoint";
import { SequenceNum, Version } from "@ndn/naming-convention2";
import type { Name, Signer } from "@ndn/packet";
import { serveMetadata } from "@ndn/rdr";
import { BlobChunkSource, serve, Server } from "@ndn/segmented-object";
import pEvent from "p-event";

import { getState } from "./connect";
import { HomecamMetadata } from "./metadata";

export type Mode = "camera" | "camera-mic" | "screen";

let $message: HTMLParagraphElement;
const endpoint = new Endpoint({ announcement: false });
let streamPrefix: Name;
let signer: Signer;
let versionPrefix: Name;
let currentVersion = 0;
let currentSequenceNum = 0;

let mimeType: string;
let stream: MediaStream;
let $video: HTMLVideoElement;
let recorder: MediaRecorder;

let initServer: Server | undefined;
const servers: Server[] = [];

export async function startProducer(mode: Mode) {
  $message = document.querySelector<HTMLParagraphElement>("#p_message")!;
  const { sysPrefix, myID, dataSigner } = getState();
  streamPrefix = sysPrefix.append(myID, "stream");
  signer = dataSigner;
  currentVersion = Date.now();
  currentSequenceNum = 0;
  versionPrefix = streamPrefix.append(Version, currentVersion);

  $message.textContent = "starting";
  await startCapture(mode);
  serveMetadata(() => {
    const m = new HomecamMetadata();
    m.name = versionPrefix.append(SequenceNum, currentSequenceNum);
    m.mimeType = mimeType;
    return m;
  }, { endpoint, signer, announcement: false, prefix: streamPrefix });

  document.querySelector("#p_id")!.textContent = myID;
  document.querySelector("#p_link")!.textContent = new URL(`#viewer=${myID}`, location.href).toString();
  document.querySelector("#p_section")!.classList.remove("hidden");
}

async function startCapture(mode: Mode) {
  const audio = mode === "camera-mic";
  if (mode === "screen") {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { // eslint-disable-line @typescript-eslint/consistent-type-assertions
        cursor: "always",
      } as MediaTrackConstraints,
      audio,
    });
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 640,
      },
      audio,
    });
  }

  $video = document.querySelector<HTMLVideoElement>("#p_video")!;
  $video.srcObject = stream;
  await pEvent($video, "canplay");
  await $video.play();

  mimeType = audio ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp8";
  recorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond: 16000,
    videoBitsPerSecond: 100000,
  });
  recorder.addEventListener("dataavailable", handleRecorderData);
  recorder.start(1000);

  $message.textContent = `${mimeType} video=${recorder.videoBitsPerSecond}bps audio=${recorder.audioBitsPerSecond}bps`;
}

function handleRecorderData(evt: BlobEvent) {
  $message.textContent = `clip=${currentVersion},${currentSequenceNum} size=${evt.data.size}`;
  const producer = serve(
    versionPrefix.append(SequenceNum, currentSequenceNum),
    new BlobChunkSource(evt.data, { chunkSize: 7500 }),
    { endpoint, signer, freshnessPeriod: 60000, announcement: false });

  if (!initServer) { // eslint-disable-line no-negated-condition
    initServer = producer;
  } else {
    servers.push(producer);
    while (servers.length > 20) {
      servers.shift()!.close();
    }
  }

  ++currentSequenceNum;
}
