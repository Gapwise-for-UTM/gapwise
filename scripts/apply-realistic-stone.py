#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / "assets/models/utm-entrance-monument-source.glb"
OUTPUT = ROOT / "public/models/utm-entrance-monument.glb"

ALBEDO = ROOT / "assets/textures/utm-stone-albedo.png"
NORMAL = ROOT / "assets/textures/utm-stone-normal.png"
ROUGHNESS = ROOT / "assets/textures/utm-stone-roughness.png"

PRESERVE_KEYWORDS = {
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
    "university of toronto",
    "mississauga",
}

STONE_UV_NAME = "StoneUV"
STONE_MATERIAL_NAME = "UTM Weathered Limestone"


def require(path: Path) -> None:
    if not path.is_file():
        raise RuntimeError(f"Required file does not exist: {path}")


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for datablocks in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def load_image(path: Path, colorspace: str):
    image = bpy.data.images.load(
        str(path),
        check_existing=True,
    )

    image.colorspace_settings.name = colorspace

    # Ensures the exported GLB contains the image rather than referring
    # to a local development path.
    if not image.packed_file:
        image.pack()

    return image


def create_stone_material():
    existing = bpy.data.materials.get(STONE_MATERIAL_NAME)

    if existing:
        bpy.data.materials.remove(existing)

    material = bpy.data.materials.new(STONE_MATERIAL_NAME)
    material.use_nodes = True
    material.diffuse_color = (0.48, 0.47, 0.45, 1.0)
    material.metallic = 0.0
    material.roughness = 0.93

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    output.location = (720, 80)

    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Weathered Limestone"
    principled.location = (430, 80)

    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.93

    specular = principled.inputs.get("Specular IOR Level")
    if specular is None:
        specular = principled.inputs.get("Specular")

    if specular is not None:
        specular.default_value = 0.27

    uv = nodes.new("ShaderNodeUVMap")
    uv.name = "Stone UV"
    uv.uv_map = STONE_UV_NAME
    uv.location = (-820, 100)

    albedo = nodes.new("ShaderNodeTexImage")
    albedo.name = "Stone Albedo"
    albedo.image = load_image(ALBEDO, "sRGB")
    albedo.extension = "REPEAT"
    albedo.interpolation = "Linear"
    albedo.location = (-560, 310)

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = "Stone Normal"
    normal_texture.image = load_image(NORMAL, "Non-Color")
    normal_texture.extension = "REPEAT"
    normal_texture.interpolation = "Linear"
    normal_texture.location = (-560, 20)

    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.name = "Stone Normal Strength"
    normal_map.space = "TANGENT"
    normal_map.inputs["Strength"].default_value = 0.42
    normal_map.location = (120, -60)

    roughness = nodes.new("ShaderNodeTexImage")
    roughness.name = "Stone Roughness"
    roughness.image = load_image(ROUGHNESS, "Non-Color")
    roughness.extension = "REPEAT"
    roughness.interpolation = "Linear"
    roughness.location = (-560, -280)

    links.new(uv.outputs["UV"], albedo.inputs["Vector"])
    links.new(uv.outputs["UV"], normal_texture.inputs["Vector"])
    links.new(uv.outputs["UV"], roughness.inputs["Vector"])

    links.new(albedo.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(roughness.outputs["Color"], principled.inputs["Roughness"])

    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    return material


def material_description(material) -> str:
    if material is None:
        return ""

    pieces = [material.name]

    if material.use_nodes and material.node_tree:
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE" or node.image is None:
                continue

            pieces.extend(
                [
                    node.name,
                    node.image.name,
                    node.image.filepath,
                    node.image.filepath_raw,
                ]
            )

    return " ".join(pieces).lower()


def preserve_material(material) -> bool:
    description = material_description(material)

    return any(
        keyword in description
        for keyword in PRESERVE_KEYWORDS
    )


def deterministic_uv_transform(name: str) -> tuple[float, float, float, float]:
    digest = hashlib.sha256(name.encode("utf-8")).digest()

    offset_x = int.from_bytes(digest[0:2], "little") / 65535.0
    offset_y = int.from_bytes(digest[2:4], "little") / 65535.0

    tile = 1.8 + (digest[4] / 255.0) * 0.9
    angle = math.radians(-8.0 + (digest[5] / 255.0) * 16.0)

    return offset_x, offset_y, tile, angle


def activate_only(obj) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def unwrap_stone_faces(obj, stone_slot_indices: set[int]) -> int:
    activate_only(obj)

    if not obj.data.uv_layers:
        original_uv_name = None
    else:
        original_uv_name = obj.data.uv_layers.active.name

    stone_uv = obj.data.uv_layers.get(STONE_UV_NAME)

    if stone_uv is None:
        stone_uv = obj.data.uv_layers.new(
            name=STONE_UV_NAME,
        )

    obj.data.uv_layers.active = stone_uv
    stone_uv.active_render = True

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")

    mesh = bmesh.from_edit_mesh(obj.data)
    mesh.faces.ensure_lookup_table()

    selected_faces = 0

    for face in mesh.faces:
        selected = face.material_index in stone_slot_indices
        face.select = selected

        if selected:
            selected_faces += 1

    bmesh.update_edit_mesh(
        obj.data,
        loop_triangles=False,
        destructive=False,
    )

    if selected_faces == 0:
        bpy.ops.object.mode_set(mode="OBJECT")
        return 0

    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66.0),
        island_margin=0.025,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )

    mesh = bmesh.from_edit_mesh(obj.data)
    uv_layer = mesh.loops.layers.uv.get(STONE_UV_NAME)

    if uv_layer is None:
        bpy.ops.object.mode_set(mode="OBJECT")
        raise RuntimeError(
            f"Blender failed to create {STONE_UV_NAME} for {obj.name}"
        )

    offset_x, offset_y, tile, angle = deterministic_uv_transform(
        obj.name
    )

    cos_angle = math.cos(angle)
    sin_angle = math.sin(angle)
    center = Vector((0.5, 0.5))
    offset = Vector((offset_x, offset_y))

    for face in mesh.faces:
        if not face.select:
            continue

        for loop in face.loops:
            current = loop[uv_layer].uv - center

            rotated = Vector(
                (
                    current.x * cos_angle - current.y * sin_angle,
                    current.x * sin_angle + current.y * cos_angle,
                )
            )

            loop[uv_layer].uv = rotated * tile + center + offset

    bmesh.update_edit_mesh(
        obj.data,
        loop_triangles=False,
        destructive=False,
    )

    bpy.ops.object.mode_set(mode="OBJECT")

    # Keep the original UV set active for preserved plaque materials.
    # The stone material explicitly references StoneUV.
    if original_uv_name:
        original = obj.data.uv_layers.get(original_uv_name)

        if original is not None:
            obj.data.uv_layers.active = original
            original.active_render = True

    return selected_faces


