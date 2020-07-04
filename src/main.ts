import { Name } from "@ndn/packet";

import { connect } from "./connect";
import { startConsumer } from "./consumer";
import { startCapture } from "./media";
import { startProducer } from "./producer";

function disableButtons() {
  for (const $button of document.querySelectorAll("form button")) {
    ($button as HTMLButtonElement).disabled = true;
  }
}

async function main() {
  const { prefix, dataSigner } = await connect();
  (document.querySelector("#app_stream_name") as HTMLInputElement).value = prefix.toString();

  const imagePrefix = prefix.append("image");
  const $streamForm = document.querySelector("#app_stream_form") as HTMLFormElement;
  $streamForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    const $submitter = (evt as any).submitter as HTMLButtonElement;
    const captured = await startCapture($submitter.value as "camera"|"screen");
    startProducer(imagePrefix, dataSigner, captured);
    disableButtons();
  });

  const $watchForm = document.querySelector("#app_watch_form") as HTMLFormElement;
  $watchForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    const prefix = new Name((document.querySelector("#app_watch_name") as HTMLInputElement).value).append("image");
    const $viewer = document.querySelector("#app_viewer") as HTMLImageElement;
    $viewer.classList.remove("hidden");
    startConsumer(prefix, $viewer);
    disableButtons();
  });
}

window.addEventListener("load", main);
