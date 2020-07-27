import Bugsnag from "@bugsnag/js";
import galite from "ga-lite";
import { get as hashGet } from "hashquery";

import { connect, isID } from "./connect";
import { startConsumer } from "./consumer";
import type { Mode } from "./media";
import { startProducer } from "./producer";

if (location.hostname.endsWith(".ndn.today")) {
  galite("create", "UA-935676-11", "auto");
  galite("send", "pageview");
  Bugsnag.start({ apiKey: "9cdcc5bd49b3680e9aa4acee93171a8b" });
}

async function main() {
  const $loading = document.querySelector("#loading") as HTMLDivElement;
  $loading.classList.remove("hidden");
  $loading.textContent = "loading";
  try {
    await connect();
  } catch (err) {
    $loading.textContent = String(err);
    throw err;
  }
  $loading.remove();

  const id = hashGet("viewer");
  if (isID(id)) {
    startConsumer(id);
    document.querySelector("#home_section")!.classList.add("hidden");
    return;
  }

  const $cForm = document.querySelector("#c_form") as HTMLFormElement;
  $cForm.classList.remove("hidden");
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
  $pForm.classList.remove("hidden");
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
