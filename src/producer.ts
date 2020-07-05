import { Endpoint } from "@ndn/endpoint";
import { Version } from "@ndn/naming-convention2";
import type { Name, Signer } from "@ndn/packet";
import { serveMetadata } from "@ndn/rdr";
import { BlobChunkSource, serve, Server } from "@ndn/segmented-object";

import { getState } from "./connect";
import { getImage, Mode, startCapture } from "./media";

const endpoint = new Endpoint({ announcement: false });
let imagePrefix: Name;
let dataSigner: Signer;
let lastVersion = 0;
const servers: Server[] = [];

async function saveImage() {
  const imageBlob = await getImage();

  const version = Math.round(Date.now() / 1000);
  const producer = serve(imagePrefix.append(Version, version), new BlobChunkSource(imageBlob), {
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

export async function startProducer(mode: Mode) {
  const { sysPrefix, myID } = getState();
  imagePrefix = sysPrefix.append(myID, "image");

  await startCapture(mode);
  setInterval(saveImage, 1000);
  serveMetadata(() => {
    return {
      name: imagePrefix.append(Version, lastVersion),
    };
  }, { endpoint, signer: dataSigner, announcement: false });

  document.querySelector("#p_id")!.textContent = myID;
  document.querySelector("#p_section")!.classList.remove("hidden");
}
