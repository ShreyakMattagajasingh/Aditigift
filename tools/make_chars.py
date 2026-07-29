import struct, zlib, os

# Gen-3 Pokemon style character sheets: round heads, big vertical eyes with
# glints, bright GBA palette, chunky pixels. Art is authored at 16px-per-tile
# logical scale on 18-wide grids, then baked at 2x so characters share the
# furniture's fat-pixel density. Sheets: 3 cols (idle, walkA, walkB) x 4 rows
# (down, up, left, right); logical cell 20x24 -> baked cell 40x48.

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

GW = 18

def G(*rows):
    out = []
    for r in rows:
        assert len(r) == GW, f'row len {len(r)}: {r!r}'
        out.append(r)
    return out

# ---------------- MADISON ----------------
HEAD_D = G(
    '.....HHHHHHHH.....',
    '...HHHHHHHHHHHH...',
    '..HHhhHHHHHHHHHH..',
    '..HHhHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHSSSSSSSSSSHH..',
    '..HHSEESSSSEESHH..',
    '..HHSEwSSSSEwSHH..',
    '..HHSEESSSSEESHH..',
    '..HHsSSSSSSSSsHH..',
    '..HHSSSSMMSSSSHH..',
    '..HHHSSSSSSSSHHH..',
)
TORSO2_D = G(
    '..HHTTTTTTTTTTHH..',
    '..HHtTTTTTTTTtHH..',
    '..SSTTTTTTTTTTSS..',
    '..SSttttttttttSS..',
    '....BBBBBBBBBB....',
    '....BBBB..BBBB....',
)
TORSOD_D = G(
    '..HHTTTTTTTTTTHH..',
    '..HHtTTTTTTTTtHH..',
    '..SSTTTTTTTTTTSS..',
    '..SSTTTTTTTTTTSS..',
    '...TTtTTTTTTtTT...',
    '..TTTTTTTTTTTTTT..',
)
LEGS_D = [G(
    '.....SSS..SSS.....',
    '.....SSS..SSS.....',
    '....FFFF..FFFF....',
    '....FFFF..FFFF....',
), G(
    '.....SSS..SSS.....',
    '....FFFF..SSS.....',
    '....FFFF..FFFF....',
    '..........FFFF....',
), G(
    '.....SSS..SSS.....',
    '.....SSS.FFFF.....',
    '....FFFF.FFFF.....',
    '....FFFF..........',
)]

HEAD_U = G(
    '.....HHHHHHHH.....',
    '...HHHHHHHHHHHH...',
    '..HHHHHhhHHHHHHH..',
    '..HHHHHHhHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '...HHHHHHHHHHHH...',
)
TORSO2_U = G(
    '..HHTTTTTTTTTTHH..',
    '..HHTTTTTTTTTTHH..',
    '..SSTTTTTTTTTTSS..',
    '..SSttttttttttSS..',
    '....BBBBBBBBBB....',
    '....BBBB..BBBB....',
)
TORSOD_U = G(
    '..HHTTTTTTTTTTHH..',
    '..HHTTTTTTTTTTHH..',
    '..SSTTTTTTTTTTSS..',
    '..SSTTTTTTTTTTSS..',
    '...TTTTTTTTTTTT...',
    '..TTTTTTTTTTTTTT..',
)

HEAD_R = G(
    '.....HHHHHHHH.....',
    '...HHHHHHHHHHHH...',
    '..HHHHHHHHhhHHH...',
    '..HHHHHHHHHhHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHSSSSSSSSH...',
    '..HHHsSSSSSEESS...',
    '..HHHsSSSSSEwSS...',
    '..HHHHsSSSSEESS...',
    '..HHHHsSSSSSSSs...',
    '..HHHHHSSSSMMSS...',
    '..HHHHHsSSSSSSs...',
)
TORSO2_R = G(
    '..HHHTTTTTTTTT....',
    '..HHHtTTTTTTTt....',
    '....STTTTTTTTS....',
    '....Stttttttts....',
    '.....BBBBBBBB.....',
    '.....BBB..BBB.....',
)
TORSOD_R = G(
    '..HHHTTTTTTTTT....',
    '..HHHtTTTTTTTt....',
    '....STTTTTTTTS....',
    '....STTTTTTTTS....',
    '....TTtTTTTtTT....',
    '....TTTTTTTTTT....',
)
LEGS_R = [G(
    '......SSS.SS......',
    '......SSS.SS......',
    '.....FFFF.FFF.....',
    '.....FFFF.FFF.....',
), G(
    '......SSS.SS......',
    '.....FFFF.SS......',
    '.....FFFF.FFF.....',
    '..........FFF.....',
), G(
    '......SSS.SS......',
    '......SSS.FFF.....',
    '.....FFFF.FFF.....',
    '.....FFFF.........',
)]

