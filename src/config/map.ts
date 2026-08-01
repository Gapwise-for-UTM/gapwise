export const MAP_CONFIG = {
  /** Keyless OpenStreetMap vector tiles. Keep provider choice isolated here. */
  styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  attribution:
    '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  campusCenter: [-79.66475, 43.55105] as [number, number],
  initialZoom: 16,
} as const;
