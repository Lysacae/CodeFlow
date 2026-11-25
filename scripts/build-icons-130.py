import re
import zipfile
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(r"C:\Users\lysac\Documents\Project\CodeFlow")
text = (root / "apps/desktop/src/shared/lib/achievements.ts").read_text(encoding="utf-8")
ids = re.findall(r'id: "([^"]+)"', text)
if len(ids) != 71:
    raise SystemExit(f"expected 71 achievements, got {len(ids)}")


def hue_shift(im: Image.Image, degrees: float) -> Image.Image:
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    rgb = arr[:, :, :3] / 255.0
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    df = mx - mn
    h = np.zeros_like(mx)
    mask = df > 1e-6
    rmask = mask & (mx == r)
    gmask = mask & (mx == g)
    bmask = mask & (mx == b) & ~rmask & ~gmask
    h[rmask] = np.mod((g - b)[rmask] / df[rmask], 6)
    h[gmask] = ((b - r)[gmask] / df[gmask]) + 2
    h[bmask] = ((r - g)[bmask] / df[bmask]) + 4
    h = h / 6.0
    s = np.where(mx <= 1e-6, 0, df / np.maximum(mx, 1e-6))
    v = mx
    h = np.mod(h + degrees / 360.0, 1.0)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    out = np.zeros_like(rgb)
    channels = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    for idx, (rr, gg, bb) in enumerate(channels):
        m = i == idx
        out[:, :, 0][m] = rr[m]
        out[:, :, 1][m] = gg[m]
        out[:, :, 2][m] = bb[m]
    arr[:, :, :3] = np.clip(out * 255, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def darken(im: Image.Image, factor: float) -> Image.Image:
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    arr[:, :, :3] *= factor
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def tint_white(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    height, width = arr.shape[:2]
    margin_x = int(width * 0.08)
    margin_y = int(height * 0.08)
    white = (arr[:, :, 0] > 210) & (arr[:, :, 1] > 210) & (arr[:, :, 2] > 210)
    interior = np.zeros((height, width), dtype=bool)
    interior[margin_y : height - margin_y, margin_x : width - margin_x] = True
    mask = white & interior
    arr[mask, 0] = rgb[0]
    arr[mask, 1] = rgb[1]
    arr[mask, 2] = rgb[2]
    return Image.fromarray(arr, "RGBA")


def lighten(im: Image.Image, add: float) -> Image.Image:
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    arr[:, :, :3] = np.clip(arr[:, :, :3] + add, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


ach_dir = root / "apps/desktop/public/achievements"
ach_dir.mkdir(parents=True, exist_ok=True)
for path in ach_dir.glob("*.png"):
    path.unlink()

src = []
with zipfile.ZipFile(r"C:\Users\lysac\Downloads\cyberpunk.zip") as archive:
    names = [
        name
        for name in archive.namelist()
        if name.startswith("PNG/standart/background/")
        and name.endswith(".png")
        and "__MACOSX" not in name
    ]
    names.sort(key=lambda name: int(Path(name).stem))
    if len(names) != 50:
        raise SystemExit(f"expected 50 cyberpunk sprites, got {len(names)}")
    for name in names:
        src.append(Image.open(BytesIO(archive.read(name))).convert("RGBA"))

neon = [
    (255, 45, 149),
    (45, 226, 255),
    (255, 196, 38),
    (168, 85, 247),
    (52, 211, 153),
    (255, 99, 71),
    (125, 211, 252),
    (250, 250, 110),
    (244, 114, 182),
    (94, 234, 212),
    (251, 146, 60),
    (196, 181, 253),
    (74, 222, 128),
    (253, 164, 175),
    (56, 189, 248),
    (253, 224, 71),
    (232, 121, 249),
    (45, 212, 191),
    (251, 113, 133),
    (165, 180, 252),
    (190, 242, 100),
]
for index, achievement_id in enumerate(ids):
    image = src[index] if index < 50 else tint_white(src[(index - 50) % 50], neon[index - 50])
    image.resize((256, 256), Image.Resampling.LANCZOS).save(ach_dir / f"{achievement_id}.png")

sheet = Image.open(root / ".tmp-assets/gui.png").convert("RGBA")
cell = 16
row = 20
tiles = [sheet.crop((c * cell, row * cell, (c + 1) * cell, (row + 1) * cell)) for c in range(13)]


def up(image: Image.Image) -> Image.Image:
    return image.resize((128, 128), Image.Resampling.NEAREST)


ranks = {
    "bronze": up(tiles[4]),
    "fer": up(darken(tiles[6], 0.72)),
    "argent": up(tiles[2]),
    "or": up(tiles[0]),
    "platine": up(tiles[5]),
    "diamant": up(tiles[12]),
    "emeraude": up(tiles[9]),
    "jade": up(tiles[11]),
    "perle": up(lighten(tiles[2], 70)),
    "amethyste": up(tiles[3]),
    "titane": up(darken(tiles[12], 0.62)),
    "tungstene": up(lighten(darken(tiles[2], 0.35), 40)),
}
rank_dir = root / "apps/desktop/public/ranks"
for path in rank_dir.glob("*.png"):
    path.unlink()
for name, image in ranks.items():
    image.save(rank_dir / f"{name}.png")

print("achievements", len(list(ach_dir.glob("*.png"))))
print("ranks", len(list(rank_dir.glob("*.png"))))
