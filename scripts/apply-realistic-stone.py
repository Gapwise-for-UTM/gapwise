#!/usr/bin/env python3
from __future__ import annotations

import base64
import copy
import io
import json
import math
import random
import struct
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/models/utm-entrance-monument-source.glb"
OUTPUT = ROOT / "public/models/utm-entrance-monument.glb"
TEXTURES = ROOT / "assets/textures"

ALBEDO = TEXTURES / "utm-stone-albedo.png"
NORMAL = TEXTURES / "utm-stone-normal.png"
ROUGHNESS = TEXTURES / "utm-stone-roughness.png"
AO = TEXTURES / "utm-stone-ao.png"
ORM = TEXTURES / "utm-stone-orm.png"
PLAQUE = TEXTURES / "utm-monument-plaque.png"

MAGIC = 0x46546C67
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

SIZE = 1024
SEED = 7102026


def normalize(values: np.ndarray) -> np.ndarray:
    low, high = np.percentile(values, (1.0, 99.0))
    if high <= low:
        return np.zeros_like(values, dtype=np.float32)
    return np.clip((values - low) / (high - low), 0.0, 1.0).astype(
        np.float32
    )


def periodic_noise(size: int, sigma: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    source = rng.normal(0.0, 1.0, (size, size))

    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.rfftfreq(size)[None, :]
    radius_squared = fx * fx + fy * fy

    low_pass = np.exp(
        -2.0 * math.pi * math.pi * sigma * sigma * radius_squared
    )

    spectrum = np.fft.rfft2(source)
    result = np.fft.irfft2(
        spectrum * low_pass,
        s=(size, size),
    )

    return normalize(result)


def save_png(path: Path, array: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array).save(
        path,
        format="PNG",
        optimize=True,
        compress_level=9,
    )


def generate_textures() -> None:
    broad = periodic_noise(SIZE, 92.0, SEED)
    medium = periodic_noise(SIZE, 24.0, SEED + 1)
    fine = periodic_noise(SIZE, 4.2, SEED + 2)
    micro = periodic_noise(SIZE, 1.25, SEED + 3)
    warm = periodic_noise(SIZE, 48.0, SEED + 4)
    cool = periodic_noise(SIZE, 65.0, SEED + 5)
    pit_field = periodic_noise(SIZE, 2.1, SEED + 6)

    yy, xx = np.mgrid[0:SIZE, 0:SIZE]

    vein = (
        0.55
        * np.sin(
            2.0 * math.pi * (3.0 * xx / SIZE + 2.0 * yy / SIZE)
            + 0.7
        )
        + 0.45
        * np.sin(
            2.0 * math.pi * (5.0 * xx / SIZE - 3.0 * yy / SIZE)
            + 1.9
        )
    )

    pits = np.clip(
        (0.24 - pit_field) / 0.24,
        0.0,
        1.0,
    ) ** 2.7

    luminance = (
        132.0
        + 30.0 * (broad - 0.5)
        + 19.0 * (medium - 0.5)
        + 8.0 * (fine - 0.5)
        + 3.5 * vein
        - 18.0 * pits
    )

    rng = np.random.default_rng(SEED + 7)
    specks = rng.random((SIZE, SIZE))

    luminance -= 10.0 * (specks < 0.0025)
    luminance += 8.0 * (specks > 0.9982)

    red = luminance + 5.5 * (warm - 0.5) + 1.5
    green = luminance + 1.5 * (warm - 0.5)
    blue = luminance + 5.0 * (cool - 0.5) - 1.5

    albedo = np.stack(
        [red, green, blue],
        axis=-1,
    )

    albedo = np.clip(
        albedo,
        68.0,
        181.0,
    ).astype(np.uint8)

    height = normalize(
        0.24 * broad
        + 0.40 * medium
        + 0.22 * fine
        + 0.11 * micro
        + 0.025 * vein
        - 0.10 * pits
    )

    dx = 0.5 * (
        np.roll(height, -1, axis=1)
        - np.roll(height, 1, axis=1)
    )

    dy = 0.5 * (
        np.roll(height, -1, axis=0)
        - np.roll(height, 1, axis=0)
    )

    gradient_reference = max(
        float(np.percentile(np.hypot(dx, dy), 96.0)),
        1e-6,
    )

    strength = 0.34
    nx = -strength * dx / gradient_reference
    ny = strength * dy / gradient_reference
    nz = np.ones_like(nx)

    inverse_length = 1.0 / np.sqrt(
        nx * nx + ny * ny + nz * nz
    )

    normal = np.stack(
        [
            (nx * inverse_length * 0.5 + 0.5) * 255.0,
            (ny * inverse_length * 0.5 + 0.5) * 255.0,
            (nz * inverse_length * 0.5 + 0.5) * 255.0,
        ],
        axis=-1,
    )

    normal = np.clip(
        normal,
        0.0,
        255.0,
    ).astype(np.uint8)

    laplacian = (
        np.roll(height, 1, axis=0)
        + np.roll(height, -1, axis=0)
        + np.roll(height, 1, axis=1)
        + np.roll(height, -1, axis=1)
        - 4.0 * height
    )

    positive_laplacian = np.clip(
        laplacian,
        0.0,
        None,
    )

    laplacian_reference = max(
        float(np.percentile(positive_laplacian, 98.0)),
        1e-6,
    )

    cavity = np.clip(
        positive_laplacian / laplacian_reference,
        0.0,
        1.0,
    )

    roughness = (
        233.0
        + 11.0 * (medium - 0.5)
        + 7.0 * (micro - 0.5)
        + 12.0 * pits
    )

    roughness = np.clip(
        roughness,
        224.0,
        250.0,
    ).astype(np.uint8)

    ambient_occlusion = (
        246.0
        - 54.0 * cavity
        - 34.0 * pits
        - 10.0 * (1.0 - broad)
    )

    ambient_occlusion = np.clip(
        ambient_occlusion,
        160.0,
        250.0,
    ).astype(np.uint8)

    metallic = np.zeros_like(
        roughness,
        dtype=np.uint8,
    )

    orm = np.stack(
        [
            ambient_occlusion,
            roughness,
            metallic,
        ],
        axis=-1,
    )

    save_png(ALBEDO, albedo)
    save_png(NORMAL, normal)
    save_png(ROUGHNESS, roughness)
    save_png(AO, ambient_occlusion)
    save_png(ORM, orm)


def load_glb(path: Path) -> tuple[dict, bytearray]:
    data = path.read_bytes()

    if len(data) < 20:
        raise RuntimeError("Model is too small to be a GLB file")

    magic, version, total_length = struct.unpack_from(
        "<III",
        data,
        0,
    )

    if magic != MAGIC or version != 2:
        raise RuntimeError("Model is not a GLB 2.0 file")

    if total_length != len(data):
        raise RuntimeError(
            "GLB header size does not match the actual file size"
        )

    position = 12
    document = None
    binary = b""

    while position < len(data):
        chunk_length, chunk_type = struct.unpack_from(
            "<II",
            data,
            position,
        )

        position += 8
        payload = data[position : position + chunk_length]
        position += chunk_length

        if chunk_type == JSON_CHUNK:
            document = json.loads(
                payload.rstrip(b" \t\r\n\0").decode("utf-8")
            )
        elif chunk_type == BIN_CHUNK:
            binary = payload

    if document is None:
        raise RuntimeError("GLB contains no JSON chunk")

    buffers = document.get("buffers", [])

    if len(buffers) != 1:
        raise RuntimeError(
            "Expected the GLB to contain one embedded buffer"
        )

    logical_length = int(
        buffers[0].get("byteLength", len(binary))
    )

    if logical_length > len(binary):
        raise RuntimeError(
            "GLB binary data is shorter than its declared length"
        )

    return document, bytearray(binary[:logical_length])


def write_glb(
    path: Path,
    document: dict,
    binary: bytearray,
) -> None:
    document["buffers"][0]["byteLength"] = len(binary)

    json_bytes = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")

    json_bytes += b" " * ((-len(json_bytes)) % 4)

    binary_bytes = bytes(binary)
    binary_bytes += b"\0" * ((-len(binary_bytes)) % 4)

    json_chunk = (
        struct.pack(
            "<II",
            len(json_bytes),
            JSON_CHUNK,
        )
        + json_bytes
    )

    binary_chunk = (
        struct.pack(
            "<II",
            len(binary_bytes),
            BIN_CHUNK,
        )
        + binary_bytes
    )

    total_length = (
        12
        + len(json_chunk)
        + len(binary_chunk)
    )

    output = (
        struct.pack(
            "<III",
            MAGIC,
            2,
            total_length,
        )
        + json_chunk
        + binary_chunk
    )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(output)

    checked_document, _ = load_glb(path)

    if (
        checked_document["buffers"][0]["byteLength"]
        != len(binary)
    ):
        raise RuntimeError(
            "Generated GLB failed validation"
        )


def append_png(
    document: dict,
    binary: bytearray,
    path: Path,
    name: str,
) -> int:
    while len(binary) % 4:
        binary.append(0)

    png = path.read_bytes()
    byte_offset = len(binary)
    binary.extend(png)

    buffer_views = document.setdefault(
        "bufferViews",
        [],
    )

    buffer_view_index = len(buffer_views)

    buffer_views.append(
        {
            "buffer": 0,
            "byteOffset": byte_offset,
            "byteLength": len(png),
            "name": name,
        }
    )

    images = document.setdefault(
        "images",
        [],
    )

    image_index = len(images)

    images.append(
        {
            "name": name,
            "mimeType": "image/png",
            "bufferView": buffer_view_index,
        }
    )

    return image_index


def embedded_image_bytes(
    document: dict,
    binary: bytearray,
    image_index: int,
) -> bytes | None:
    images = document.get("images", [])

    if not 0 <= image_index < len(images):
        return None

    image = images[image_index]

    if "bufferView" in image:
        view = document["bufferViews"][image["bufferView"]]
        start = int(view.get("byteOffset", 0))
        end = start + int(view["byteLength"])
        return bytes(binary[start:end])

    uri = str(image.get("uri", ""))

    if uri.startswith("data:") and "," in uri:
        header, payload = uri.split(",", 1)

        if ";base64" in header:
            return base64.b64decode(payload)

    return None


def looks_like_plaque(
    document: dict,
    binary: bytearray,
    texture_index: int,
    plaque_reference: np.ndarray | None,
) -> bool:
    if plaque_reference is None:
        return False

    textures = document.get("textures", [])

    if not 0 <= texture_index < len(textures):
        return False

    source = textures[texture_index].get("source")

    if not isinstance(source, int):
        return False

    raw = embedded_image_bytes(
        document,
        binary,
        source,
    )

    if not raw:
        return False

    try:
        candidate = np.asarray(
            Image.open(io.BytesIO(raw))
            .convert("RGB")
            .resize((64, 64)),
            dtype=np.float32,
        )
    except Exception:
        return False

    difference = float(
        np.mean(
            np.abs(candidate - plaque_reference)
        )
    )

    return difference < 9.0


def classify_materials(
    document: dict,
    binary: bytearray,
) -> set[int]:
    materials = document.get("materials", [])

    if not materials:
        raise RuntimeError(
            "Model contains no materials"
        )

    plaque_reference = None

    if PLAQUE.exists():
        plaque_reference = np.asarray(
            Image.open(PLAQUE)
            .convert("RGB")
            .resize((64, 64)),
            dtype=np.float32,
        )

    mesh_node_names: dict[int, list[str]] = {}

    for node in document.get("nodes", []):
        mesh_index = node.get("mesh")

        if isinstance(mesh_index, int):
            mesh_node_names.setdefault(
                mesh_index,
                [],
            ).append(str(node.get("name", "")))

    usages: dict[int, list[str]] = {}
    usage_counts: dict[int, int] = {}

    for mesh_index, mesh in enumerate(
        document.get("meshes", [])
    ):
        names = [
            str(mesh.get("name", "")),
            *mesh_node_names.get(mesh_index, []),
        ]

        for primitive in mesh.get("primitives", []):
            material_index = primitive.get("material")

            if isinstance(material_index, int):
                usage_counts[material_index] = (
                    usage_counts.get(material_index, 0) + 1
                )

                usages.setdefault(
                    material_index,
                    [],
                ).extend(names)

    excluded = {
        "plaque",
        "letter",
        "lettering",
        "text",
        "logo",
        "sign",
        "inscription",
        "bronze",
        "metal",
        "inlay",
    }

    included = {
        "stone",
        "limestone",
        "rock",
        "slab",
        "monument",
        "wall",
        "column",
        "support",
        "base",
    }

    candidates: set[int] = set()
    definite: set[int] = set()

    for index, material in enumerate(materials):
        words = [
            str(material.get("name", "")),
            *usages.get(index, []),
        ]

        pbr = material.get(
            "pbrMetallicRoughness",
            {},
        )

        texture_info = pbr.get(
            "baseColorTexture",
            {},
        )

        texture_index = texture_info.get("index")
        plaque_match = False

        if isinstance(texture_index, int):
            textures = document.get("textures", [])

            if 0 <= texture_index < len(textures):
                texture = textures[texture_index]
                words.append(
                    str(texture.get("name", ""))
                )

                source = texture.get("source")

                if isinstance(source, int):
                    images = document.get("images", [])

                    if 0 <= source < len(images):
                        image = images[source]

                        words.extend(
                            [
                                str(image.get("name", "")),
                                str(image.get("uri", "")),
                            ]
                        )

                plaque_match = looks_like_plaque(
                    document,
                    binary,
                    texture_index,
                    plaque_reference,
                )

        description = " ".join(words).lower()

        blocked = (
            plaque_match
            or any(
                token in description
                for token in excluded
            )
        )

        if blocked:
            print(
                f"Preserving material {index}: "
                f"{material.get('name', '(unnamed)')}"
            )
            continue

        candidates.add(index)

        if any(
            token in description
            for token in included
        ):
            definite.add(index)

    selected = definite or candidates

    if not selected and usage_counts:
        selected = {
            max(
                usage_counts,
                key=usage_counts.get,
            )
        }

    if not selected:
        raise RuntimeError(
            "Could not identify the stone material"
        )

    return selected


def texture_info(
    texture_index: int,
    transform: dict,
) -> dict:
    return {
        "index": texture_index,
        "texCoord": 0,
        "extensions": {
            "KHR_texture_transform": copy.deepcopy(
                transform
            )
        },
    }


def apply_materials(
    document: dict,
    binary: bytearray,
) -> tuple[int, int]:
    albedo_image = append_png(
        document,
        binary,
        ALBEDO,
        "UTM weathered stone albedo",
    )

    normal_image = append_png(
        document,
        binary,
        NORMAL,
        "UTM weathered stone normal",
    )

    orm_image = append_png(
        document,
        binary,
        ORM,
        "UTM weathered stone ORM",
    )

    samplers = document.setdefault(
        "samplers",
        [],
    )

    sampler_index = len(samplers)

    samplers.append(
        {
            "name": "UTM repeating stone sampler",
            "magFilter": 9729,
            "minFilter": 9987,
            "wrapS": 10497,
            "wrapT": 10497,
        }
    )

    textures = document.setdefault(
        "textures",
        [],
    )

    albedo_texture = len(textures)
    textures.append(
        {
            "name": "UTM weathered stone albedo",
            "sampler": sampler_index,
            "source": albedo_image,
        }
    )

    normal_texture = len(textures)
    textures.append(
        {
            "name": "UTM weathered stone normal",
            "sampler": sampler_index,
            "source": normal_image,
        }
    )

    orm_texture = len(textures)
    textures.append(
        {
            "name": "UTM weathered stone ORM",
            "sampler": sampler_index,
            "source": orm_image,
        }
    )

    stone_materials = classify_materials(
        document,
        binary,
    )

    materials = document["materials"]
    original_material_count = len(materials)

    primitive_references = []

    for mesh_index, mesh in enumerate(
        document.get("meshes", [])
    ):
        for primitive_index, primitive in enumerate(
            mesh.get("primitives", [])
        ):
            material_index = primitive.get("material")

            if material_index in stone_materials:
                primitive_references.append(
                    (
                        mesh_index,
                        primitive_index,
                        primitive,
                        int(material_index),
                    )
                )

    if not primitive_references:
        raise RuntimeError(
            "Stone materials are not assigned to any primitives"
        )

    variants_by_source: dict[int, list[int]] = {}

    for source_index in sorted(stone_materials):
        usage_count = sum(
            1
            for _, _, _, material_index
            in primitive_references
            if material_index == source_index
        )

        variant_count = max(
            1,
            min(12, usage_count),
        )

        variants = []

        for variant_index in range(variant_count):
            rng = random.Random(
                SEED
                + source_index * 1009
                + variant_index * 97
            )

            scale = rng.uniform(1.75, 2.25)

            transform = {
                "offset": [
                    rng.random(),
                    rng.random(),
                ],
                "rotation": rng.uniform(
                    -0.16,
                    0.16,
                ),
                "scale": [
                    scale,
                    scale,
                ],
            }

            material = copy.deepcopy(
                materials[source_index]
            )

            old_name = str(
                material.get(
                    "name",
                    f"Material {source_index}",
                )
            )

            material["name"] = (
                f"{old_name} · weathered stone "
                f"{variant_index + 1}"
            )

            tint = rng.uniform(
                0.91,
                1.06,
            )

            warmth = rng.uniform(
                -0.015,
                0.018,
            )

            pbr = material.setdefault(
                "pbrMetallicRoughness",
                {},
            )

            pbr["baseColorFactor"] = [
                min(1.0, tint + warmth),
                tint,
                min(1.0, tint - warmth),
                1.0,
            ]

            pbr["baseColorTexture"] = texture_info(
                albedo_texture,
                transform,
            )

            pbr["metallicFactor"] = 0.0
            pbr["roughnessFactor"] = 1.0

            pbr["metallicRoughnessTexture"] = (
                texture_info(
                    orm_texture,
                    transform,
                )
            )

            normal_info = texture_info(
                normal_texture,
                transform,
            )

            normal_info["scale"] = 0.40
            material["normalTexture"] = normal_info

            occlusion_info = texture_info(
                orm_texture,
                transform,
            )

            occlusion_info["strength"] = 0.78

            material["occlusionTexture"] = (
                occlusion_info
            )

            material["emissiveFactor"] = [
                0.0,
                0.0,
                0.0,
            ]

            material.pop(
                "emissiveTexture",
                None,
            )

            material["alphaMode"] = "OPAQUE"
            material.pop("alphaCutoff", None)

            extensions = material.get("extensions")

            if isinstance(extensions, dict):
                for key in [
                    "KHR_materials_pbrSpecularGlossiness",
                    "KHR_materials_unlit",
                    "KHR_materials_specular",
                    "KHR_materials_clearcoat",
                    "KHR_materials_transmission",
                    "KHR_materials_volume",
                    "KHR_materials_ior",
                    "KHR_materials_emissive_strength",
                ]:
                    extensions.pop(key, None)

                if not extensions:
                    material.pop("extensions", None)

            variants.append(len(materials))
            materials.append(material)

        variants_by_source[source_index] = variants

    for (
        mesh_index,
        primitive_index,
        primitive,
        source_index,
    ) in primitive_references:
        variants = variants_by_source[source_index]

        selection = (
            mesh_index * 131
            + primitive_index * 17
            + source_index * 7
        ) % len(variants)

        primitive["material"] = variants[selection]

    used_extensions = document.setdefault(
        "extensionsUsed",
        [],
    )

    if "KHR_texture_transform" not in used_extensions:
        used_extensions.append(
            "KHR_texture_transform"
        )

    asset = document.setdefault(
        "asset",
        {"version": "2.0"},
    )

    extras = asset.get("extras")

    if not isinstance(extras, dict):
        extras = {}
        asset["extras"] = extras

    extras["utmStonePBR"] = {
        "generator": (
            "scripts/apply-realistic-stone.py"
        ),
        "seed": SEED,
        "textureSize": SIZE,
        "metallicFactor": 0.0,
        "roughnessRange": [
            0.878,
            0.98,
        ],
        "normalScale": 0.40,
        "occlusionStrength": 0.78,
    }

    print()
    print("Original material classification:")

    for index, material in enumerate(
        materials[:original_material_count]
    ):
        state = (
            "STONE"
            if index in stone_materials
            else "PRESERVED"
        )

        print(
            f"  [{index}] {state:9} "
            f"{material.get('name', '(unnamed)')}"
        )

    return (
        len(primitive_references),
        sum(
            len(variants)
            for variants in variants_by_source.values()
        ),
    )


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(
            f"Missing source model: {SOURCE}"
        )

    generate_textures()

    document, binary = load_glb(SOURCE)

    primitive_count, variant_count = apply_materials(
        document,
        binary,
    )

    write_glb(
        OUTPUT,
        document,
        binary,
    )

    print()
    print(
        f"Wrote: {OUTPUT.relative_to(ROOT)}"
    )

    print(
        f"Stone primitives reassigned: "
        f"{primitive_count}"
    )

    print(
        f"Material variants created: "
        f"{variant_count}"
    )

    print("Generated texture assets:")

    for path in [
        ALBEDO,
        NORMAL,
        ROUGHNESS,
        AO,
        ORM,
    ]:
        print(
            f"  {path.relative_to(ROOT)} "
            f"({path.stat().st_size / 1024:.1f} KiB)"
        )

    print(
        f"Final GLB size: "
        f"{OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB"
    )


if __name__ == "__main__":
    main()
