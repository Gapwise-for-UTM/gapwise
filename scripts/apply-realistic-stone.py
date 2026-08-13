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



PLAQUE_TEXT = "UNIVERSITY OF TORONTO MISSISSAUGA"
PLAQUE_LETTER_MATERIAL = "UTM Plaque Lettering"

PLAQUE_IDENTIFIERS = {
    "plaque",
    "letter",
    "lettering",
    "sign",
    "inscription",
    "university of toronto",
    "mississauga",
}


def bounds_from_points(points):
    if not points:
        raise RuntimeError("Cannot calculate bounds from an empty point list")

    minimum = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )

    maximum = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )

    return minimum, maximum


def world_bounds(obj):
    return bounds_from_points(
        [
            obj.matrix_world @ Vector(corner)
            for corner in obj.bound_box
        ]
    )


def material_is_plaque(material) -> bool:
    if material is None:
        return False

    description = material_description(material)

    return any(
        identifier in description
        for identifier in PLAQUE_IDENTIFIERS
    )


def scene_mesh_bounds():
    objects = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
    ]

    if not objects:
        raise RuntimeError("Scene contains no mesh objects")

    points = []

    for obj in objects:
        points.extend(
            obj.matrix_world @ Vector(corner)
            for corner in obj.bound_box
        )

    return bounds_from_points(points)


def plaque_face_regions():
    regions = []

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue

        plaque_slots = {
            index
            for index, slot in enumerate(obj.material_slots)
            if material_is_plaque(slot.material)
        }

        if not plaque_slots:
            continue

        points = []

        for polygon in obj.data.polygons:
            if polygon.material_index not in plaque_slots:
                continue

            points.extend(
                obj.matrix_world @ obj.data.vertices[index].co
                for index in polygon.vertices
            )

        if points:
            minimum, maximum = bounds_from_points(points)
            width = maximum.x - minimum.x

            regions.append(
                (
                    width,
                    minimum,
                    maximum,
                    f"{obj.name} plaque-material faces",
                )
            )

    return regions


def geometric_plaque_regions():
    scene_minimum, scene_maximum = scene_mesh_bounds()
    scene_dimensions = scene_maximum - scene_minimum
    scene_center_x = (scene_minimum.x + scene_maximum.x) * 0.5

    scene_width = max(scene_dimensions.x, 1e-6)
    scene_height = max(scene_dimensions.z, 1e-6)
    scene_depth = max(scene_dimensions.y, 1e-6)

    regions = []

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue

        minimum, maximum = world_bounds(obj)
        dimensions = maximum - minimum
        center = (minimum + maximum) * 0.5

        width_ratio = dimensions.x / scene_width
        height_ratio = dimensions.z / scene_height
        depth_ratio = dimensions.y / scene_depth

        vertical_position = (
            center.z - scene_minimum.z
        ) / scene_height

        aspect_ratio = dimensions.x / max(
            dimensions.z,
            1e-6,
        )

        if width_ratio < 0.34:
            continue

        if height_ratio > 0.18:
            continue

        if vertical_position > 0.50:
            continue

        if aspect_ratio < 5.0:
            continue

        centering = abs(
            center.x - scene_center_x
        ) / scene_width

        preferred_height = abs(
            vertical_position - 0.27
        )

        description = (
            obj.name
            + " "
            + " ".join(
                material_description(slot.material)
                for slot in obj.material_slots
                if slot.material is not None
            )
        ).lower()

        explicit_bonus = (
            100.0
            if any(
                identifier in description
                for identifier in PLAQUE_IDENTIFIERS
            )
            else 0.0
        )

        score = (
            explicit_bonus
            + width_ratio * 12.0
            + min(aspect_ratio, 20.0) * 0.35
            - height_ratio * 6.0
            - depth_ratio * 1.5
            - preferred_height * 7.0
            - centering * 6.0
        )

        regions.append(
            (
                score,
                minimum,
                maximum,
                f"{obj.name} geometric candidate",
            )
        )

    return regions


def find_plaque_bounds():
    material_regions = plaque_face_regions()

    if material_regions:
        _, minimum, maximum, label = max(
            material_regions,
            key=lambda region: region[0],
        )

        print(f"Plaque selected from material: {label}")
        return minimum, maximum

    geometric_regions = geometric_plaque_regions()

    if not geometric_regions:
        raise RuntimeError(
            "Could not locate the monument plaque automatically"
        )

    _, minimum, maximum, label = max(
        geometric_regions,
        key=lambda region: region[0],
    )

    print(f"Plaque selected geometrically: {label}")
    return minimum, maximum


def plaque_font():
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerifCondensed.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSerif.ttf",
    ]

    for candidate in candidates:
        font_path = Path(candidate)

        if font_path.is_file():
            print(f"Using plaque font: {font_path}")
            return bpy.data.fonts.load(str(font_path))

    print("No external serif font found; using Blender's built-in font")
    return None


