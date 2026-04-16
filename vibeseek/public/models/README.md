Place the source assets here:

- `a_circled_dodecahedron.glb`
- `magic_crystals.glb`

Generate React components after adding the files:

```bash
npx gltfjsx public/models/a_circled_dodecahedron.glb -o components/3d/PrismModel.tsx -T -t
npx gltfjsx public/models/magic_crystals.glb -o components/3d/CrystalCluster.tsx -T -t
```
