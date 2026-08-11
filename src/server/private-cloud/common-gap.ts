import type { Database } from "../../lib/database.types";
import type { Term } from "../../lib/timetable-types";
import { TERMS } from "../../lib/timetable-types";
import {
  intersectAvailabilityCapsules,
  MAX_CAPSULE_PLAINTEXT_BYTES,
  validateAvailabilityCapsule,
  type AvailabilityWindow,
} from "../../features/security/availability-capsule";
import { decryptJsonRecord, importAes256Key } from "../../features/security/envelope-crypto";
import { byteaHexToBytes } from "../../features/security/encoding";
import type { AuthenticatedRequest } from "./auth";
import { ApiError, requireExactObject } from "./http";
import { loadKek, unwrapStoredDataKeyMaterial, type KekLoader } from "./kek";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type FriendCapsuleMaterial =
  Database["public"]["Functions"]["get_friend_capsule_material"]["Returns"][number];

async function decryptCapsuleMaterial(row: FriendCapsuleMaterial, kekLoader: KekLoader) {
  const rawDek = await unwrapStoredDataKeyMaterial(
    {
      cryptoVersion: row.crypto_version,
      ciphertext: row.wrapped_dek,
      kekVersion: row.kek_version,
      keyId: row.key_id,
      keyVersion: row.key_version,
      nonce: row.wrap_nonce,
      subjectId: row.subject_id,
    },
    "friend-availability",
    kekLoader,
  );
  try {
    const dek = await importAes256Key(rawDek, false);
    return await decryptJsonRecord(
      dek,
      {
        ciphertext: byteaHexToBytes(row.capsule_ciphertext, 8_208),
        nonce: byteaHexToBytes(row.capsule_nonce, 12),
      },
      {
        cryptoVersion: row.crypto_version,
        schemaVersion: row.capsule_schema_version,
        purpose: "friend-availability",
        subjectId: row.subject_id,
        recordId: row.capsule_id,
        keyId: row.key_id,
        revision: row.capsule_revision,
      },
      validateAvailabilityCapsule,
      MAX_CAPSULE_PLAINTEXT_BYTES,
    );
  } finally {
    rawDek.fill(0);
  }
}

export async function decryptCommonGapMaterial(
  rows: FriendCapsuleMaterial[],
  term: Term,
  kekLoader: KekLoader = loadKek,
): Promise<AvailabilityWindow[]> {
  if (rows.length === 0) return [];
  if (rows.length !== 2 || rows[0]?.participant !== "caller" || rows[1]?.participant !== "friend") {
    throw new Error("Friend capsule material is malformed.");
  }
  const [caller, friend] = await Promise.all([
    decryptCapsuleMaterial(rows[0], kekLoader),
    decryptCapsuleMaterial(rows[1], kekLoader),
  ]);
  return intersectAvailabilityCapsules(caller, friend, term);
}

export async function findCommonGaps(
  authenticated: AuthenticatedRequest,
  friendshipId: string,
  term: Term,
): Promise<{ windows: AvailabilityWindow[] }> {
  const { data, error } = await authenticated.client.rpc("get_friend_capsule_material", {
    p_friendship_id: friendshipId,
    p_term: term,
  });
  if (error) {
    if (error.message.includes("temporarily unavailable")) {
      throw new ApiError(429, "Common-gap lookup temporarily unavailable.");
    }
    throw new Error("Friend capsule material lookup failed.");
  }
  return { windows: await decryptCommonGapMaterial(data ?? [], term) };
}

export function parseCommonGapBody(value: unknown): { friendshipId: string; term: Term } {
  const body = requireExactObject(value, ["friendshipId", "term"]);
  const friendshipId = body["friendshipId"];
  const term = body["term"];
  if (
    typeof friendshipId !== "string" ||
    !UUID_PATTERN.test(friendshipId) ||
    typeof term !== "string" ||
    !TERMS.includes(term as Term)
  ) {
    throw new ApiError(400, "Common-gap request is invalid.");
  }
  return { friendshipId, term: term as Term };
}
