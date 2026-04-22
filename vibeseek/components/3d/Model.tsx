'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useScroll } from '@react-three/drei'
import { Group, MathUtils, Mesh, Object3D } from 'three'
import { GLTF } from 'three-stdlib'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GLTFResult = GLTF & {
  nodes: {
    DOJO_Head: Mesh
    DOJO_Body: Mesh
  }
  scene: Group
}

// ---------------------------------------------------------------------------
// Helper – generic mesh/node finder (walks the whole scene graph)
// ---------------------------------------------------------------------------

function findNodeByName(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null
  root.traverse((child) => {
    if (found) return
    if (child.name === name) found = child
  })
  return found
}

/** Dev helper – prints every node name so you can verify GLB mesh names */
function logAllNodes(root: Object3D) {
  const names: string[] = []
  root.traverse((child) => {
    if (child.name) names.push(`[${child.type}] ${child.name}`)
  })
  console.table(names)
}

// ---------------------------------------------------------------------------
// Clamp limit – 45° in radians
// ---------------------------------------------------------------------------

const MAX_ANGLE = MathUtils.degToRad(45) // ≈ 0.785 rad

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Model() {
  const groupRef = useRef<Group | null>(null)
  const scroll   = useScroll()

  /**
   * We keep a ref to DOJO_Head so useFrame never triggers a re-render.
   * headRef is populated once the scene loads (useEffect).
   */
  const headRef = useRef<Object3D | null>(null)

  /**
   * Rest rotation – the baked-in orientation the head has straight from the
   * GLB export. We store it once on mount and always offset from it so the
   * robot looks forward at rest, regardless of how Blender exported the mesh.
   */
  const restRotX = useRef(0)
  const restRotY = useRef(0)
  const restRotZ = useRef(0)

  /**
   * Smooth-target values accumulate between frames.
   * Using refs (not state) keeps this outside React's render cycle.
   */
  const targetRotX = useRef(0)
  const targetRotY = useRef(0)

  // Load the DOJO model -------------------------------------------------------
  const { scene } = useGLTF('/models/DOJO.glb') as unknown as GLTFResult

  // Locate DOJO_Head once the scene is ready -----------------------------------
  useEffect(() => {
    const head = findNodeByName(scene, 'DOJO_Head')

    if (!head) {
      console.warn(
        '[Model] ⚠ Could not find a node named "DOJO_Head" in the scene.\n' +
          'All nodes found in the GLB are listed below ↓',
      )
      logAllNodes(scene)
    } else {
      // Capture the baked-in rest rotation so useFrame can offset from it.
      // This ensures the head faces forward even if Blender exported it sideways.
      restRotX.current = head.rotation.x
      restRotY.current = head.rotation.y
      restRotZ.current = head.rotation.z

      // Sync the lerp targets to the rest pose so the first frame
      // doesn't snap from (0,0) to the rest rotation.
      targetRotX.current = head.rotation.x
      targetRotY.current = head.rotation.y
    }

    headRef.current = head
  }, [scene])

  // Per-frame head tracking ----------------------------------------------------
  useFrame((state) => {
    const head = headRef.current
    if (!head) return

    /**
     * state.mouse is normalised device coordinates: x ∈ [-1, 1], y ∈ [-1, 1].
     *
     * Mapping:
     *   mouse.x  → Y-axis rotation  (look left / right)
     *   mouse.y  → X-axis rotation  (look up / down)
     *
     * We negate mouse.y because in Three.js a positive X rotation tilts the
     * head downward, but a positive mouse.y means the cursor is above centre.
     */
    // Mouse delta relative to the rest pose (not absolute world rotation)
    const deltaY = state.mouse.x * MAX_ANGLE   // look left / right
    const deltaX = -state.mouse.y * MAX_ANGLE  // look up / down (axis inverted)

    // Clamp the DELTA so the head never drifts more than ±45° from rest
    targetRotY.current = restRotY.current + MathUtils.clamp(deltaY, -MAX_ANGLE, MAX_ANGLE)
    targetRotX.current = restRotX.current + MathUtils.clamp(deltaX, -MAX_ANGLE, MAX_ANGLE)

    /**
     * lerp factor 0.08 → ~10–12 frames to reach 90% of the target at 60 fps.
     * Increase for a snappier feel, decrease for more lag/smoothness.
     */
    const LERP_FACTOR = 0.08

    head.rotation.y = MathUtils.lerp(head.rotation.y, targetRotY.current, LERP_FACTOR)
    head.rotation.x = MathUtils.lerp(head.rotation.x, targetRotX.current, LERP_FACTOR)
    // Z is never touched by mouse — keep the baked-in Z tilt exactly as exported
    head.rotation.z = restRotZ.current
  })

  // Scroll-driven group animation -----------------------------------------------
  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const p = scroll.offset // 0 = top of page, 1 = bottom

    /**
     * P-513b 2026-04-23 (second tune): user feedback "full head visible at
     * top + model position goes DOWN on scroll + full body visible at bottom".
     *
     * Top (p=0):    scale=5.0, y=-7.0 → full head + shoulders with camera
     *               lookY=1.8. Model head_world ≈ 5*1.75 - 7 = 1.75 visible.
     * Bottom (p=1): scale=1.8, y=-8.5 → model shrinks + drifts DOWN. Combined
     *               with camera z=5.0 pull-back, lookY=-0.5, fov=65° wide —
     *               full body visible in frame.
     *
     * Y DIRECTION FLIPPED: -7.0 → -8.5 (decreases = model moves DOWN as
     * scroll increases, per user "xuống theo" request).
     */
    const EASE = 0.07

    const targetScale = MathUtils.lerp(5.0, 1.8, p)
    group.scale.setScalar(MathUtils.lerp(group.scale.x, targetScale, EASE))

    const targetX = MathUtils.lerp(0, 1.0, p)
    group.position.x = MathUtils.lerp(group.position.x, targetX, EASE)

    const targetY = MathUtils.lerp(-7.0, -8.5, p)
    group.position.y = MathUtils.lerp(group.position.y, targetY, EASE)

    // Rotate the whole robot ~45° counter-clockwise so it faces left (toward text)
    const targetRotY = MathUtils.lerp(0, -Math.PI * 0.25, p)
    group.rotation.y = MathUtils.lerp(group.rotation.y, targetRotY, EASE)
  })

  // Render ---------------------------------------------------------------------
  return (
    /**
     * Adjust position/scale to taste once you see the model in-scene.
     * position-y: -1.35 keeps the robot's feet near the bottom of the viewport
     * at the default camera position used in Experience.tsx.
     */
    <group ref={groupRef} position={[0, 0, 0]}>
      <primitive object={scene} />
    </group>
  )
}

// Preload so the asset starts downloading before the component mounts
// ⚠ Make sure DOJO.glb is placed at:  public/models/DOJO.glb
useGLTF.preload('/models/DOJO.glb')
