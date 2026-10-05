# Actual Mixar Building Pilot Implementation Plan

**Goal:** Display the actual Game Assets manor, cottage, and forge models in the existing game, across their six existing tiers.

**Architecture:** Export source architecture only from Mixar using world-baked copies. Convert each GLB node offline to the existing flat-face JSON format, resolve the linear palette to sRGB, preserve emission, uniformly fit XYZ to the current footprint, and retain source hashes. Load through the existing manifest/preloader. A dedicated complete-building adapter replaces only ready buildings when validated assets are available; missing, disabled, invalid, ruined, or unfinished cases retain procedural art. No partial-face LOD for buildings.

**Spec:** The user-approved pilot in chat, scoped under `docs/superpowers/specs/2026-10-04-midnights-manner-art-integration-design.md`.

## Constraints
- Work only in the OneDrive checkout. Preserve other contributors' changes and the source Mixar project.
- No game IDs, tiers, footprints, collision, gameplay rules, dependencies at runtime, save fields, or version changes.
- Three families only until the actual pilot is visually reviewed. Other catalog assets and character animation are not claimed integrated.
- Existing 800/1400 embellishment ceilings remain; complete bodies have a separate measured budget and complete procedural fallback.
- Keep practical lighting attached to imported geometry, picking ownership, night shading, production readouts, and static-cache reuse.
- No commit, push, or deployment without a separate user request.

## Tasks
1. Export the 18 actual architecture objects as a verified GLB package. Exclude display-ground meshes. Record source names and linear palette encoding.
2. Add failing offline-converter tests for normalization, winding, colors, emission, coplanar merge, and unsupported input. Implement the smallest converter that passes; generate complete face JSON files and source provenance.
3. Add failing runtime tests for loaded/missing/disabled/malformed assets, full orbit, distant complete geometry, lights, ownership, budgets, ruins/scaffolds, no save mutation, and cache reuse. Extend the existing manifest loader and insert a complete-body branch before procedural generation.
4. Run focused tests, full `npm test`, build, browser smoke, and actual game captures. Compare source appearance with exported appearance. Open a local playable pilot and a comparison image. Report measured budgets and any gaps honestly.
