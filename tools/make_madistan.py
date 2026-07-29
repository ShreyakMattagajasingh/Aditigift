import struct, zlib

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
# Madistan: warm teal storefront with a golden sign band and glowing window
c = Canvas(32, 32)
c.rect(0, 0, 32, 6, (30, 96, 92, 255))
c.hline(0, 6, 32, (22, 70, 68, 255))
c.rect(0, 7, 32, 25, (56, 132, 126, 255))
c.rect(6, 9, 20, 6, (238, 178, 60, 255))     # gold sign band
c.rect(8, 11, 16, 2, (168, 116, 30, 255))
c.rect(4, 19, 12, 10, (244, 204, 120, 255))  # warm window
c.rect(20, 18, 8, 14, (66, 44, 30, 255))     # door
c.outline(0, 0, 32, 32, O)
c.save2x(r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\frances\madistan_px.png")
