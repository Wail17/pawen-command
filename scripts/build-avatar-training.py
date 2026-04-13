"""Convert the extracted Avatar Training text into a TypeScript constant.

Run from repo root:
    python scripts/build-avatar-training.py

Writes src/lib/avatars/knowledge/evolveAvatarTraining.ts.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "lib" / "avatars" / "knowledge" / "evolve-avatar-training.txt"
OUT = ROOT / "src" / "lib" / "avatars" / "knowledge" / "evolveAvatarTraining.ts"

text = SRC.read_text(encoding="utf-8")

# Escape for template literal: backslash, backtick, ${
escaped = (
    text
    .replace("\\", "\\\\")
    .replace("`", "\\`")
    .replace("${", "\\${")
)

header = (
    "// ============================================================\n"
    "// EVOLVE Avatar Training — methodology doc baked in as a constant\n"
    "// Source: EVOLVE_DOC_Avatar_Training.docx (March 2026)\n"
    "// Used as a cached system-prompt prefix in analyzer + compile phases.\n"
    "// DO NOT edit by hand — regenerate via scripts/build-avatar-training.py.\n"
    "// ============================================================\n\n"
)

ts = header + "export const EVOLVE_AVATAR_TRAINING = `" + escaped + "`;\n"
OUT.write_text(ts, encoding="utf-8")

print(f"WROTE: {OUT}")
print(f"chars: {len(ts)}")