def create_plaque_letter_material():
    existing = bpy.data.materials.get(
        PLAQUE_LETTER_MATERIAL
    )

    if existing is not None:
        bpy.data.materials.remove(existing)

    material = bpy.data.materials.new(
        PLAQUE_LETTER_MATERIAL
    )

    material.use_nodes = True
    material.diffuse_color = (
        0.008,
        0.018,
        0.075,
        1.0,
    )

    material.metallic = 0.0
    material.roughness = 0.58

    principled = material.node_tree.nodes.get(
        "Principled BSDF"
    )

    if principled is not None:
        principled.inputs["Base Color"].default_value = (
            0.008,
            0.018,
            0.075,
            1.0,
        )

        principled.inputs["Metallic"].default_value = 0.0
        principled.inputs["Roughness"].default_value = 0.58

    return material


def add_plaque_lettering():
    plaque_minimum, plaque_maximum = find_plaque_bounds()

    plaque_dimensions = plaque_maximum - plaque_minimum
    plaque_center = (
        plaque_minimum + plaque_maximum
    ) * 0.5

    plaque_width = plaque_dimensions.x
    plaque_height = plaque_dimensions.z
    plaque_depth = max(plaque_dimensions.y, 1e-6)

    if plaque_width <= 0 or plaque_height <= 0:
        raise RuntimeError(
            "Detected plaque has invalid dimensions"
        )

    curve = bpy.data.curves.new(
        "UTM Plaque Lettering Curve",
        type="FONT",
    )

    curve.body = PLAQUE_TEXT
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.fill_mode = "BOTH"
    curve.size = 1.0
    curve.space_character = 1.025
    curve.resolution_u = 8
    curve.extrude = 0.018
    curve.bevel_depth = 0.0018
    curve.bevel_resolution = 2

    selected_font = plaque_font()

    if selected_font is not None:
        curve.font = selected_font

    lettering = bpy.data.objects.new(
        "UTM Plaque Lettering Front",
        curve,
    )

    bpy.context.collection.objects.link(lettering)

    lettering.data.materials.append(
        create_plaque_letter_material()
    )

    # Blender's imported monument faces forward along -Y.
    # A +90 degree X rotation places the lettering vertically,
    # facing the same direction as the model-viewer's initial view.
    lettering.rotation_euler = (
        math.radians(90.0),
        0.0,
        0.0,
    )

    surface_gap = max(
        plaque_depth * 0.018,
        plaque_width * 0.00055,
    )

    lettering.location = (
        plaque_center.x,
        plaque_minimum.y - surface_gap,
        plaque_center.z,
    )

    bpy.context.view_layer.update()

    text_minimum, text_maximum = world_bounds(lettering)
    text_dimensions = text_maximum - text_minimum

    target_width = plaque_width * 0.84
    target_height = plaque_height * 0.39

    scale = min(
        target_width / max(text_dimensions.x, 1e-6),
        target_height / max(text_dimensions.z, 1e-6),
    )

    lettering.scale = (
        scale,
        scale,
        scale,
    )

    bpy.context.view_layer.update()

    text_minimum, text_maximum = world_bounds(lettering)
    text_center = (
        text_minimum + text_maximum
    ) * 0.5

    lettering.location.x += (
        plaque_center.x - text_center.x
    )

    lettering.location.z += (
        plaque_center.z - text_center.z
    )

    lettering.location.y = (
        plaque_minimum.y - surface_gap
    )

    lettering["plaqueText"] = PLAQUE_TEXT
    lettering["generatedBy"] = (
        "scripts/apply-realistic-stone.py"
    )

    bpy.context.view_layer.update()

    activate_only(lettering)
    bpy.ops.object.convert(target="MESH")

    lettering = bpy.context.active_object
    lettering.name = "UTM Plaque Lettering Front"
    lettering.data.name = "UTM Plaque Lettering Mesh"

    activate_only(lettering)
    bpy.ops.object.transform_apply(
        location=False,
        rotation=False,
        scale=True,
    )

    final_minimum, final_maximum = world_bounds(lettering)
    final_dimensions = final_maximum - final_minimum

    print()
    print(f'Added plaque lettering: "{PLAQUE_TEXT}"')
    print(
        "Lettering dimensions: "
        f"{final_dimensions.x:.4f} × "
        f"{final_dimensions.z:.4f}"
    )
    print(
        "Plaque dimensions: "
        f"{plaque_width:.4f} × "
        f"{plaque_height:.4f}"
    )


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

    # The source model already contains the photographed plaque label. Preserve
    # that single layer instead of adding a second text mesh over it.

    export_glb()

    print()
    print(f"Exported: {OUTPUT}")
    print(f"Stone mesh objects: {object_count}")
    print(f"Stone faces UV-unwrapped: {face_count}")
    print(f"GLB size: {OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB")


main()
