#!/usr/bin/env python3
"""Augment a staged character GLB with real animation clips (headless Blender).

Takes a staged chunky character source (mesh + Rig_Medium, no clips) and a
donor KayKit animation GLB, keeps only the requested actions, binds them to
the staged rig as NLA strips, deletes the donor mannequin, and re-exports
over the staged file (caller must back it up first).

Usage (from repo root, Blender headless):
  blender -b -P scripts/dev-rig/c1-augment.py -- <staged.glb> <clip.glb> <actions_csv>

Blender 5.x notes: layered actions need slot handles (assign_action), and the
glTF exporter only carries actions bound as NLA strips (loose actions whose
slots died with the donor armature are dropped).
"""
import sys
import bpy


def parse_args():
    argv = sys.argv
    if '--' not in argv:
        raise SystemExit('Usage: blender -b -P c1-augment.py -- <staged.glb> <clip.glb> <actions_csv>')
    args = argv[argv.index('--') + 1:]
    if len(args) != 3:
        raise SystemExit('Expected 3 arguments: staged.glb clip.glb actions_csv')
    return args[0], args[1], [a.strip() for a in args[2].split(',') if a.strip()]


def main():
    staged_glb, clip_glb, keep = parse_args()

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    bpy.ops.import_scene.gltf(filepath=staged_glb)
    staged = list(bpy.data.objects)
    rigs = [o for o in staged if o.type == 'ARMATURE']
    if len(rigs) != 1:
        raise SystemExit(f'Expected 1 armature in staged file, found {len(rigs)}')
    rig = rigs[0]

    bpy.ops.import_scene.gltf(filepath=clip_glb)
    donor = [o for o in bpy.data.objects if o not in staged]
    print('donor actions:', sorted(a.name for a in bpy.data.actions))

    for act in list(bpy.data.actions):
        if act.name not in keep:
            bpy.data.actions.remove(act)
    kept = list(bpy.data.actions)
    if not kept:
        raise SystemExit('No requested actions found in clip')
    print('keeping:', sorted(a.name for a in kept))

    if rig.animation_data is None:
        rig.animation_data_create()
    for act in kept:
        track = rig.animation_data.nla_tracks.new()
        track.name = act.name
        track.strips.new(act.name, 0, act)

    bpy.ops.object.select_all(action='DESELECT')
    for o in donor:
        o.select_set(True)
    bpy.ops.object.delete()

    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=staged_glb,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_animations=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )
    print(f'augmented {staged_glb}')


if __name__ == '__main__':
    main()
