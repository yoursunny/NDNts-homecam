import { Endpoint } from "@ndn/endpoint";
import { Version } from "@ndn/naming-convention2";
import { Name } from "@ndn/packet";
import { retrieveMetadata } from "@ndn/rdr";
import { fetch, RttEstimator } from "@ndn/segmented-object";
import pEvent from "p-event";

import { getState } from "./connect";
import { HomecamMetadata, HomecamMetadataInitVersion } from "./metadata";

const endpoint = new Endpoint({ retx: 2 });
const rtte = new RttEstimator();
let streamPrefix: Name;
let $video: HTMLVideoElement;
let $message: HTMLParagraphElement;

let playingInit = 0;
let mediaSource: MediaSource;
let sourceBuffer: SourceBuffer;
let lastVersion = new Name();
let estimatedFinalSegNum = 1;

export async function startConsumer(id: string) {
  const { sysPrefix } = getState();
  streamPrefix = sysPrefix.append(id, "stream");
  $video = document.querySelector<HTMLVideoElement>("#c_video")!;
  $message = document.querySelector<HTMLParagraphElement>("#c_message")!;

  setTimeout(tryRetrieveClip, 200);

  document.querySelector("#c_id")!.textContent = id;
  document.querySelector("#c_section")!.classList.remove("hidden");
}

async function tryRetrieveClip() {
  try {
    await retrieveClip();
  } catch (err: unknown) {
    $message.textContent = `${err}`;
    throw err;
  } finally {
    setTimeout(tryRetrieveClip, 200);
  }
}

async function retrieveClip() {
  const m = await retrieveMetadata(streamPrefix, { endpoint, Metadata: HomecamMetadata });
  let { name } = m;
  const initVersion = HomecamMetadataInitVersion.get(m);
  if (initVersion === 0) {
    return;
  }
  if (initVersion !== playingInit) {
    name = name.getPrefix(-1).append(Version, initVersion);
  } else if (name.equals(lastVersion)) {
    return;
  }

  const fetchResult = fetch(name, { endpoint, rtte, estimatedFinalSegNum });
  const mediaData = await fetchResult;
  if (initVersion !== playingInit) {
    await restartVideo(initVersion);
  }
  lastVersion = name;
  estimatedFinalSegNum = fetchResult.count;

  sourceBuffer.appendBuffer(mediaData);
  await pEvent(sourceBuffer, "updateend");

  const [playhead, buffered] = adjustPlayhead();
  $message.textContent = `clip=${name.at(-1).as(Version)} size=${mediaData.length} play=${playhead} buffered=${JSON.stringify(buffered)}`;
}

async function restartVideo(initVersion: number) {
  $video.pause();

  mediaSource = new MediaSource();
  $video.src = URL.createObjectURL(mediaSource);
  await pEvent(mediaSource, "sourceopen");
  URL.revokeObjectURL($video.src);

  sourceBuffer = mediaSource.addSourceBuffer("video/webm;codecs=vp8,opus");
  void (async () => {
    await pEvent(sourceBuffer, "updateend");
    $video.currentTime = 0;
    await $video.play();
  })();

  void (async () => {
    await pEvent(mediaSource, "sourceclose");
    playingInit = 0;
  })();

  playingInit = initVersion;
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
