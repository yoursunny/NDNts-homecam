import { Endpoint } from "@ndn/endpoint";
import { Version } from "@ndn/naming-convention2";
import { Name } from "@ndn/packet";
import { retrieveMetadata } from "@ndn/rdr";
import { fetch, RttEstimator } from "@ndn/segmented-object";

import { getState } from "./connect";

const endpoint = new Endpoint({ retx: 2 });
const rtte = new RttEstimator();
let streamPrefix: Name;
let $img: HTMLImageElement;
let $message: HTMLParagraphElement;
let lastImageName = new Name();
let lastObjectUrl = "";
let estimatedFinalSegNum = 5;

async function retrieveImage() {
  const { name: imageName } = await retrieveMetadata(streamPrefix, { endpoint });
  if (imageName.equals(lastImageName)) {
    return;
  }
  lastImageName = imageName;

  const fetchResult = fetch(imageName, { endpoint, rtte, estimatedFinalSegNum });
  const imageBuffer = await fetchResult;
  estimatedFinalSegNum = fetchResult.count;

  const objectUrl = URL.createObjectURL(new Blob([imageBuffer]));
  $img.src = objectUrl;
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
  }
  lastObjectUrl = objectUrl;
  $message.textContent = `Retrieved: ${imageName.at(-1).as(Version)}`;
}

async function reloadImage() {
  try {
    await retrieveImage();
  } catch (err: unknown) {
    $message.textContent = String(err);
  } finally {
    setTimeout(reloadImage, 200);
  }
}

export function startConsumer(id: string) {
  const { sysPrefix } = getState();
  streamPrefix = sysPrefix.append(id, "image");
  $img = document.querySelector<HTMLImageElement>("#c_img")!;
  $message = document.querySelector<HTMLParagraphElement>("#c_message")!;
  setTimeout(reloadImage, 200);

  document.querySelector("#c_id")!.textContent = id;
  document.querySelector("#c_section")!.classList.remove("hidden");
}
