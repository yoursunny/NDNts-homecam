import { Endpoint, type Producer as EndpointProducer } from "@ndn/endpoint";
import { SequenceNum, Version } from "@ndn/naming-convention2";
import type { Name, Signer } from "@ndn/packet";
import { serveMetadata } from "@ndn/rdr";
import { BlobChunkSource, serve, type Server as SegmentedServer } from "@ndn/segmented-object";
import { pEvent } from "p-event";

import { getState } from "./connect";
import { HomecamMetadata } from "./metadata";

export type Mode = "camera" | "camera-mic" | "screen";

const endpoint = new Endpoint({ announcement: false });
let signer: Signer;
let p: HomecamProducer;

export async function startProducer(mode: Mode) {
  const $message = document.querySelector<HTMLParagraphElement>("#p_message")!;
  const log = (s: string) => {
    console.log(s);
    $message.textContent = s;
  };
  const { sysPrefix, myID, dataSigner } = getState();
  signer = dataSigner;
  const prefix = sysPrefix.append(myID, "stream", Version.create(Date.now()));

  log("starting");
  const { stream, mimeType } = await startStream(mode);

  p = new HomecamProducer(
    log,
    prefix,
    stream,
    {
      mimeType,
      audioBitsPerSecond: 16000,
      videoBitsPerSecond: 100000,
    },
    1000,
  );
  void p;

  document.querySelector("#p_id")!.textContent = myID;
  document.querySelector("#p_link")!.textContent = new URL(`#viewer=${myID}`, location.href).toString();
  document.querySelector("#p_section")!.classList.remove("hidden");
}

async function startStream(mode: Mode): Promise<{ stream: MediaStream; mimeType: string }> {
  const audio = mode === "camera-mic";
  let stream: MediaStream;
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

  const $video = document.querySelector<HTMLVideoElement>("#p_video")!;
  $video.srcObject = stream;
  await pEvent($video, "canplay");
  await $video.play();

  const mimeType = audio ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp8";
  return { stream, mimeType };
}

class HomecamProducer {
  constructor(
      private readonly log: (s: string) => void,
      private readonly prefix: Name,
      stream: MediaStream,
      private readonly recordOpts: MediaRecorderOptions,
      private readonly timeSlice: number,
  ) {
    this.version = prefix.at(-1).as(Version);
    this.recorder = new MediaRecorder(stream, recordOpts);
    this.recorder.addEventListener("dataavailable", this.handleRecord);
    this.recorder.start(timeSlice);
    this.metadataP = serveMetadata(this.makeMetadata, { endpoint, announcement: false });
    log(`${recordOpts.mimeType} video=${this.recorder.videoBitsPerSecond}bps audio=${this.recorder.audioBitsPerSecond}bps`);
  }

  public close(): void {
    this.metadataP.close();
    this.initClipP?.close();
    this.evictClipsP(0);
  }

  private readonly version: number;
  private seqNum = 0;
  private readonly recorder: MediaRecorder;
  private readonly metadataP: EndpointProducer;
  private initClipP?: SegmentedServer;
  private readonly clipsP: SegmentedServer[] = [];

  private readonly makeMetadata = (): HomecamMetadata => {
    const m = new HomecamMetadata();
    m.name = this.prefix;
    m.mimeType = this.recordOpts.mimeType!;
    m.timeSlice = this.timeSlice;
    m.seqNum = this.seqNum;
    return m;
  };

  private readonly handleRecord = (evt: BlobEvent): void => {
    this.log(`clip=${this.version},${this.seqNum} size=${evt.data.size}`);
    const clipP = serve(
      this.prefix.append(SequenceNum, this.seqNum),
      new BlobChunkSource(evt.data, { chunkSize: 7500 }),
      { endpoint, signer, freshnessPeriod: 60000, announcement: false });

    if (this.seqNum === 0) {
      this.initClipP = clipP;
    } else {
      this.clipsP.push(clipP);
      this.evictClipsP(60000 / this.timeSlice);
    }

    ++this.seqNum;
  };

  private evictClipsP(limit: number): void {
    while (this.clipsP.length > limit) {
      this.clipsP.shift()!.close();
    }
  }
}
