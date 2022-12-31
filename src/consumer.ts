import { Endpoint } from "@ndn/endpoint";
import { SequenceNum, Version } from "@ndn/naming-convention2";
import type { Name } from "@ndn/packet";
import { retrieveMetadata } from "@ndn/rdr";
import { fetch, RttEstimator } from "@ndn/segmented-object";
import { pEvent } from "p-event";

import { getState } from "./connect";
import { HomecamMetadata } from "./metadata";

const endpoint = new Endpoint({ retx: 1 });
const rtte = new RttEstimator({ maxRto: 1000 });
let c: HomecamConsumer;

export async function startConsumer(id: string) {
  const $message = document.querySelector<HTMLParagraphElement>("#c_message")!;
  const log = (s: string) => {
    console.log(s);
    $message.textContent = s;
  };
  const { sysPrefix } = getState();
  const prefix = sysPrefix.append(id, "stream");
  const $video = document.querySelector<HTMLVideoElement>("#c_video")!;

  log("starting");
  c = new HomecamConsumer(
    log,
    prefix,
    $video,
  );
  void c;

  document.querySelector("#c_id")!.textContent = id;
  document.querySelector("#c_section")!.classList.remove("hidden");
}

class HomecamConsumer {
  constructor(
      private readonly log: (s: string) => void,
      private readonly prefix: Name,
      private readonly $video: HTMLVideoElement,
  ) {
    this.timer = setTimeout(this.loop, 100);
  }

  public close(): void {
    clearTimeout(this.timer);
    this.abort.abort();
  }

  private timer: NodeJS.Timeout;
  private needRestart = true;
  private abort = new AbortController();
  private metadata?: HomecamMetadata;
  private metadataTime = 0;
  private version = 0;
  private seqNum = 0;

  private source?: MediaSource;
  private buffer?: SourceBuffer;
  private nextAppend = 0;

  private estimatedFinalSegNum = 2;
  private nErrors = 0;
  private clips = new Map<number, Uint8Array | boolean>();

  private readonly loop = async () => {
    try {
      if (this.needRestart) {
        await this.restart();
        return;
      }

      this.fetchClips();
      await this.appendClips();
    } catch (err: unknown) {
      this.log(`error: ${err}`);
    } finally {
      this.timer = setTimeout(this.loop, 100);
    }
  };

  private async restart() {
    this.abort.abort();
    this.abort = new AbortController();

    this.log("connecting to stream source");
    this.metadata = await retrieveMetadata(this.prefix, HomecamMetadata, { endpoint, signal: this.abort.signal });
    this.metadataTime = Date.now();
    this.version = this.metadata.name.at(-1).as(Version);
    this.seqNum = Math.max(this.metadata.seqNum, 1);
    this.log(`connected mimeType=${this.metadata.mimeType} version=${this.version} timeSlice=${this.metadata.timeSlice} seqNum=${this.seqNum}`);

    this.source = new MediaSource();
    this.source.addEventListener("sourceclose", this.handleSourceClose);
    const url = URL.createObjectURL(this.source);
    try {
      this.$video.pause();
      this.$video.src = url;
      await pEvent(this.source, "sourceopen");
    } finally {
      URL.revokeObjectURL(url);
    }

    this.buffer = this.source.addSourceBuffer(this.metadata.mimeType);
    this.buffer.addEventListener("error", this.handleBufferError);
    this.clips.clear();
    this.nextAppend = 0;
    void this.fetchClip(0, 6);

    this.needRestart = false;
  }

  private readonly handleBufferError = () => {
    if (this.needRestart) {
      return;
    }
    this.log(`SourceBuffer error ${this.$video.error?.message}, restarting`);
    this.needRestart = true;
  };

  private readonly handleSourceClose = () => {
    if (this.needRestart) {
      return;
    }
    this.log("MediaSource closed, restarting");
    this.needRestart = true;
  };

  private fetchClips() {
    const pSeqNum = this.metadata!.seqNum + Math.floor((Date.now() - this.metadataTime) / this.metadata!.timeSlice);
    for (; this.seqNum <= pSeqNum; ++this.seqNum) {
      this.clips.set(this.seqNum, true);
      void this.fetchClip(this.seqNum);
    }
  }

  private async fetchClip(seqNum: number, retxLimit = 3) {
    try {
      const f = fetch(
        this.metadata!.name.append(SequenceNum, seqNum),
        {
          endpoint,
          rtte,
          estimatedFinalSegNum: this.estimatedFinalSegNum,
          retxLimit,
          signal: this.abort.signal,
        });
      const payload = await f;
      this.estimatedFinalSegNum = f.count;
      this.clips.set(seqNum, payload);
      this.nErrors = 0;
      this.log(`fetched clip ${seqNum} size=${payload.length}`);
    } catch (err: unknown) {
      if (this.needRestart) {
        return;
      }
      this.clips.set(seqNum, false);
      this.log(`cannot fetch clip ${seqNum}: ${err}`);
      if (++this.nErrors > 15) {
        this.needRestart = true;
        this.log("too many consecutive errors, restarting");
      }
    }
  }

  private async appendClips() {
    let nAppended = 0;
    while (true) {
      const clip = this.clips.get(this.nextAppend);
      if (clip === undefined || clip === true) {
        break;
      }
      if (clip !== false) {
        this.buffer!.appendBuffer(clip);
        await pEvent(this.buffer!, "updateend");
        ++nAppended;
      }
      this.clips.delete(this.nextAppend);
      if (this.nextAppend === 0) {
        this.$video.currentTime = 0;
        await this.$video.play();
        this.nextAppend = Math.max(this.metadata!.seqNum, 1);
      } else {
        ++this.nextAppend;
      }
    }

    if (nAppended > 0) {
      await this.adjustPlayhead();
    }
  }

  private async adjustPlayhead() {
    let playhead = this.$video.currentTime;
    let ranges = this.gatherBufferedRanges();

    if (ranges.length > 0) {
      const [firstStart] = ranges[0];
      const [lastStart, lastEnd] = ranges[ranges.length - 1];
      if (playhead < Math.max(lastStart, lastEnd - 6)) {
        playhead = Math.max(lastStart, lastEnd - 3);
        this.$video.currentTime = playhead;
      }
      if (lastEnd - firstStart > 40) {
        this.buffer!.remove(0, Math.min(playhead, lastEnd - 20));
        await pEvent(this.buffer!, "updateend");
        ranges = this.gatherBufferedRanges();
      }
    }

    this.log(`playhead=${playhead} buffered=${JSON.stringify(ranges)}`);
  }

  private gatherBufferedRanges(): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    for (let i = 0; i < this.buffer!.buffered.length; ++i) {
      ranges.push([this.buffer!.buffered.start(i), this.buffer!.buffered.end(i)]);
    }
    return ranges;
  }
}
