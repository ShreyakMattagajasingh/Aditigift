import struct, zlib, os

# 300-500 block of N Frances St, Madison WI — building sprites in Gen-3
# style. 16px-per-tile logical, baked 2x.
#   home305_px 4x3 tiles — 305 N Frances (Madison's building)
#   ians_px    4x2 tiles — Ian's Pizza (319 N Frances)
#   wandos_px  4x2 tiles — Wando's (Frances & University corner)
#   hub_px     4x3 tiles — The Hub (Frances & State)
#   brats_px   4x2 tiles — State Street Brats (603 State St)
#   apt_px     4x3 tiles — unnamed campus apartments (east side filler)

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

# ---- 305 N Frances: worn tan-brick walkup, green entry awning ----
def home305():
    c = Canvas(64, 48)
    brick = (196, 150, 108, 255)
    brickd= (170, 124, 84, 255)
    roof  = (104, 82, 62, 255)
    c.rect(0, 0, 64, 5, roof)
    c.hline(0, 5, 64, (78, 60, 44, 255))
    c.rect(0, 6, 64, 42, brick)
    for by in range(9, 46, 4):
        c.hline(2 + (by % 8) // 2, by, 60, brickd)
    windows(c, (5, 15, 44, 54), (9, 20))
    windows(c, (5, 15, 44, 54), (31,))
    # entry: green awning + door + "305" plaque
    c.rect(26, 26, 12, 4, (56, 118, 74, 255))
    c.rect(25, 30, 14, 1, (40, 88, 56, 255))
    c.rect(27, 31, 10, 17, (74, 48, 30, 255))
    c.rect(28, 32, 8, 16, (58, 38, 24, 255))
    c.rect(30, 22, 5, 3, (238, 230, 210, 255))  # plaque above the awning
    c.outline(0, 0, 64, 48, O)
    c.save2x(BASE + r"\home305_px.png")

# ---- Ian's Pizza: white storefront, red-striped awning, slice sign ----
def ians():
    c = Canvas(64, 32)
    wall = (240, 234, 222, 255)
    c.rect(0, 0, 64, 6, (150, 44, 44, 255))
    c.hline(0, 6, 64, (110, 30, 30, 255))
    c.rect(0, 7, 64, 25, wall)
    # striped awning
    for i in range(0, 56, 8):
        c.rect(4 + i, 10, 4, 5, (208, 52, 52, 255))
        c.rect(8 + i, 10, 4, 5, (244, 240, 232, 255))
    c.hline(4, 15, 56, (110, 30, 30, 255))
    # big warm windows + door
    c.rect(6, 17, 20, 12, (240, 196, 110, 255))
    c.rect(38, 17, 20, 12, (240, 196, 110, 255))
    c.rect(28, 17, 8, 15, (74, 48, 30, 255))
    # pizza slice sign hanging over the door
    c.rect(29, 8, 6, 6, (244, 214, 96, 255))
    c.set(30, 10, (200, 60, 50, 255)); c.set(32, 9, (200, 60, 50, 255)); c.set(31, 12, (200, 60, 50, 255))
    c.outline(0, 0, 64, 32, O)
    c.save2x(BASE + r"\ians_px.png")

# ---- Wando's: dark bar, blue neon band, fishbowl in the window ----
def wandos():
    c = Canvas(64, 32)
    c.rect(0, 0, 64, 6, (70, 62, 58, 255))
    c.hline(0, 6, 64, (50, 44, 40, 255))
    c.rect(0, 7, 64, 25, (108, 92, 82, 255))
    # neon sign band
    c.rect(6, 9, 52, 6, (36, 40, 52, 255))
    c.hline(9, 11, 20, (86, 180, 245, 255))
    c.hline(9, 13, 14, (86, 180, 245, 255))
    c.rect(40, 10, 14, 4, (232, 70, 70, 255))
    # windows with a glowing blue fishbowl
    c.rect(6, 17, 22, 12, (52, 46, 58, 255))
    c.rect(12, 21, 8, 6, (86, 180, 245, 255))
    c.rect(13, 20, 6, 1, (150, 216, 255, 255))
    c.rect(38, 17, 20, 12, (52, 46, 58, 255))
    c.rect(29, 17, 8, 15, (46, 34, 26, 255))
    c.outline(0, 0, 64, 32, O)
    c.save2x(BASE + r"\wandos_px.png")

# ---- The Hub: tall modern glass apartments ----
def hub():
    c = Canvas(64, 48)
    frame = (156, 158, 166, 255)
    glass = (110, 150, 178, 255)
    glassh= (160, 198, 220, 255)
    c.rect(0, 0, 64, 4, (120, 122, 130, 255))
    c.rect(0, 4, 64, 44, frame)
    for gy in range(6, 40, 8):
        for gx in range(3, 60, 10):
            c.rect(gx, gy, 8, 6, glass)
            c.hline(gx, gy, 3, glassh)
    # street-level lobby
    c.rect(3, 40, 58, 8, (70, 74, 84, 255))
    c.rect(27, 40, 10, 8, (190, 210, 224, 255))
    c.outline(0, 0, 64, 48, O)
    c.save2x(BASE + r"\hub_px.png")

# ---- State Street Brats: red double-decker with white sign ----
def brats():
    c = Canvas(64, 32)
    red  = (178, 44, 48, 255)
    redd = (140, 30, 36, 255)
    c.rect(0, 0, 64, 5, (110, 30, 30, 255))
    c.rect(0, 5, 64, 27, red)
    c.hline(0, 5, 64, redd)
    # upstairs windows (the famous rooftop/upstairs)
    windows(c, (6, 18, 42, 54), (8,), 5, 5, (66, 46, 46, 255), (120, 96, 96, 255))
    # white sign band with a brat
    c.rect(14, 16, 36, 7, (242, 238, 228, 255))
    c.rect(20, 18, 20, 3, (188, 108, 60, 255))  # the brat
    c.hline(21, 18, 18, (216, 140, 84, 255))
    # door + window
    c.rect(8, 24, 12, 8, (66, 46, 46, 255))
    c.rect(38, 24, 18, 7, (240, 196, 110, 255))
    c.outline(0, 0, 64, 32, O)
    c.save2x(BASE + r"\brats_px.png")

# ---- generic campus apartments (east-side filler, unnamed) ----
def apt():
    c = Canvas(64, 48)
    brick = (172, 128, 100, 255)
    brickd= (148, 106, 80, 255)
    c.rect(0, 0, 64, 5, (92, 74, 60, 255))
    c.hline(0, 5, 64, (70, 56, 46, 255))
    c.rect(0, 6, 64, 42, brick)
    for by in range(9, 46, 4):
        c.hline(2 + (by % 8) // 2, by, 60, brickd)
    windows(c, (6, 17, 42, 53), (10, 21, 32))
    c.rect(29, 34, 9, 14, (64, 44, 30, 255))
    c.outline(0, 0, 64, 48, O)
    c.save2x(BASE + r"\apt_px.png")

home305(); ians(); wandos(); hub(); brats(); apt()
