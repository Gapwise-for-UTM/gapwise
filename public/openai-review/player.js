const video = document.getElementById("demo");
const status = document.getElementById("status");

async function loadDemo() {
  try {
    const parts = await Promise.all([
      fetch("/openai-review/demo.part1.b64", { cache: "force-cache" }),
      fetch("/openai-review/demo.part2.b64", { cache: "force-cache" }),
    ]);

    if (parts.some((response) => !response.ok)) {
      throw new Error("Video data could not be loaded.");
    }

    const base64 = (await Promise.all(parts.map((response) => response.text()))).join("");
    const binary = atob(base64.trim());
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const url = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
    video.src = url;
    status.dataset.ready = "true";

    window.addEventListener("pagehide", () => URL.revokeObjectURL(url), { once: true });
  } catch (error) {
    console.error(error);
    status.textContent = "The demo recording failed to load. Refresh the page to try again.";
  }
}

loadDemo();
