// Unisex palet: 3D sahnedeki pembe/magenta tonları (GLB dokuları dahil) sıcak turuncu-amber tonuna çevirilir. Tüm MeshStandard/Basic malzemeler
// ortak shader yaması alır (map_fragment/color_fragment sonrası). Ten rengi (turuncu tonlar) ve diğer renkler etkilenmez.
// Kapatmak için materyal.userData.keepHue = true. Arayüz renkleri için: scripts/unisex-colors.py.
import { Material } from 'three'

const GLSL = /* glsl */ `
vec3 unisexRgb2hsv(vec3 c){
  vec4 K=vec4(0.,-1./3.,2./3.,-1.);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y); float e=1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);
}
vec3 unisexHsv2rgb(vec3 c){
  vec4 K=vec4(1.,2./3.,1./3.,3.);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);
}
vec3 unisexRemap(vec3 col){
  vec3 h=unisexRgb2hsv(col);
  float hp=h.x>0.8?h.x-1.0:h.x;                       // pembe/magenta bölgesi: -0.2 … 0
  float w=smoothstep(-0.26,-0.20,hp)*(1.0-smoothstep(-0.035,0.0,hp))*smoothstep(0.10,0.22,h.y);
  float nh=0.085+(hp+0.07)*0.25;                       // 336° → ~31° (sıcak turuncu-amber)
  vec3 out_=unisexHsv2rgb(vec3(nh,min(1.0,h.y*0.92),min(1.0,h.z*1.02)));
  return mix(col,out_,w);
}
`

let installed = false
export function installUnisexPalette() {
  if (installed) return
  installed = true
  const prev = Material.prototype.onBeforeCompile
  Material.prototype.onBeforeCompile = function (shader, renderer) {
    prev?.call(this, shader, renderer)
    if (this.userData?.keepHue) return
    const fs = shader.fragmentShader
    if (!fs.includes('#include <color_fragment>')) return
    shader.fragmentShader = GLSL + fs.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = unisexRemap(diffuseColor.rgb);')
  }
  Material.prototype.customProgramCacheKey = function () {
    return 'unisex'
  }
}
