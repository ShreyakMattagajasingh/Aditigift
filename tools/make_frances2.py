import struct, zlib, os

# Real 305 N Frances St block, per the user's Google Maps screenshot.
# New sprites: fluno_px 6x4, ramp_px 4x3, walgreens_px 3x2, rive_px 4x3,
# cheba_px 2x2, james_px 3x2, inka_px 3x2. 16px/tile logical, baked 2x.

def write_rgba(path, W, H, px):
    stride = W * 4
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        raw += px[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', comp) + chunk(b'IEND', b''))

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = bytearray(w * h * 4)
    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            o = (y * self.w + x) * 4
            self.px[o:o+4] = bytes(c)
    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)
    def outline(self, x, y, w, h, c):
        for xx in range(x, x + w):
            self.set(xx, y, c); self.set(xx, y + h - 1, c)
        for yy in range(y, y + h):
            self.set(x, yy, c); self.set(x + w - 1, yy, c)
    def hline(self, x, y, w, c):
        for xx in range(x, x + w): self.set(xx, y, c)
    def vline(self, x, y, h, c):
        for yy in range(y, y + h): self.set(x, yy, c)
    def save2x(self, path):
        W, H = self.w * 2, self.h * 2
        out = bytearray(W * H * 4)
        for y in range(self.h):
            for x in range(self.w):
                o = (y * self.w + x) * 4
                c = self.px[o:o+4]
                if c[3] == 0:
                    continue
                for dy in range(2):
                    for dx in range(2):
                        oo = ((y*2+dy) * W + x*2+dx) * 4
                        out[oo:oo+4] = c
        write_rgba(path, W, H, out)
        print('wrote', path, f'{W}x{H}')

O = (32, 24, 16, 255)
BASE = r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\frances"
os.makedirs(BASE, exist_ok=True)

def windows(c, xs, ys, w=5, h=6, col=(88, 108, 128, 255), hi=(140, 168, 190, 255)):
    for wx in xs:
        for wy in ys:
            c.rect(wx, wy, w, h, col)
            c.hline(wx, wy, 2, hi)