def process_meshes(stone_material) -> tuple[int, int]:
    processed_objects = 0
    processed_faces = 0

    mesh_objects = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
    ]

    if not mesh_objects:
        raise RuntimeError("Imported GLB contains no mesh objects")

    print("\nMaterial classification:")

    for obj in mesh_objects:
        if len(obj.material_slots) == 0:
            obj.data.materials.append(stone_material)

        stone_slots: set[int] = set()

        for slot_index, slot in enumerate(obj.material_slots):
            material = slot.material

            if preserve_material(material):
                print(
                    f"  preserve: {obj.name} / "
                    f"{material.name if material else '(none)'}"
                )
            else:
                stone_slots.add(slot_index)

        if not stone_slots:
            continue

        selected_faces = unwrap_stone_faces(
            obj,
            stone_slots,
        )

        if selected_faces == 0:
            continue

        for slot_index in stone_slots:
            obj.material_slots[slot_index].material = stone_material

        processed_objects += 1
        processed_faces += selected_faces

        print(
            f"  stone:    {obj.name} — "
            f"{selected_faces} faces"
        )

    if processed_objects == 0:
        raise RuntimeError(
            "No stone mesh objects were identified"
        )

    return processed_objects, processed_faces


def export_glb() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_extras=True,
    )


def main() -> None:
    for path in (
        SOURCE,
        ALBEDO,
        NORMAL,
        ROUGHNESS,
    ):
        require(path)

    reset_scene()

    bpy.ops.import_scene.gltf(
        filepath=str(SOURCE),
    )

    stone_material = create_stone_material()

    object_count, face_count = process_meshes(
        stone_material
    )

    export_glb()

    print()
    print(f"Exported: {OUTPUT}")
    print(f"Stone mesh objects: {object_count}")
    print(f"Stone faces UV-unwrapped: {face_count}")
    print(f"GLB size: {OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB")


main()
