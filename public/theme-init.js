(() => {
  try {
    const preference = localStorage.getItem("gapwise:theme") || "system";
    const dark =
      preference === "dark" ||
      (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {
    // Storage may be unavailable in hardened browsing modes; CSS light defaults remain safe.
  }
})();
