#!/usr/bin/env python3
"""Headless Blender retarget: copy world-space bone matrices from a donor clip onto a worker rig.

Usage (from repo root, Blender headless):
  blender -b -P scripts/dev-rig/c1-combat-retarget.py -- \
    <worker.blend> <clip.glb> <out_glb> <actions_csv>

Example:
  blender -b -P scripts/dev-rig/c1-combat-retarget.py -- \
    worker.blend Rig_Medium_CombatMelee.glb out/combat 0,3,7,12,18

Inputs (all absolute paths supplied by caller):
  worker_blend   .blend containing the worker character meshes + Rig_Medium armature
  clip_glb       donor animation GLB (e.g., staged melee clip) with its own Rig_Medium
  out_prefix     output path prefix (directory must exist), e.g. build/poses/combat
  frames_csv     comma-separated frame numbers to export, e.g. "0,3,7,12,18"

Outputs:
  - Prints available action names from the clip to stdout (one per line)
  - Writes out_prefix-frameNNN-posed.glb for each frame containing ONLY the
    worker meshes + worker armature (donor mannequin excluded)

Conventions (from rebuild_baked_r3.py + bake_poses.py):
  - glTF right-handed Y-up -> game right-handed Z-up: (x, -z, y)
  - Mirror-X fix for adventurers-hd/skeletons-hd exports: negate X, swap winding
    (vertex 1 <-> 2) so normals survive. This script exports raw GLB; the mirror
    is applied later by the bake pipeline if the worker blend is an HD export.
  - No runtime deps; headless bpy only.
"""
import sys
import bpy
import mathutils


def parse_args():
    """Parse arguments passed after '--' in blender -P invocation."""
    argv = sys.argv
    if '--' not in argv:
        raise SystemExit('Usage: blender -b -P script.py -- <worker_blend> <clip_glb> <out_prefix> <frames_csv> [action]')
    idx = argv.index('--')
    args = argv[idx + 1:]
    if len(args) not in (4, 5):
        raise SystemExit('Expected 4-5 arguments: worker_blend clip_glb out_prefix frames_csv [action]')
    action = args[4] if len(args) == 5 else None
    return args[0], args[1], args[2], args[3], action


def clear_scene():
    """Remove all objects, meshes, armatures, actions from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        bpy.data.armatures.remove(block)
    for block in bpy.data.actions:
        bpy.data.actions.remove(block)


def load_worker(worker_blend):
    """Load worker .blend, return (armature_obj, mesh_objects_list)."""
    with bpy.data.libraries.load(worker_blend, link=False) as (data_from, data_to):
        data_to.objects = [name for name in data_from.objects]
    for obj in data_to.objects:
        bpy.context.collection.objects.link(obj)
    armature = None
    meshes = []
    for obj in data_to.objects:
        if obj.type == 'ARMATURE' and obj.name == 'Rig_Medium':
            armature = obj
        elif obj.type == 'MESH':
            meshes.append(obj)
    if armature is None:
        raise SystemExit('Worker blend must contain a Rig_Medium armature')
    meshes = [m for m in meshes if m.parent == armature]
    return armature, meshes


def import_clip(clip_glb):
    """Import donor GLB, return (armature_obj, action_list)."""
    bpy.ops.import_scene.gltf(filepath=clip_glb)
    donor_armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            donor_armature = obj
            break
    if donor_armature is None:
        raise SystemExit('Clip GLB must contain an armature')
    actions = []
    if donor_armature.animation_data and donor_armature.animation_data.action:
        actions.append(donor_armature.animation_data.action.name)
    for action in bpy.data.actions:
        if action.name not in actions:
            actions.append(action.name)
    return donor_armature, actions


def assign_action(obj, action):
    """Assign a (possibly layered, Blender 4.4+) action plus its slot.
    Without the slot handle, the action silently does not drive the rig."""
    if obj.animation_data is None:
        obj.animation_data_create()
    obj.animation_data.action = action
    slot = None
    for s in action.slots:
        if getattr(s, 'name_display', '') in (obj.name, obj.data.name):
            slot = s
            break
    if slot is None and len(action.slots) == 1:
        slot = action.slots[0]
    if slot is None:
        raise SystemExit(f'No action slot for {obj.name} in {action.name}')
    obj.animation_data.action_slot = slot
    print(f'slot {slot.name_display} -> {obj.name}')


def copy_bone_matrices(worker_arm, donor_arm, frame, action):
    """Drive the worker rig with the donor action (identical Rig_Medium
    hierarchy), snapshot the evaluated pose, then clear the action and write
    the snapshot as a static pose. The action must already be assigned (with
    slot) by the caller, once, before the frame loop. Deterministic."""
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    snap = {b.name: worker_arm.pose.bones[b.name].matrix.copy()
            for b in worker_arm.pose.bones}
    worker_arm.animation_data.action = None
    for bone in worker_arm.pose.bones:
        bone.matrix = snap[bone.name]
    bpy.context.view_layer.update()


def export_frame(worker_arm, worker_meshes, out_path):
    """Export ONLY worker armature + meshes as GLB."""
    bpy.ops.object.select_all(action='DESELECT')
    worker_arm.select_set(True)
    for m in worker_meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = worker_arm
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_animations=False,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )


def main():
    worker_blend, clip_glb, out_path, actions_csv, _want = parse_args()
    keep = [a.strip() for a in actions_csv.split(',') if a.strip()]

    clear_scene()
    worker_arm, worker_meshes = load_worker(worker_blend)
    donor_arm, actions = import_clip(clip_glb)

    for action_name in actions:
        print(action_name)

    # Drop every action except the requested combat clips.
    for act in list(bpy.data.actions):
        if act.name not in keep:
            bpy.data.actions.remove(act)
    for act in bpy.data.actions:
        print(f'keeping {act.name} ({len(act.slots)} slots)')

    # Bind the kept clips to the worker rig as NLA strips so the exporter
    # carries them as glTF animations (loose actions with dead donor slots
    # are dropped).
    if worker_arm.animation_data is None:
        worker_arm.animation_data_create()
    for act in list(bpy.data.actions):
        track = worker_arm.animation_data.nla_tracks.new()
        track.name = act.name
        track.strips.new(act.name, 0, act)
        print(f'stripped {act.name}')

    # Remove the donor mannequin: keep only the worker armature + meshes.
    bpy.ops.object.select_all(action='DESELECT')
    donor_meshes = [o for o in bpy.data.objects
                    if o.type == 'MESH' and o not in worker_meshes]
    for o in donor_meshes:
        o.select_set(True)
    donor_arm.select_set(True)
    bpy.ops.object.delete()

    bpy.ops.object.select_all(action='DESELECT')
    worker_arm.select_set(True)
    for m in worker_meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = worker_arm
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_animations=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )
    print(f'exported {out_path}')


if __name__ == '__main__':
    main()