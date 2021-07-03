import { Endpoint } from "@ndn/endpoint";
import { SequenceNum } from "@ndn/naming-convention2";
import { Name } from "@ndn/packet";
import { retrieveMetadata } from "@ndn/rdr";
import { fetch, RttEstimator } from "@ndn/segmented-object";
import pEvent from "p-event";

import { getState } from "./connect";
import { HomecamMetadata } from "./metadata";

const endpoint = new Endpoint({ retx: 1 });
const rtte = new RttEstimator({ maxRto: 3000 });
let streamPrefix: Name;
let $video: HTMLVideoElement;
let $message: HTMLParagraphElement;

let restarting = false;
let abort: AbortController | undefined;
let versionPrefix: Name | undefined;
let currentVersion = 0;
let currentSequenceNum = 0;
let lastAppended = -1;
let estimatedFinalSegNum = 1;
let nFetchErrors = 0;
let mediaSource: MediaSource;
let sourceBuffer: SourceBuffer;

export async function startConsumer(id: string) {
  const { sysPrefix } = getState();
  streamPrefix = sysPrefix.append(id, "stream");
  $video = document.querySelector<HTMLVideoElement>("#c_video")!;
  $message = document.querySelector<HTMLParagraphElement>("#c_message")!;

  setInterval(tryLoadClip, 1000);

  document.querySelector("#c_id")!.textContent = id;
  document.querySelector("#c_section")!.classList.remove("hidden");
}

async function tryLoadClip() {
  try {
    await loadClip();
  } catch (err: unknown) {
    $message.textContent = `clip=${currentVersion},${currentSequenceNum} ${err}`;
    throw err;
  } finally {
    ++currentSequenceNum;
  }
}

async function loadClip() {
  if (!versionPrefix || nFetchErrors >= 3) {
    if (restarting) {
      return;
    }
    try {
      restarting = true;
      return await restartVideo();
    } finally {
      restarting = false;
    }
  }

  const size = await fetchAppendClip(currentSequenceNum);

  const [playhead, buffered] = adjustPlayhead();
  $message.textContent = `clip=${currentVersion},${currentSequenceNum} size=${size} srtt=${
    rtte.sRtt.toFixed(0)} play=${playhead} buffered=${JSON.stringify(buffered)}`;
}

async function fetchAppendClip(seqNum: number) {
  try {
    const fetchResult = fetch(
      versionPrefix!.append(SequenceNum, seqNum),
      { endpoint, rtte, estimatedFinalSegNum, retxLimit: 2, signal: abort!.signal });
    const payload = await fetchResult;
    estimatedFinalSegNum = fetchResult.count;

    if (seqNum > lastAppended) {
      lastAppended = seqNum;
      sourceBuffer.appendBuffer(payload);
      await pEvent(sourceBuffer, "updateend");
    }

    return payload.length;
  } catch (err: unknown) {
    ++nFetchErrors;
    throw err;
  }
}

async function restartVideo() {
  abort?.abort();
  abort = new AbortController();
  nFetchErrors = 0;
  lastAppended = -1;

  $message.textContent = "connecting to stream source";
  const m = await retrieveMetadata(streamPrefix, HomecamMetadata, { endpoint, signal: abort.signal });
  ({ versionPrefix, currentVersion, currentSequenceNum } = m);
  $message.textContent = `clip=${currentVersion},${currentSequenceNum} starting`;

  mediaSource = new MediaSource();
  $video.pause();
  $video.src = URL.createObjectURL(mediaSource);
  await pEvent(mediaSource, "sourceopen");
  URL.revokeObjectURL($video.src);

  sourceBuffer = mediaSource.addSourceBuffer(m.mimeType);
  await fetchAppendClip(0);

  $video.currentTime = 0;
  await $video.play();

  void (async () => {
    const err = await pEvent(sourceBuffer, "error");
    console.warn("sourceBuffer.err", err, $video.error);
  })();

  void (async () => {
    await pEvent(mediaSource, "sourceclose");
    versionPrefix = undefined;
  })();
}

function adjustPlayhead() {
  let { currentTime } = $video;

  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < sourceBuffer.buffered.length; ++i) {
    ranges.push([sourceBuffer.buffered.start(i), sourceBuffer.buffered.end(i)]);
  }

  if (ranges.length > 0) {
    const [firstStart] = ranges[0];
    const [lastStart, lastEnd] = ranges[ranges.length - 1];
    if (currentTime < lastStart) {
      $video.currentTime = lastStart;
      currentTime = lastStart;
    }
    if (lastEnd - firstStart > 40) {
      sourceBuffer.remove(0, Math.min(currentTime, lastEnd - 20));
    }
  }

  return [currentTime, ranges];
}
