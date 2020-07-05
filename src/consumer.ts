import { Endpoint } from "@ndn/endpoint";
import { Name } from "@ndn/packet";
import { retrieveMetadata } from "@ndn/rdr";
import { fetch } from "@ndn/segmented-object";

import { getState } from "./connect";

const endpoint = new Endpoint({ retx: 2 });
let streamPrefix: Name;
let $img: HTMLImageElement;
let lastImageName = new Name();
let lastObjectUrl = "";

async function retrieveImage() {
  const { name: imageName } = await retrieveMetadata(streamPrefix, { endpoint });
  if (imageName.equals(lastImageName)) {
    return;
  }
  lastImageName = imageName;

  const imageBuffer = await fetch.promise(imageName, { endpoint });
  const imageBlob = new Blob([imageBuffer]);
  const objectUrl = URL.createObjectURL(imageBlob);
  $img.src = objectUrl;
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
  }
  lastObjectUrl = objectUrl;
}

async function reloadImage() {
  try {
    await retrieveImage();
  } finally {
    setTimeout(reloadImage, 200);
  }
}

export function startConsumer(id: string) {
  const { sysPrefix } = getState();
  streamPrefix = sysPrefix.append(id, "image");
  $img = document.querySelector("#c_img") as HTMLImageElement;
  setTimeout(reloadImage, 200);

  document.querySelector("#c_id")!.textContent = id;
  document.querySelector("#c_section")!.classList.remove("hidden");
}
