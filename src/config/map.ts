export const MAP_CONFIG = {
  styleUrl: "https://tiles.openfreemap.org/styles/fiord",
  styleUrls: {
    light: "https://tiles.openfreemap.org/styles/liberty",
    dark: "https://tiles.openfreemap.org/styles/fiord",
  },
  attribution:
    '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  campusCenter: [-79.66475, 43.55105] as [number, number],
  initialZoom: 16,
} as const;
