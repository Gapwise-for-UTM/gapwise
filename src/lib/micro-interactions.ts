import type { MouseEvent } from "react";

const SPARK_COUNT = 7;
const SPARK_DISTANCE_PX = 18;
const SPARK_DURATION_MS = 520;

export function emitClickSpark(event: MouseEvent<HTMLElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "click-spark-burst";
  burst.setAttribute("aria-hidden", "true");
  burst.style.color = window.getComputedStyle(target).color;
  const clickX = event.clientX || bounds.left + bounds.width / 2;
  const clickY = event.clientY || bounds.top + bounds.height / 2;
  burst.style.setProperty("--spark-left", `${clickX}px`);
  burst.style.setProperty("--spark-top", `${clickY}px`);

  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const angle = (Math.PI * 2 * index) / SPARK_COUNT;
    const particle = document.createElement("span");
    particle.className = "click-spark-particle";
    particle.style.setProperty("--spark-x", `${Math.cos(angle) * SPARK_DISTANCE_PX}px`);
    particle.style.setProperty("--spark-y", `${Math.sin(angle) * SPARK_DISTANCE_PX}px`);
    burst.append(particle);
  }

  document.body.append(burst);
  window.setTimeout(() => burst.remove(), SPARK_DURATION_MS);
}