# ---- Fluno Center: red brick with tall glass atrium band ----
def fluno():
    c = Canvas(96, 64)
    brick = (156, 74, 58, 255)
    brickd= (128, 58, 46, 255)
    glass = (128, 168, 196, 255)
    glassh= (176, 208, 228, 255)
    c.rect(0, 0, 96, 5, (100, 48, 38, 255))
    c.rect(0, 5, 96, 59, brick)
    for by in range(8, 62, 4):
        c.hline(2 + (by % 8) // 2, by, 92, brickd)
    # glass atrium center with curved top
    c.rect(38, 2, 20, 62, glass)
    c.hline(40, 0, 16, glass)
    c.hline(39, 1, 18, glass)
    for gy in range(4, 60, 7):
        c.hline(38, gy, 20, (96, 136, 164, 255))
    c.vline(48, 0, 64, glassh)
    windows(c, (6, 17, 28, 62, 73, 84), (10, 24, 38))
    # entrance at the base of the atrium
    c.rect(43, 52, 10, 12, (60, 76, 92, 255))
    c.rect(44, 53, 8, 11, (190, 214, 228, 255))
    c.outline(0, 0, 96, 64, O)
    c.save2x(BASE + r"\fluno_px.png")

# ---- Lake & Johnson parking ramp: concrete decks with dark openings ----
def ramp():
    c = Canvas(64, 48)
    conc  = (176, 174, 168, 255)
    concd = (148, 146, 140, 255)
    dark  = (58, 58, 62, 255)
    c.rect(0, 0, 64, 48, conc)
    for band in range(3):
        y = 4 + band * 14
        for gx in range(4, 58, 12):
            c.rect(gx, y, 9, 7, dark)
            c.hline(gx, y, 9, (40, 40, 44, 255))
        c.hline(0, y + 9, 64, concd)
    # blue P sign
    c.rect(27, 38, 10, 9, (36, 84, 180, 255))
    c.rect(30, 40, 4, 5, (240, 240, 248, 255))
    c.rect(31, 42, 2, 3, (36, 84, 180, 255))
    c.outline(0, 0, 64, 48, O)
    c.save2x(BASE + r"\ramp_px.png")

# ---- Walgreens: white box, red sign band ----
def walgreens():
    c = Canvas(48, 32)
    c.rect(0, 0, 48, 32, (236, 232, 226, 255))
    c.rect(0, 0, 48, 8, (210, 40, 40, 255))
    c.hline(0, 8, 48, (160, 26, 26, 255))
    # white script squiggle on the sign
    c.hline(8, 3, 6, (255, 255, 255, 255))
    c.hline(16, 4, 8, (255, 255, 255, 255))
    c.hline(26, 3, 6, (255, 255, 255, 255))
    c.hline(34, 4, 6, (255, 255, 255, 255))
    windows(c, (5, 16, 34), (13,), 8, 8, (120, 150, 168, 255))
    c.rect(26, 20, 8, 12, (70, 78, 88, 255))
    c.outline(0, 0, 48, 32, O)
    c.save2x(BASE + r"\walgreens_px.png")

# ---- The Rive Madison: bronze/charcoal modern with balconies ----
def rive():
    c = Canvas(64, 48)
    body  = (86, 78, 72, 255)
    panel = (168, 128, 88, 255)  # bronze accents
    glass = (110, 140, 162, 255)
    c.rect(0, 0, 64, 4, (60, 54, 50, 255))
    c.rect(0, 4, 64, 44, body)
    for gy in (7, 20, 33):
        for gx in range(4, 58, 10):
            c.rect(gx, gy, 7, 8, glass)
            c.hline(gx, gy + 8, 7, panel)  # balcony rail
    c.rect(27, 40, 10, 8, (44, 40, 38, 255))
    c.rect(28, 41, 8, 7, (150, 176, 194, 255))
    c.outline(0, 0, 64, 48, O)
    c.save2x(BASE + r"\rive_px.png")

# ---- Cheba Hut: funky green sub shop with yellow sign ----
def cheba():
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 6, (66, 110, 60, 255))
    c.hline(0, 6, 32, (48, 82, 44, 255))
    c.rect(0, 7, 32, 25, (94, 140, 84, 255))
    # yellow round sign
    c.rect(11, 9, 10, 8, (240, 200, 60, 255))
    c.rect(13, 11, 6, 4, (66, 110, 60, 255))
    # window + door
    c.rect(4, 20, 10, 10, (240, 196, 110, 255))
    c.rect(19, 20, 8, 12, (58, 44, 30, 255))
    c.outline(0, 0, 32, 32, O)
    c.save2x(BASE + r"\cheba_px.png")

# ---- The James: dark modern glass apartments ----
def james():
    c = Canvas(48, 32)
    body = (58, 62, 70, 255)
    glass= (124, 152, 174, 255)
    c.rect(0, 0, 48, 4, (44, 48, 54, 255))
    c.rect(0, 4, 48, 28, body)
    for gy in (7, 17):
        for gx in range(4, 42, 8):
            c.rect(gx, gy, 6, 7, glass)
    c.rect(20, 25, 8, 7, (150, 176, 194, 255))
    c.outline(0, 0, 48, 32, O)
    c.save2x(BASE + r"\james_px.png")

# ---- Estacion Inka: warm Peruvian storefront, orange awning ----
def inka():
    c = Canvas(48, 32)
    c.rect(0, 0, 48, 6, (150, 60, 40, 255))
    c.hline(0, 6, 48, (112, 44, 30, 255))
    c.rect(0, 7, 48, 25, (226, 208, 182, 255))
    # orange/red striped awning
    for i in range(0, 40, 8):
        c.rect(4 + i, 10, 4, 5, (222, 120, 44, 255))
        c.rect(8 + i, 10, 4, 5, (170, 62, 40, 255))
    c.hline(4, 15, 40, (112, 44, 30, 255))
    # golden sun sign
    c.rect(21, 8, 6, 6, (240, 190, 70, 255))
    c.set(20, 10, (240, 190, 70, 255)); c.set(27, 10, (240, 190, 70, 255))
    # windows + door
    c.rect(5, 18, 14, 11, (240, 196, 110, 255))
    c.rect(29, 18, 14, 11, (240, 196, 110, 255))
    c.rect(21, 18, 7, 14, (74, 48, 30, 255))
    c.outline(0, 0, 48, 32, O)
    c.save2x(BASE + r"\inka_px.png")

fluno(); ramp(); walgreens(); rive(); cheba(); james(); inka()
