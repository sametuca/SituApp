import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing'

export default function GraphicsEffects({ ao = true, bloom = true }) {
  if (!ao && !bloom) return null

  return (
    <EffectComposer multisampling={0} resolutionScale={0.75}>
      {ao && (
        <N8AO
          aoRadius={0.8}
          distanceFalloff={1.1}
          intensity={1.05}
          quality="performance"
          halfRes
        />
      )}
      {bloom && (
        <Bloom
          intensity={0.16}
          luminanceThreshold={1.25}
          luminanceSmoothing={0.35}
          mipmapBlur
          radius={0.72}
        />
      )}
    </EffectComposer>
  )
}
