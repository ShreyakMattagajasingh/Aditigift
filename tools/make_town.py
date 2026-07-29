import struct, zlib, os

# Madison, WI landmark sprites in Gen-3 style: 16px-per-tile logical, baked 2x.
# capitol 5x4 tiles, bascom 4x3, dorm 3x2, stadium 4x3, tree 1x2, sunchair 1x1.

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
        # bake at 2x
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
BASE = r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\town"
os.makedirs(BASE, exist_ok=True)

# ---------------- WISCONSIN STATE CAPITOL 80x64 ----------------
def capitol():
    c = Canvas(80, 64)
    white  = (240, 236, 224, 255)
    shade  = (208, 202, 184, 255)
    dark   = (170, 164, 146, 255)
    win    = (72, 76, 88, 255)
    gold   = (232, 192, 88, 255)
    # main block
    c.rect(4, 30, 72, 24, white)
    c.hline(4, 30, 72, shade)
    # wings' window rows
    for wy in (34, 43):
        for wx in range(8, 30, 6):
            c.rect(wx, wy, 3, 6, win)
        for wx in range(52, 74, 6):
            c.rect(wx, wy, 3, 6, win)
    # center portico
    c.rect(28, 24, 24, 30, white)
    c.outline(28, 24, 24, 30, shade)
    # pediment
    for i in range(5):
        c.hline(30 + i * 2, 28 - i, 20 - i * 4, shade if i else dark)
    # portico columns
    for cx in range(30, 50, 4):
        c.vline(cx, 30, 22, dark)
        c.vline(cx + 1, 30, 22, white)
    # entrance
    c.rect(37, 44, 6, 10, win)
    # drum
    c.rect(32, 12, 16, 12, white)
    c.outline(32, 12, 16, 12, shade)
    for cx in range(34, 47, 3):
        c.vline(cx, 14, 8, dark)
    # dome (stacked shrinking bands)
    widths = [16, 14, 12, 8, 4]
    for i, w in enumerate(widths):
        y = 10 - i * 2
        c.rect(40 - w // 2, y, w, 2, white if i % 2 == 0 else shade)
    # golden "Wisconsin" statue on top
    c.rect(39, 0, 2, 3, gold)
    # steps
    c.rect(24, 54, 32, 3, shade)
    c.rect(20, 57, 40, 3, dark)
    c.rect(16, 60, 48, 4, (150, 144, 128, 255))
    c.outline(4, 30, 72, 24, O)
    c.save2x(BASE + r"\capitol_px.png")

# ---------------- BASCOM HALL 64x48 ----------------
def bascom():
    c = Canvas(64, 48)
    roof  = (168, 56, 48, 255)
    roofh = (198, 76, 64, 255)
    wall  = (232, 220, 200, 255)
    col   = (248, 244, 234, 255)
    shade = (196, 182, 158, 255)
    win   = (72, 76, 88, 255)
    # hipped roof
    for i in range(10):
        c.hline(6 + i * 2, 2 + i, 52 - i * 4, roof if i > 1 else roofh)
    c.hline(4, 12, 56, (120, 40, 34, 255))
    # facade
    c.rect(6, 13, 52, 25, wall)
    # columns
    for cx in range(22, 42, 5):
        c.vline(cx, 15, 20, shade)
        c.vline(cx + 1, 15, 20, col)
    # windows on the wings
    for wy in (16, 26):
        for wx in (9, 15):
            c.rect(wx, wy, 4, 6, win)
        for wx in (45, 51):
            c.rect(wx, wy, 4, 6, win)
    # entrance
    c.rect(29, 28, 6, 10, win)
    # steps
    c.rect(24, 38, 16, 3, shade)
    c.rect(20, 41, 24, 3, (170, 158, 136, 255))
    c.rect(16, 44, 32, 4, (150, 140, 122, 255))
    c.outline(6, 13, 52, 25, O)
    c.save2x(BASE + r"\bascom_px.png")

# ---------------- DORM (Madison's building) 48x32 ----------------
def dorm():
    c = Canvas(48, 32)
    brick = (198, 148, 104, 255)
    brickd= (172, 122, 82, 255)
    roof  = (110, 84, 62, 255)
    win   = (88, 108, 128, 255)
    winh  = (140, 168, 190, 255)
    door  = (74, 48, 30, 255)
    # roofline
    c.rect(0, 0, 48, 5, roof)
    c.hline(0, 5, 48, (80, 60, 44, 255))
    # walls
    c.rect(0, 6, 48, 26, brick)
    for by in range(8, 30, 4):
        c.hline(2 + (by % 8) // 2, by, 44, brickd)
    # windows
    for wx in (5, 14, 30, 39):
        c.rect(wx, 9, 5, 7, win)
        c.hline(wx, 9, 2, winh)
    # doorway (bottom center) with awning
    c.rect(20, 14, 8, 18, door)
    c.rect(21, 15, 6, 17, (58, 38, 24, 255))
    c.rect(18, 12, 12, 3, (150, 44, 54, 255))  # little red awning
    c.outline(0, 0, 48, 32, O)
    c.save2x(BASE + r"\dorm_px.png")

# ---------------- CAMP RANDALL 64x48 ----------------
def stadium():
    c = Canvas(64, 48)
    deck  = (178, 178, 188, 255)
    deckd = (140, 140, 152, 255)
    wall  = (184, 48, 56, 255)
    walld = (146, 32, 42, 255)
    gate  = (66, 26, 30, 255)
    W     = (255, 255, 255, 255)
    # upper deck
    c.rect(0, 0, 64, 10, deck)
    c.hline(0, 9, 64, deckd)
    for lx in range(4, 62, 6):
        c.vline(lx, 2, 6, deckd)
    # red bowl wall
    c.rect(0, 10, 64, 32, wall)
    c.hline(0, 10, 64, walld)
    # big white W (thick strokes)
    for i in range(10):
        c.rect(22 + i // 2, 16 + i, 3, 1, W)         # left stroke down-right
        c.rect(39 - i // 2, 16 + i, 3, 1, W)         # right stroke down-left
    for i in range(6):
        c.rect(29 - i // 3, 20 + i, 2, 1, W)         # middle-left up
        c.rect(33 + i // 3, 20 + i, 2, 1, W)         # middle-right up
    # gates
    for gx in (6, 52):
        c.rect(gx, 32, 7, 10, gate)
    # base
    c.rect(0, 42, 64, 6, deckd)
    c.outline(0, 0, 64, 48, O)
    c.save2x(BASE + r"\stadium_px.png")

# ---------------- TREE 16x32 ----------------
def tree():
    c = Canvas(16, 32)
    dk = (40, 104, 64, 255)
    md = (62, 148, 88, 255)
    lt = (98, 188, 116, 255)
    trunk = (110, 76, 48, 255)
    # canopy: layered blob
    c.rect(3, 2, 10, 4, md)
    c.rect(1, 5, 14, 12, md)
    c.rect(2, 17, 12, 4, dk)
    # highlights
    c.rect(3, 4, 5, 3, lt)
    c.rect(9, 7, 4, 3, lt)
    c.rect(4, 11, 3, 2, lt)
    # shadow bottom of canopy
    c.rect(3, 19, 10, 2, (30, 82, 52, 255))
    # trunk
    c.rect(6, 21, 4, 9, trunk)
    c.rect(6, 21, 1, 9, (86, 58, 36, 255))
    c.outline(1, 2, 14, 19, O)
    c.save2x(BASE + r"\tree_px.png")

# ---------------- TERRACE SUNBURST CHAIR 16x16 ----------------
def sunchair():
    c = Canvas(16, 16)
    yel = (248, 208, 48, 255)
    org = (240, 148, 40, 255)
    dk  = (60, 48, 24, 255)
    # fan back
    c.rect(3, 1, 10, 7, yel)
    c.set(3, 1, (0,0,0,0)); c.set(12, 1, (0,0,0,0))
    for rx in (5, 8, 11):
        c.vline(rx, 2, 5, org)
    # seat
    c.rect(4, 8, 8, 4, yel)
    c.hline(4, 8, 8, org)
    # legs
    c.rect(4, 12, 2, 3, dk)
    c.rect(10, 12, 2, 3, dk)
    c.outline(3, 1, 10, 11, O)
    c.set(3, 1, (0,0,0,0)); c.set(12, 1, (0,0,0,0))
    c.save2x(BASE + r"\sunchair_px.png")

capitol(); bascom(); dorm(); stadium(); tree(); sunchair()
