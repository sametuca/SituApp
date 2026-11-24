# Turkuaz (HSL hue 163°-192°) arayüz renklerini sıcak turuncu-amber'e çevirir (seviye atlama rozeti #ff9f43 ailesi).
import re, colorsys, glob, os
def conv(m):
    hx = m.group(0)
    r, g, b = (int(hx[i:i+2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    d = h * 360
    if not (163 <= d <= 192) or s < 0.2: return hx
    nh = (28 + (d - 163) * 0.35) / 360
    s2 = min(0.98, s * 1.5 + 0.1)
    l2 = min(0.97, l + 0.0)
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
