# Meshy'den gelen ham yer doku PNG'lerini döşenebilir 512 px WebP'ye çevirir:
#   python scripts/make-tileable.py public/textures   (klasördeki *.png → *.webp, PNG silinir)
# Kenar payı kırpılır, sonra kenar şeridinde yarım kaydırılmış kopyayla yumuşatılır (kenarlar birbirine kusursuz oturur).
import sys, glob, os
import numpy as np
from PIL import Image

SIZE, CROP, BAND = 512, 0.045, 0.05
d = sys.argv[1] if len(sys.argv) > 1 else 'public/textures'
for f in sorted(glob.glob(os.path.join(d, '*.png'))):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    m = int(min(w, h) * CROP)
    im = im.crop((m, m, w - m, h - m)).resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    rolled = np.roll(a, (SIZE // 2, SIZE // 2), axis=(0, 1))
    t = np.linspace(0, 1, SIZE)
    edge = np.minimum(t, 1 - t) / BAND
    ramp = np.clip(edge, 0, 1)
    ramp = ramp * ramp * (3 - 2 * ramp)
    wgt = np.minimum.outer(ramp, ramp)[..., None]  # kenarda 0, ortada 1
    out = a * wgt + rolled * (1 - wgt)
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(f[:-4] + '.webp', quality=82, method=6)
    if os.environ.get('KEEP') != '1': os.remove(f)
    print('✓', f[:-4] + '.webp')
