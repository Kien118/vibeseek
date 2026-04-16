'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'
import { Color } from 'three'

interface FloatingPlaneProps {
  isHovered: boolean
  isDragActive: boolean
  hasFile: boolean
}

function isMeshStandardMaterial(material: unknown): material is MeshStandardMaterial {
  return Boolean(
    material &&
    typeof material === 'object' &&
    'emissive' in material &&
    'emissiveIntensity' in material
  )
}

export default function FloatingPlane({ isHovered, isDragActive, hasFile }: FloatingPlaneProps) {
  const planeRef = useRef<Mesh>(null)

  const colors = useMemo(
    () => ({
      idle: new Color('#8b5cf6'),
      hover: new Color('#c084fc'),
      drag: new Color('#22d3ee'),
      done: new Color('#34d399'),
    }),
    []
  )

  useFrame((state) => {
    if (!planeRef.current) return

    const t = state.clock.elapsedTime
    const baseY = 0.75
    const floatAmp = isDragActive ? 0.18 : 0.1

    planeRef.current.position.y = baseY + Math.sin(t * 1.4) * floatAmp
    planeRef.current.rotation.x = Math.sin(t * 0.45) * 0.05
    planeRef.current.rotation.z = Math.sin(t * 0.75) * 0.04

    const targetScale = isDragActive ? 1.08 : isHovered ? 1.04 : 1
    planeRef.current.scale.x += (targetScale - planeRef.current.scale.x) * 0.08
    planeRef.current.scale.y += (targetScale - planeRef.current.scale.y) * 0.08
    planeRef.current.scale.z += (targetScale - planeRef.current.scale.z) * 0.08

    const material = planeRef.current.material
    if (!Array.isArray(material) && isMeshStandardMaterial(material)) {
      const targetEmissive = hasFile
        ? colors.done
        : isDragActive
          ? colors.drag
          : isHovered
            ? colors.hover
            : colors.idle
      material.emissive.lerp(targetEmissive, 0.09)
      material.emissiveIntensity = isDragActive ? 1.3 : isHovered ? 0.9 : 0.55
    }
  })

  return (
    <mesh ref={planeRef} castShadow receiveShadow>
      <boxGeometry args={[2.4, 1.5, 0.09]} />
      <meshStandardMaterial color="#111827" roughness={0.28} metalness={0.35} emissive={colors.idle} emissiveIntensity={0.55} />
    </mesh>
  )
}
