import { getRecognizedBuilding } from "./building-registry";

export type CampusModelSource = {
  name: string;
  url: string;
  licence: string;
  attribution?: string;
};

export type CampusModelTransform = {
  /** Geographic anchor in WGS84 longitude/latitude. */
  anchor: [longitude: number, latitude: number];
  /** Altitude above the MapLibre ground plane, in metres. */
  altitudeMeters: number;
  /** Clockwise rotation from true north, in degrees. */
  rotationDegrees: number;
  /** Uniform scale applied after the source model is converted to metres. */
  scale: number;
};

export type CampusBuildingModel = {
  buildingCode: string;
  /** Local, vendored GLB/GLTF URL. Remote proprietary model URLs are not allowed. */
  modelUrl: string;
  transform: CampusModelTransform;
  source: CampusModelSource;
  lastVerified: string;
  verificationStatus: "verified" | "inferred";
  notes?: string;
};

/**
 * 3D appearance is deliberately separate from canonical building identity.
 *
 * Building hit-testing, search focus, hover and selection MUST continue to use
 * `building-footprints.ts`, even after models are added here. A model can be
 * absent, visually simplified, or temporarily fail to load without changing
 * which geographic footprint a click resolves to.
 *
 * Keep this empty until a model has a documented, redistribution-compatible
 * source and its geographic transform has been verified against the canonical
 * footprint. Do not add Concept3D/U of T interactive-map rendering assets here.
 */
export const CAMPUS_BUILDING_MODELS: readonly CampusBuildingModel[] = [];

const LOCAL_MODEL_BASE = "https://gapwise.local";

function isLocalVendoredModelUrl(modelUrl: string) {
  if (!modelUrl.startsWith("/") || modelUrl.startsWith("//")) return false;
  try {
    const resolved = new URL(modelUrl, LOCAL_MODEL_BASE);
    return (
      resolved.origin === LOCAL_MODEL_BASE &&
      resolved.pathname.startsWith("/") &&
      !resolved.username &&
      !resolved.password
    );
  } catch {
    return false;
  }
}

function validateCampusModels(models: readonly CampusBuildingModel[]) {
  const seenCodes = new Set<string>();
  for (const model of models) {
    const code = model.buildingCode.toUpperCase();
    if (!getRecognizedBuilding(code)) {
      throw new Error(`Campus model uses unknown building code ${model.buildingCode}.`);
    }
    if (seenCodes.has(code)) throw new Error(`Duplicate campus model for ${code}.`);
    seenCodes.add(code);
    if (!isLocalVendoredModelUrl(model.modelUrl)) {
      throw new Error(`Campus model ${code} must use a local vendored model URL.`);
    }
    const [longitude, latitude] = model.transform.anchor;
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(model.transform.altitudeMeters) ||
      !Number.isFinite(model.transform.rotationDegrees) ||
      !Number.isFinite(model.transform.scale) ||
      model.transform.scale <= 0
    ) {
      throw new Error(`Campus model ${code} has an invalid geographic transform.`);
    }
  }
}

validateCampusModels(CAMPUS_BUILDING_MODELS);

const modelByCode = new Map(
  CAMPUS_BUILDING_MODELS.map((model) => [model.buildingCode.toUpperCase(), model]),
);

export function getCampusBuildingModel(code: string | null): CampusBuildingModel | null {
  return code ? (modelByCode.get(code.toUpperCase()) ?? null) : null;
}
