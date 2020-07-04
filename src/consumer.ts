import { Endpoint } from "@ndn/endpoint";
import { Name } from "@ndn/packet";
import { retrieveMetadata } from "@ndn/rdr";
import { fetch } from "@ndn/segmented-object";

let lastObjectUrl = "";
const endpoint = new Endpoint({ retx: 2 });
let retrieveTimer = 0;

async function retrieveImage(prefix: Name, $img: HTMLImageElement) {
  const m = await retrieveMetadata(prefix, { endpoint });
  const imageBuffer = await fetch.promise(m.name, { endpoint });
  const imageBlob = new Blob([imageBuffer]);

  const objectUrl = URL.createObjectURL(imageBlob);
  $img.src = objectUrl;
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
  }
  lastObjectUrl = objectUrl;
}

export function startConsumer(prefix: Name, $img: HTMLImageElement) {
  clearInterval(retrieveTimer);

  retrieveTimer = setInterval(() => retrieveImage(prefix, $img), 1000) as unknown as number;
}
