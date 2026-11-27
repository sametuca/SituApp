// Hafif rüzgâr salınımı: GLB malzemesine tepe-ağırlıklı yatay sallanma ekler (palmiye yaprakları gibi).
// Zaman tek paylaşılan uniform'dur (Sky.jsx her karede WIND.time.value'yu günceller). Instanced mesh'lerde örnek konumu faz verir.
export const WIND = { time: { value: 0 } }

export function applySway(mat, geo, strength = 0.05) {
  if (!mat || !geo || mat.userData.sway) return
  mat.userData.sway = true
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox
  const span = Math.max(1e-3, max.y - min.y)
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r)
    sh.uniforms.uWindT = WIND.time
    sh.uniforms.uWindY = { value: min.y }
    sh.uniforms.uWindSpan = { value: span }
    sh.uniforms.uWindAmp = { value: span * strength }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT;\nuniform float uWindY;\nuniform float uWindSpan;\nuniform float uWindAmp;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float wh = clamp((position.y - uWindY) / uWindSpan, 0.0, 1.0);
        wh *= wh;
        #ifdef USE_INSTANCING
          float wph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #else
          float wph = 0.0;
        #endif
        transformed.x += sin(uWindT * 1.3 + wph + position.y * 0.6) * uWindAmp * wh;
        transformed.z += sin(uWindT * 1.0 + wph * 1.3 + position.x * 0.5) * uWindAmp * 0.6 * wh;
      }`,
    )
  }
  const key = mat.customProgramCacheKey?.bind(mat)
  mat.customProgramCacheKey = () => `${key ? key() : ''}|sway`
  mat.needsUpdate = true
}

export const isSwayModel = (model) => /palm/i.test(model)
