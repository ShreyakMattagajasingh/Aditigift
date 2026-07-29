import struct, zlib
from collections import deque

def read_png(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    i = 8; W=H=bd=ct=None; idat=b''
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; typ = d[i+4:i+8]; chunk = d[i+8:i+8+ln]
        if typ == b'IHDR': W,H,bd,ct = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT': idat += chunk
        elif typ == b'IEND': break
        i += 8 + ln + 4
    assert bd == 8 and ct in (2,6), (bd,ct)
    ch = 3 if ct == 2 else 4
    raw = zlib.decompress(idat)
    stride = W*ch
    out = bytearray(H*stride)
    def paeth(a,b,c):
        p=a+b-c; pa=abs(p-a); pb=abs(p-b); pc=abs(p-c)
        return a if pa<=pb and pa<=pc else (b if pb<=pc else c)
    pos=0
    for y in range(H):
        ft = raw[pos]; pos+=1
        row = raw[pos:pos+stride]; pos+=stride
        o = y*stride
        for x in range(stride):
            v = row[x]
            a = out[o+x-ch] if x>=ch else 0
            b = out[o+x-stride] if y>0 else 0
            c = out[o+x-stride-ch] if (x>=ch and y>0) else 0
            if ft==0: r=v
            elif ft==1: r=v+a
            elif ft==2: r=v+b
            elif ft==3: r=v+((a+b)>>1)
            elif ft==4: r=v+paeth(a,b,c)
            else: raise ValueError(ft)
            out[o+x]=r&255
    return W,H,ch,out

def write_rgba(path,W,H,px):
    stride=W*4
    raw=bytearray()
    for y in range(H):
        raw.append(0)
        raw += px[y*stride:(y+1)*stride]
    comp=zlib.compress(bytes(raw),9)
    def chunk(typ,data):
        return struct.pack('>I',len(data))+typ+data+struct.pack('>I',zlib.crc32(typ+data)&0xffffffff)
    ihdr=struct.pack('>IIBBBBB',W,H,8,6,0,0,0)
    out=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',ihdr)+chunk(b'IDAT',comp)+chunk(b'IEND',b'')
    open(path,'wb').write(out)

def process(src, dst, bg_thresh_min=185, bg_thresh_range=18):
    W,H,ch,buf = read_png(src)
    rgba=bytearray(W*H*4)
    for i in range(W*H):
        rgba[i*4]=buf[i*ch]; rgba[i*4+1]=buf[i*ch+1]; rgba[i*4+2]=buf[i*ch+2]; rgba[i*4+3]=255

    def is_bg(idx):
        r=rgba[idx*4]; g=rgba[idx*4+1]; b=rgba[idx*4+2]
        mx=max(r,g,b); mn=min(r,g,b)
        return mn>=bg_thresh_min and (mx-mn)<=bg_thresh_range

    visited=bytearray(W*H)
    dq=deque()
    for x in range(W):
        for y in (0,H-1):
            i=y*W+x
            if not visited[i] and is_bg(i): visited[i]=1; dq.append(i)
    for y in range(H):
        for x in (0,W-1):
            i=y*W+x
            if not visited[i] and is_bg(i): visited[i]=1; dq.append(i)
    while dq:
        i=dq.popleft()
        rgba[i*4+3]=0
        x=i%W; y=i//W
        for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0<=nx<W and 0<=ny<H:
                j=ny*W+nx
                if not visited[j] and is_bg(j):
                    visited[j]=1; dq.append(j)

    minx=miny=10**9; maxx=maxy=-1
    for y in range(H):
        base=y*W
        for x in range(W):
            if rgba[(base+x)*4+3]!=0:
                if x<minx:minx=x
                if x>maxx:maxx=x
                if y<miny:miny=y
                if y>maxy:maxy=y
    cw=maxx-minx+1; chh=maxy-miny+1
    crop=bytearray(cw*chh*4)
    for y in range(chh):
        srco=( (y+miny)*W + minx )*4
        dsto=y*cw*4
        crop[dsto:dsto+cw*4]=rgba[srco:srco+cw*4]
    write_rgba(dst,cw,chh,crop)
    print(f"{src} -> {dst}: {cw}x{chh} (aspect w/h={cw/chh:.3f})")

base = r"C:\Users\shrey\OneDrive\Desktop\work\khudka\aditigift\imageasset\bedroom"
process(base + r"\shelves.png", base + r"\shelves_cut.png")
