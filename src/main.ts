import { get as hashGet } from "hashquery";

import { connect, isID } from "./connect";
import { startConsumer } from "./consumer";
import type { Mode } from "./media";
import { startProducer } from "./producer";

async function main() {
  await connect();

  const id = hashGet("viewer");
  if (isID(id)) {
    startConsumer(id);
    document.querySelector("#home_section")!.classList.add("hidden");
    return;
  }

  const $cForm = document.querySelector("#c_form") as HTMLFormElement;
  $cForm.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const $cFormStream = document.querySelector("#c_form_stream") as HTMLInputElement;
    const id = $cFormStream.value;
    if (!isID(id)) {
      alert("invalid stream ID"); // eslint-disable-line no-alert
      return;
    }
    startConsumer(id);
    document.querySelector("#home_section")!.classList.add("hidden");
  });

  const $pForm = document.querySelector("#p_form") as HTMLFormElement;
  $pForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    const mode = ($pForm.querySelector("input[name=mode]:checked") as HTMLInputElement).value as Mode;
    try {
      await startProducer(mode);
    } catch {
      return;
    }
    document.querySelector("#home_section")!.classList.add("hidden");
  });
}

window.addEventListener("load", main);
