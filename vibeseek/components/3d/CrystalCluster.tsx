import * as THREE from 'three'
import React from 'react'
import { useGLTF } from '@react-three/drei'
import { GroupProps, useFrame } from '@react-three/fiber'
import { GLTF } from 'three-stdlib'
import { QuizResult } from '@/components/3d/types'

type GLTFResult = GLTF & {
  nodes: {
    Object_2: THREE.Mesh
  }
  materials: {
    wire_087224198: THREE.MeshStandardMaterial
  }
}

interface CrystalClusterProps extends GroupProps {
  burst: number
  focus: number
  reward: number
  crystalZ: number
  quizResult: QuizResult
}

export default function CrystalCluster({
  burst,
  focus,
  reward,
  crystalZ,
  quizResult,
  ...props
}: CrystalClusterProps) {
  const groupRef = React.useRef<THREE.Group>(null)
  const { nodes, materials } = useGLTF('/models/magic_crystals.glb') as GLTFResult

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const elapsed = state.clock.getElapsedTime()
    group.rotation.y += 0.004 + burst * 0.01
    group.rotation.x = Math.sin(elapsed * 0.7) * 0.08
    group.position.z = crystalZ + reward * 8
    const scale = 0.45 + focus * 0.35 + burst * 0.2
    group.scale.setScalar(scale)
  })

  materials.wire_087224198.color.set(
    quizResult === 'correct' ? '#2dd4bf' : quizResult === 'wrong' ? '#ef4444' : '#a855f7'
  )
  materials.wire_087224198.emissive.set(
    quizResult === 'correct' ? '#2dd4bf' : quizResult === 'wrong' ? '#f87171' : '#7e22ce'
  )
  materials.wire_087224198.emissiveIntensity = 0.4 + burst * 0.8

  return (
    <group ref={groupRef} {...props} dispose={null}>
      <mesh geometry={nodes.Object_2.geometry} material={materials.wire_087224198} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  )
}

useGLTF.preload('/models/magic_crystals.glb')
