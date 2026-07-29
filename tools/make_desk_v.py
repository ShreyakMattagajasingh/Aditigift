import struct, zlib

# Vertical desk (2x3 tiles, right wall) at 16px-per-tile logical resolution:
# classic 3/4 top-down — full tabletop seen from above with a small south
# front face. The sitter faces right (toward the wall), so the open laptop
# reads keyboard-left / screen-right.

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
    def save(self, path):
        write_rgba(path, self.w, self.h, self.px)
        print('wrote', path, f'{self.w}x{self.h}')

O = (30, 19, 10, 255)

c = Canvas(32, 48)
top    = (185, 138, 78, 255)
top_hi = (212, 168, 106, 255)
grain  = (154, 111, 60, 255)
lip    = (122, 82, 42, 255)
front  = (138, 90, 48, 255)
shade  = (94, 58, 30, 255)

# tabletop
c.rect(0, 0, 32, 42, top)
c.hline(1, 1, 30, top_hi)
c.vline(1, 1, 40, top_hi)
# wood grain (vertical streaks since the desk runs vertically)
for (gx, gy, gl) in [(5, 4, 8), (10, 20, 9), (26, 8, 7), (21, 30, 8), (7, 33, 6), (27, 26, 5), (14, 6, 5)]:
    c.vline(gx, gy, gl, grain)

# open laptop seen from above: keyboard half (left) + screen half (right)
c.rect(8, 6, 18, 12, (32, 32, 36, 255))       # whole body
c.rect(9, 7, 8, 10, (58, 58, 64, 255))        # keyboard deck
for ky in (9, 11, 13):                        # key rows
    c.hline(10, ky, 6, (40, 40, 46, 255))
c.rect(18, 7, 7, 10, (110, 198, 245, 255))    # screen
c.rect(19, 8, 3, 2, (168, 224, 252, 255))     # glare

# coffee mug
c.rect(11, 22, 4, 4, (192, 96, 58, 255))
c.rect(12, 23, 2, 2, (94, 62, 40, 255))
c.set(10, 23, (192, 96, 58, 255))             # handle nub (toward the room)

# spiral sketchbook near the bottom
c.rect(9, 30, 12, 9, (238, 230, 210, 255))
c.outline(9, 30, 12, 9, (150, 134, 108, 255))
c.vline(11, 31, 7, (150, 134, 108, 255))      # spiral binding
for ny in (33, 35):
    c.hline(13, ny, 6, (150, 134, 108, 255))  # pencil lines

# front lip + south face with feet
c.hline(0, 40, 32, lip)
c.hline(0, 41, 32, shade)
c.rect(0, 42, 32, 6, front)
c.hline(1, 43, 30, (160, 108, 58, 255))
c.rect(2, 46, 3, 2, shade)
c.rect(27, 46, 3, 2, shade)

c.outline(0, 0, 32, 48, O)
c.save(r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\bedroom\desk_v_px.png")
