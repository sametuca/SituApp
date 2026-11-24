#!/usr/bin/env python3
"""Fluent Emoji 3D (Microsoft, MIT) → public/icons/fluent/<anahtar>.webp + src/components/emojiIndex.json.

Kullanım:
  git clone --depth 1 --filter=blob:none --sparse --no-checkout https://github.com/microsoft/fluentui-emoji.git /tmp/fe
  cd /tmp/fe && git sparse-checkout init --no-cone && \
    git sparse-checkout set '/assets/*/metadata.json' '/assets/*/3D/*.png' '/assets/*/Default/3D/*.png' '/LICENSE' && git checkout
  python3 scripts/build-emoji-pack.py /tmp/fe
Anahtar: emoji kod noktaları (küçük harf hex, '-' ile; VS16 (fe0f) atılır). Runtime: src/components/emoji.jsx.
Renk tonlu emojiler pakete alınmaz (varsayılan sarı hâli vardır; tonlular yerel emoji olarak kalır).
"""
import glob, json, os, sys
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/fe'
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = os.path.join(root, 'public', 'icons', 'fluent')
os.makedirs(out, exist_ok=True)
SIZE = 96

keys = []
for meta in sorted(glob.glob(os.path.join(src, 'assets', '*', 'metadata.json'))):
    d = os.path.dirname(meta)
    m = json.load(open(meta, encoding='utf-8'))
    cps = [c for c in m['unicode'].split() if c != 'fe0f']
    key = '-'.join(cps)
    pngs = glob.glob(os.path.join(d, '3D', '*.png')) or glob.glob(os.path.join(d, 'Default', '3D', '*.png'))
    if not pngs:
        continue
    im = Image.open(pngs[0]).convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
    im.save(os.path.join(out, key + '.webp'), 'WEBP', quality=82, method=6)
    keys.append(key)

keys.sort()
json.dump(keys, open(os.path.join(root, 'src', 'components', 'emojiIndex.json'), 'w'), separators=(',', ':'))
lic = os.path.join(src, 'LICENSE')
if os.path.exists(lic):
    with open(os.path.join(out, 'LICENSE.txt'), 'w', encoding='utf-8') as f:
        f.write('Fluent Emoji (3D) — Copyright (c) Microsoft Corporation. MIT Lisansı.\nKaynak: https://github.com/microsoft/fluentui-emoji\n\n')
        f.write(open(lic, encoding='utf-8').read())
total = sum(os.path.getsize(os.path.join(out, k + '.webp')) for k in keys)
print(f'{len(keys)} ikon, toplam {total/1e6:.1f} MB')
