// Bundle this module with Vite, Parcel, or another browser build tool.
import { Gapwise } from "@gapwise/sdk";
const gapwise = new Gapwise();
const form = document.querySelector<HTMLFormElement>("#building-finder")!;
const result = document.querySelector<HTMLElement>("#result")!;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = String(new FormData(form).get("q") ?? "");
  const page = await gapwise.buildings.list({ q });
  result.textContent = page.data.map(({ code, name }) => `${code} — ${name}`).join("\n");
});
