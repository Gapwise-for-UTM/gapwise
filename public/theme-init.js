(() => {
  let preference = "system";
  try {
    const stored = localStorage.getItem("gapwise:theme");
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch {
    // Persistent storage may be unavailable; the system preference still applies.
  }

  const dark =
    preference === "dark" ||
    (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
