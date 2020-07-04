import { Endpoint, Producer } from "@ndn/endpoint";
import { Version } from "@ndn/naming-convention2";
import type { Name, Signer } from "@ndn/packet";
import { serveMetadata } from "@ndn/rdr";
import { BufferChunkSource, serve, Server } from "@ndn/segmented-object";

import type { CaptureResult } from "./media";

const endpoint = new Endpoint({ announcement: false });
let lastVersion = 0;
const servers: Server[] = [];
let metaProducer: Producer|undefined;
let captureTimer = 0;

async function captureImage(prefix: Name, dataSigner: Signer, { width, height, $video, $canvas }: CaptureResult) {
  $canvas.getContext("2d")!.drawImage($video, 0, 0, width, height);
  const imageBlob = await new Promise<Blob|null>((resolve) =>
    $canvas.toBlob(resolve, "image/jpeg", 70));
  const imageBuffer = new Uint8Array(await imageBlob!.arrayBuffer());

  const version = Math.round(Date.now() / 1000);
  const producer = serve(prefix.append(Version, version), new BufferChunkSource(imageBuffer), {
    endpoint,
    signer: dataSigner,
    freshnessPeriod: 60000,
  });
  servers.push(producer);
  while (servers.length > 20) {
    servers.shift()!.close();
  }
  lastVersion = version;
}

export function startProducer(prefix: Name, dataSigner: Signer, captured: CaptureResult) {
  metaProducer?.close();
  clearInterval(captureTimer);

  captureTimer = setInterval(() => captureImage(prefix, dataSigner, captured), 1000) as unknown as number;

  metaProducer = serveMetadata(() => {
    return {
      name: prefix.append(Version, lastVersion),
    };
  }, { endpoint, signer: dataSigner, announcement: false });
}
