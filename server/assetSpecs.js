// Oyun dünyası için üretilecek asset listesi.
// position: [x, y, z] — zemin dairesi yarıçapı 4, avatar merkezde (0,0,0).
// scale: model Meshy'den ~1 birimlik gelir; hedef yükseklik için çarpan.
// Tüm asset'ler aynı tarzda kalsın diye ortak stil son eki (Sanalika benzeri: renkli, oyuncak/çizgi film görünümü).
const STYLE =
  'cute cartoon virtual world game prop, chunky rounded shapes, smooth glossy toy-like surface, bright saturated candy colors, soft shading, simple clean textures, no realistic detail, single object, centered, white background'

export const ASSET_SPECS = [
  // ☕ Kafe
  { id: 'cafe-table', location: 'cafe', name: 'Kafe masası', prompt: `small round wooden cafe table with two cups, ${STYLE}`, position: [-2.2, 0, -1], scale: 1.1 },
  { id: 'cafe-chair', location: 'cafe', name: 'Kafe sandalyesi', prompt: `cozy wooden cafe chair with cushion, ${STYLE}`, position: [-1.4, 0, -1.6], rotationY: 0.6, scale: 1 },
  { id: 'cafe-plant', location: 'cafe', name: 'Saksı bitkisi', prompt: `potted indoor plant in ceramic pot, ${STYLE}`, position: [2.4, 0, -1.8], scale: 1.2 },

  // 🌳 Park
  { id: 'park-bench', location: 'park', name: 'Park bankı', prompt: `wooden park bench with metal legs, ${STYLE}`, position: [-2.4, 0, -1.2], rotationY: 0.5, scale: 1.3 },
  { id: 'park-tree', location: 'park', name: 'Ağaç', prompt: `low poly stylized oak tree, ${STYLE}`, position: [2.6, 0, -2], scale: 2.4 },
  { id: 'park-lamp', location: 'park', name: 'Sokak lambası', prompt: `vintage park street lamp, ${STYLE}`, position: [1.6, 0, 1.8], scale: 2 },

  // 🪩 Gece Kulübü
  { id: 'club-ball', location: 'club', name: 'Disko topu', prompt: `shiny mirror disco ball, ${STYLE}`, position: [0, 2.6, 0], scale: 1.1 },
  { id: 'club-speaker', location: 'club', name: 'Hoparlör', prompt: `large black dj speaker with glowing neon trim, ${STYLE}`, position: [-2.6, 0, -1.5], rotationY: 0.5, scale: 1.6 },
  { id: 'club-booth', location: 'club', name: 'DJ standı', prompt: `futuristic dj booth with turntables and neon lights, ${STYLE}`, position: [0, 0, -3], scale: 2 },

  // 🏖️ Plaj
  { id: 'beach-umbrella', location: 'beach', name: 'Plaj şemsiyesi', prompt: `striped beach umbrella planted in sand, ${STYLE}`, position: [-2.2, 0, -1.2], scale: 2.2 },
  { id: 'beach-lounger', location: 'beach', name: 'Şezlong', prompt: `wooden beach lounge chair with towel, ${STYLE}`, position: [-1.4, 0, 0.8], rotationY: 0.8, scale: 1.4 },
  { id: 'beach-palm', location: 'beach', name: 'Palmiye', prompt: `stylized palm tree, ${STYLE}`, position: [2.6, 0, -2], scale: 2.8 },
]
