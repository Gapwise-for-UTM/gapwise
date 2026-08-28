"""Dependency-free OpenAPI/Python SDK drift check used by local development and CI."""

import ast
import json
import re
from pathlib import Path

spec = json.loads(Path("public/openapi.json").read_text())
tree = ast.parse(Path("sdk/python/src/gapwise/types.py").read_text())
errors: list[str] = []


def literal_values(node: ast.AST) -> list[str]:
    if (
        isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and node.value.id == "Literal"
    ):
        values = node.slice.elts if isinstance(node.slice, ast.Tuple) else [node.slice]
        return [
            value.value
            for value in values
            if isinstance(value, ast.Constant) and isinstance(value.value, str)
        ]
    return []


aliases = {
    node.targets[0].id: literal_values(node.value)
    for node in tree.body
    if isinstance(node, ast.Assign)
    and len(node.targets) == 1
    and isinstance(node.targets[0], ast.Name)
}
checks = {
    "Term": ("Term", None),
    "Weekday": ("Weekday", None),
    "VerificationStatus": ("Provenance", "verificationStatus"),
    "BuildingCategory": ("Building", "category"),
    "RouteMode": ("RoutePreferencesInput", "mode"),
    "PlaceKind": ("CampusPlace", "kind"),
    "AvailabilityState": ("PlaceAvailability", "state"),
}
for alias, (schema_name, property_name) in checks.items():
    schema = spec["components"]["schemas"][schema_name]
    expected = (
        schema["properties"][property_name]["enum"] if property_name else schema["enum"]
    )
    if aliases.get(alias) != expected:
        errors.append(
            f"Python {alias} enum drifted: expected {expected}; received {aliases.get(alias)}"
        )

client_source = Path("sdk/python/src/gapwise/client.py").read_text()
for method, path in [
    ("GET", "/buildings"),
    ("GET", "/places"),
    ("POST", "/routes"),
    ("POST", "/gaps/plan"),
]:
    if not re.search(rf'"{method}"\s*,\s*"{re.escape(path)}"', client_source):
        errors.append(f"Python SDK no longer exposes canonical operation {method} {path}")

if errors:
    raise SystemExit("Python/OpenAPI conformance failed:\n- " + "\n- ".join(errors))
print("Python/OpenAPI conformance passed: canonical operations and public enums agree.")
