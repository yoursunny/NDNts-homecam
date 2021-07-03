import "./media-api";

import { Endpoint } from "@ndn/endpoint";
import { Version } from "@ndn/naming-convention2";
import type { Name, Signer } from "@ndn/packet";
import { serveMetadata } from "@ndn/rdr";
import { BlobChunkSource, serve, Server } from "@ndn/segmented-object";
import pEvent from "p-event";

import { getState } from "./connect";
import { HomecamMetadata } from "./metadata";

export type Mode = "camera" | "camera-mic" | "screen";

const endpoint = new Endpoint({ announcement: false });
let streamPrefix: Name;
let signer: Signer;

let stream: MediaStream;
let $video: HTMLVideoElement;
let recorder: MediaRecorder;

let initVersion = 0;
let initServer: Server | undefined;
let lastVersion = 0;
const servers: Server[] = [];

export async function startProducer(mode: Mode) {
  const { sysPrefix, myID, dataSigner } = getState();
  streamPrefix = sysPrefix.append(myID, "stream");
  signer = dataSigner;

  await startCapture(mode);
  serveMetadata(() => {
    const m = new HomecamMetadata(streamPrefix.append(Version, lastVersion));
    m.initVersion = initVersion;
    return m;
  }, { endpoint, signer, announcement: false, prefix: streamPrefix });

  document.querySelector("#p_id")!.textContent = myID;
  document.querySelector("#p_link")!.textContent = new URL(`#viewer=${myID}`, location.href).toString();
  document.querySelector("#p_section")!.classList.remove("hidden");
}

async function startCapture(mode: Mode) {
  if (mode === "screen") {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always",
      },
      audio: false,
    });
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 640,
      },
      audio: mode === "camera-mic",
    });
  }

  $video = document.querySelector<HTMLVideoElement>("#p_video")!;
  $video.srcObject = stream;
  await pEvent($video, "canplay");
  await $video.play();

  recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp8,opus",
    audioBitsPerSecond: 16000,
    videoBitsPerSecond: 100000,
  });
  recorder.addEventListener("dataavailable", handleRecorderData);
  recorder.start(1000);
}

function handleRecorderData(evt: BlobEvent) {
  const version = Math.floor(Date.now() / 1000);
  const producer = serve(streamPrefix.append(Version, version), new BlobChunkSource(evt.data, { chunkSize: 7500 }), {
    endpoint,
    signer,
    freshnessPeriod: 60000,
    announcement: false,
  });

  if (!initServer) { // eslint-disable-line no-negated-condition
    initServer = producer;
    initVersion = version;
  } else {
    servers.push(producer);
    while (servers.length > 20) {
      servers.shift()!.close();
    }
  }
  lastVersion = version;
}