# ---------------- SHREY (NPC) ----------------
N_HEAD_D = G(
    '....HHH.HHHH......',
    '...HHHHHHHHHHH....',
    '..HHhHHHHHHHhHH...',
    '...HHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HSSSSSSSSSSSSH..',
    '..HSEESSSSEESSSH..',
    '..HSEwSSSSEwSSSH..',
    '..HSEESSSSEESSSH..',
    '..HsSSSSSSSSSSsH..',
    '..HSSSSMMMSSSSSH..',
    '..HSSSSSSSSSSSSH..',
)
N_TORSO_D = G(
    '..TTTTTTTTTTTTTT..',
    '..TTTTtNNNNtTTTT..',
    '..TTTTTTtNtTTTTT..',
    '..SSTTTTTTTTTTSS..',
    '..SSttttttttttSS..',
    '....BBBBBBBBBB....',
)
N_LEGS_D = G(
    '.....BBB..BBB.....',
    '.....BBB..BBB.....',
    '....FFFF..FFFF....',
    '....FFFF..FFFF....',
)

# NPC profile: short curly crop hugging the skull, sideburn, no trailing hair.
N_HEAD_R = G(
    '....HHHHHHHH......',
    '...HHHHHHHHHHH....',
    '..HHhHHHHHHHHHH...',
    '..HHHHHHHHHHHHH...',
    '..HHHHHHHHHHHHHH..',
    '...HHHSSSSSSSSS...',
    '...HHHsSSSSEESS...',
    '...HHHsSSSSEwSS...',
    '...HHHSsSSSEESS...',
    '....HHsSSSSSSSs...',
    '....HsSSSSSMMSS...',
    '.....sSSSSSSSs....',
)
N_TORSO_R = G(
    '....TTTTTTTTTT....',
    '....TTTTTTTTTT....',
    '....STTTTTTTTS....',
    '....Stttttttts....',
    '.....BBBBBBBB.....',
    '.....BBB..BBB.....',
)
N_LEGS_R = G(
    '......BBB.BB......',
    '......BBB.BB......',
    '.....FFFF.FFF.....',
    '.....FFFF.FFF.....',
)

def flip(grid):
    return [row[::-1] for row in grid]

def compose(parts):
    rows = []
    for p in parts:
        rows.extend(p)
    return rows

CELL_W, CELL_H = 20, 24
SCALE = 2

def render(grid, pal):
    h = len(grid)
    ox = (CELL_W - GW) // 2
    oy = CELL_H - h - 1
    px = [[None] * CELL_W for _ in range(CELL_H)]
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch != '.':
                px[oy + y][ox + x] = pal[ch]
    OUT = pal['#']
    res = [[None] * CELL_W for _ in range(CELL_H)]
    for y in range(CELL_H):
        for x in range(CELL_W):
            if px[y][x] is not None:
                res[y][x] = px[y][x]
            else:
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < CELL_W and 0 <= ny < CELL_H and px[ny][nx] is not None:
                        res[y][x] = OUT
                        break
    return res

def stamp_w_logo(cell, pal):
    W = (255, 255, 255, 255)
    base_y, cx = 13, 8
    pattern = ["X...X", "X.X.X", ".X.X."]
    for dy, prow in enumerate(pattern):
        for dx, ch in enumerate(prow):
            if ch == 'X':
                cell[base_y + dy][cx + dx] = W
    return cell

def sheet(frames_by_row, path):
    W, H = CELL_W * SCALE * 3, CELL_H * SCALE * 4
    px = bytearray(W * H * 4)
    for ry, row in enumerate(frames_by_row):
        for cx, cell in enumerate(row):
            for y in range(CELL_H):
                for x in range(CELL_W):
                    c = cell[y][x]
                    if c is None:
                        continue
                    for sy in range(SCALE):
                        for sx in range(SCALE):
                            yy = ry * CELL_H * SCALE + y * SCALE + sy
                            xx = cx * CELL_W * SCALE + x * SCALE + sx
                            o = (yy * W + xx) * 4
                            px[o:o+4] = bytes(c)
    write_rgba(path, W, H, px)
    print('wrote', path)

