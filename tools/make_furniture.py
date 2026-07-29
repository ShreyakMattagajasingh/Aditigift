import struct, zlib

# Authors pixel-art furniture sprites at 16px-per-tile logical resolution.
# The game's Furniture.gd fit-scaler upscales them 2x (nearest) into their
# 32px-tile footprints, giving chunky GBA-style pixels.

def write_rgba(path, W, H, px):
    stride = W * 4
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        raw += px[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)
    def chunk(typ, data):
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', comp) + chunk(b'IEND', b''))

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = bytearray(w * h * 4)  # starts fully transparent
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
    def save(self, path):
        write_rgba(path, self.w, self.h, self.px)
        print('wrote', path, f'{self.w}x{self.h}')

O  = (30, 19, 10, 255)    # outline
BASE = r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\bedroom"

# ---------------- DESK 48x32 (3x2 tiles) ----------------
# Top-down front view like the photo: oak top with grain, open knee space on
# the left, two-drawer stack on the right, laptop + mug on the surface.
def desk():
    c = Canvas(48, 32)
    top    = (185, 138, 78, 255)
    top_hi = (212, 168, 106, 255)
    grain  = (154, 111, 60, 255)
    lip    = (122, 82, 42, 255)
    front  = (138, 90, 48, 255)
    drawer = (122, 76, 40, 255)
    drw_hi = (150, 100, 54, 255)
    shade  = (94, 58, 30, 255)
    handle = (232, 216, 168, 255)
    cavity = (46, 29, 16, 255)
    cav_dk = (33, 21, 12, 255)

    # top surface
    c.rect(0, 0, 48, 14, top)
    c.hline(1, 1, 46, top_hi)
    # wood grain streaks
    for (gx, gy, gl) in [(4,4,7),(14,7,9),(30,4,6),(36,9,8),(8,10,6),(24,11,5),(40,6,4),(18,3,5)]:
        c.hline(gx, gy, gl, grain)
    # front lip of the desktop
    c.hline(0, 12, 48, lip)
    c.hline(0, 13, 48, shade)

    # laptop (slightly left of center, like the screenshot's blue screen)
    c.rect(17, 2, 13, 9, (32, 32, 36, 255))
    c.rect(18, 3, 11, 6, (110, 198, 245, 255))
    c.rect(20, 4, 4, 1, (168, 224, 252, 255))   # screen glare
    c.rect(18, 9, 11, 1, (60, 60, 66, 255))     # keyboard strip
    # mug of coffee
    c.rect(34, 5, 4, 4, (192, 96, 58, 255))
    c.rect(35, 5, 2, 1, (94, 62, 40, 255))      # coffee
    c.set(38, 6, (192, 96, 58, 255))            # handle nub

    # front face
    c.rect(0, 14, 48, 18, front)
    # open knee space (left)
    c.rect(2, 15, 21, 16, cavity)
    c.rect(2, 15, 21, 3, cav_dk)                # inner shadow at the top
    # drawer stack (right)
    for dy in (15, 23):
        c.rect(25, dy, 21, 7, drawer)
        c.hline(26, dy + 1, 19, drw_hi)         # top bevel
        c.hline(25, dy + 6, 21, shade)          # bottom shade
        c.rect(33, dy + 3, 5, 2, handle)
        c.outline(25, dy, 21, 7, shade)
    # legs shadow line at the floor
    c.hline(0, 31, 48, shade)

    c.outline(0, 0, 48, 32, O)
    c.save(BASE + r"\desk_px.png")

# ---------------- CHAIR 16x18 (1x1 tile, slight overhang up) ----------------
# Black office chair like the photo: rounded backrest, seat, star base.
def chair():
    c = Canvas(16, 18)
    body   = (38, 38, 44, 255)
    hi     = (66, 66, 76, 255)
    dark   = (20, 20, 24, 255)
    # backrest (rounded corners via skipped pixels)
    c.rect(3, 0, 10, 7, body)
    c.hline(4, 0, 8, body)
    c.set(3, 0, (0,0,0,0)); c.set(12, 0, (0,0,0,0))
    c.hline(4, 1, 8, hi)
    c.outline(3, 0, 10, 7, dark)
    c.set(3, 0, (0,0,0,0)); c.set(12, 0, (0,0,0,0))
    # post between backrest and seat
    c.rect(7, 7, 2, 1, dark)
    # seat
    c.rect(2, 8, 12, 5, body)
    c.hline(3, 8, 10, hi)
    c.outline(2, 8, 12, 5, dark)
    # gas lift + star base
    c.rect(7, 13, 2, 2, dark)
    c.hline(3, 15, 10, dark)
    c.vline(3, 15, 2, dark); c.vline(12, 15, 2, dark)
    c.rect(2, 16, 2, 2, dark); c.rect(12, 16, 2, 2, dark)
    c.rect(7, 16, 2, 2, dark)
    c.save(BASE + r"\chair_px.png")

# ---------------- DOOR 32x16 (2x1 tiles) ----------------
# Honey-wood door with two recessed panels and a gold knob.
def door():
    c = Canvas(32, 16)
    slab   = (192, 138, 78, 255)
    slab_hi= (214, 162, 100, 255)
    inset  = (150, 102, 54, 255)
    inset_dk = (122, 80, 40, 255)
    frame  = (120, 78, 40, 255)
    knob   = (240, 198, 60, 255)

    c.rect(0, 0, 32, 16, slab)
    c.hline(1, 1, 30, slab_hi)
    c.vline(1, 1, 14, slab_hi)
    # two recessed panels
    for px_ in (4, 18):
        c.rect(px_, 3, 10, 10, inset)
        c.outline(px_, 3, 10, 10, inset_dk)
        c.hline(px_ + 1, 4, 8, inset_dk)
    # knob on the right panel edge
    c.rect(27, 7, 2, 2, knob)
    c.set(27, 7, (255, 232, 140, 255))
    # threshold shadow
    c.hline(0, 15, 32, frame)
    c.outline(0, 0, 32, 16, O)
    c.save(BASE + r"\door_px.png")

# ---------------- RADIATOR 48x16 (3x1 tiles) ----------------
# Baseboard heater like the photo: long cream unit, fin slats, little feet.
# Transparent above so it hugs the wall base (align_y bottom).
def radiator():
    c = Canvas(48, 16)
    body  = (216, 207, 184, 255)
    top   = (232, 224, 202, 255)
    slat  = (168, 154, 124, 255)
    dark  = (74, 68, 54, 255)
    # body starts a third of the way down; above stays transparent
    c.rect(0, 5, 48, 9, body)
    c.hline(0, 5, 48, top)
    c.hline(0, 6, 48, top)
    # fin slats
    for x in range(3, 45, 3):
        c.vline(x, 8, 5, slat)
    # end caps
    c.rect(0, 5, 2, 9, slat)
    c.rect(46, 5, 2, 9, slat)
    c.outline(0, 5, 48, 9, dark)
    # feet
    c.rect(4, 14, 3, 2, dark)
    c.rect(41, 14, 3, 2, dark)
    c.save(BASE + r"\radiator_px.png")

desk(); chair(); door(); radiator()
