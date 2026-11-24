# Pembe tonlarını (HSL hue 300°-358°) aynı açıklık/doygunlukla turkuaz-nane tonlarına çevirir (unisex palet).
# Kullanım: python3 scripts/unisex-colors.py   (src/ ve index.html içindeki #rrggbb değerlerini dönüştürür; zaten dönüşmüşlere dokunmaz)
import re, colorsys, glob, os
def remap(h):  # h: 0..1
    d = h * 360
    if d >= 358 or d < 300: return None
    return (180 + (d - 336) * 0.45) / 360   # 336° (pembe) → 180° (turkuaz); 300° → 164° (nane)
def conv(m):
    hx = m.group(0)
    r, g, b = (int(hx[i:i+2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if s < 0.18 or l > 0.985: return hx
    nh = remap(h)
    if nh is None: return hx
    # neon olmasın: doygunluk %62, orta tonlar biraz koyulaşır (beyaz yazı okunsun)
    s2 = s * 0.62
    l2 = l - 0.09 if l < 0.9 else l
    r2, g2, b2 = colorsys.hls_to_rgb(nh, l2, s2)
    return '#%02x%02x%02x' % (round(r2*255), round(g2*255), round(b2*255))
files = [f for f in glob.glob('src/**/*', recursive=True) if f.endswith(('.js', '.jsx', '.css')) and 'emojiIndex' not in f] + ['index.html']
n = 0
for f in files:
    if not os.path.isfile(f): continue
    s = open(f, encoding='utf-8').read()
    t = re.sub(r'#[0-9a-fA-F]{6}\b', conv, s)
    if t != s:
        open(f, 'w', encoding='utf-8').write(t); n += 1
print('değişen dosya:', n)
