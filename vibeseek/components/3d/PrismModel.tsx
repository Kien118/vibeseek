import * as THREE from 'three'
import React from 'react'
import { MeshTransmissionMaterial, useGLTF, useAnimations } from '@react-three/drei'
import { GroupProps } from '@react-three/fiber'
import { GLTF } from 'three-stdlib'

type ActionName = 'Action' | 'SolidAction'

interface GLTFAction extends THREE.AnimationClip {
  name: ActionName
}

type GLTFResult = GLTF & {
  nodes: {
    Object_4: THREE.Mesh
    Object_7: THREE.Mesh
    Object_8: THREE.Mesh
    Object_10: THREE.Mesh
  }
  materials: {
    outer: THREE.MeshStandardMaterial
    glas: THREE.MeshPhysicalMaterial
    deko: THREE.MeshStandardMaterial
    lamp: THREE.MeshStandardMaterial
  }
  animations: GLTFAction[]
}

export default function PrismModel(props: GroupProps) {
  const group = React.useRef<THREE.Group>(null)
  const { nodes, materials, animations } = useGLTF('/models/a_circled_dodecahedron.glb') as GLTFResult
  const { actions } = useAnimations(animations, group)

  React.useEffect(() => {
    actions.Action?.play()
    actions.SolidAction?.play()
  }, [actions])

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Sketchfab_Scene">
        <group name="GLTF_SceneRootNode">
          <group name="Solid_2" position={[0, 1.069, 0]}>
            <mesh name="Object_4" geometry={nodes.Object_4.geometry} material={materials.outer} />
            <mesh name="Object_7" geometry={nodes.Object_7.geometry}>
              <MeshTransmissionMaterial
                backside
                thickness={0.45}
                roughness={0.05}
                chromaticAberration={0.04}
                ior={1.45}
                transmission={1}
                clearcoat={1}
                clearcoatRoughness={0.08}
                distortion={0.1}
                distortionScale={0.15}
                color="#b794ff"
              />
            </mesh>
            <mesh name="Object_8" geometry={nodes.Object_8.geometry} material={materials.deko} />
            <mesh name="Object_10" geometry={nodes.Object_10.geometry} material={materials.lamp} />
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/a_circled_dodecahedron.glb')