SKIN   = (248, 208, 160, 255)
SKINSH = (216, 160, 112, 255)
HAIR_M = (56, 40, 32, 255)
HAIR_MH= (96, 68, 52, 255)
EYE    = (32, 24, 32, 255)
GLINT  = (255, 255, 255, 255)
MOUTH  = (200, 96, 88, 255)
SHOE   = (40, 32, 24, 255)
OUTLN  = (32, 24, 16, 255)

def madison_pal(top, topsh, bottom, botsh):
    return {'#': OUTLN, 'S': SKIN, 's': SKINSH, 'H': HAIR_M, 'h': HAIR_MH,
            'E': EYE, 'w': GLINT, 'M': MOUTH, 'F': SHOE,
            'T': top, 't': topsh, 'B': bottom, 'b': botsh}

OUTFITS = {
    'badger':         dict(sil='two', top=(224, 24, 80, 255), topsh=(168, 8, 56, 255), bottom=(72, 96, 144, 255), botsh=(52, 70, 108, 255), logo=True),
    'black_dress':    dict(sil='dress', top=(52, 48, 64, 255), topsh=(34, 30, 44, 255), bottom=None, botsh=None, logo=False),
    'white_sundress': dict(sil='dress', top=(248, 244, 232, 255), topsh=(212, 204, 184, 255), bottom=None, botsh=None, logo=False),
    'casual':         dict(sil='two', top=(128, 136, 88, 255), topsh=(96, 104, 62, 255), bottom=(72, 96, 144, 255), botsh=(52, 70, 108, 255), logo=False),
}

BASE = r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\characters"
os.makedirs(BASE, exist_ok=True)

for name, o in OUTFITS.items():
    pal = madison_pal(o['top'], o['topsh'], o['bottom'] or (0,0,0,0), o['botsh'] or (0,0,0,0))
    torso_d = TORSOD_D if o['sil'] == 'dress' else TORSO2_D
    torso_u = TORSOD_U if o['sil'] == 'dress' else TORSO2_U
    torso_r = TORSOD_R if o['sil'] == 'dress' else TORSO2_R
    legcut = 1 if o['sil'] == 'dress' else 0
    rows = []
    for dirn in ('down', 'up', 'left', 'right'):
        cells = []
        for f in range(3):
            if dirn in ('down', 'up'):
                head = HEAD_D if dirn == 'down' else HEAD_U
                torso = torso_d if dirn == 'down' else torso_u
                legs = LEGS_D[f][legcut:]
            else:
                head, torso = HEAD_R, torso_r
                legs = LEGS_R[f][legcut:]
                if dirn == 'left':
                    head, torso, legs = flip(head), flip(torso), flip(legs)
            cell = render(compose([head, torso, legs]), pal)
            if o['logo'] and dirn == 'down':
                cell = stamp_w_logo(cell, pal)
            cells.append(cell)
        rows.append(cells)
    sheet(rows, BASE + f"\\player_{name}.png")

npc_pal = {'#': OUTLN, 'S': (216, 168, 120, 255), 's': (184, 136, 88, 255),
           'H': (32, 24, 20, 255), 'h': (60, 46, 36, 255),
           'E': EYE, 'w': GLINT, 'M': (160, 96, 72, 255),
           'F': (30, 24, 18, 255), 'T': (128, 136, 88, 255), 't': (96, 104, 62, 255),
           'B': (56, 56, 68, 255), 'b': (42, 42, 52, 255), 'N': (224, 224, 232, 255)}
N_HEAD_U = [r.replace('S', 'H').replace('E', 'H').replace('w', 'H').replace('M', 'H').replace('s', 'H') for r in N_HEAD_D]
N_TORSO_U = [r.replace('N', 'T') for r in N_TORSO_D]
rows = []
for dirn in ('down', 'up', 'left', 'right'):
    if dirn == 'down':
        grid = compose([N_HEAD_D, N_TORSO_D, N_LEGS_D])
    elif dirn == 'up':
        grid = compose([N_HEAD_U, N_TORSO_U, N_LEGS_D])
    else:
        g = compose([N_HEAD_R, N_TORSO_R, N_LEGS_R])
        grid = flip(g) if dirn == 'left' else g
    cell = render(grid, npc_pal)
    rows.append([cell, cell, cell])
sheet(rows, BASE + r"\npc_shrey.png")
