# Rebuild public/art/textures/skins from ambientCG CC0 2K-JPG downloads (Bricks105, CorrugatedSteel007A, Concrete034).
# Usage: SKIN_SRC=/path/with/unzipped/ambientCG/folders python3 scripts/build-skin-textures.py public/art/textures/skins
# Builds the building skin plates (albedo sRGB / normal GL / roughness) from ambientCG CC0 sources.
# Output: <outdir>/<id>_{albedo,normal,rough}.jpg (15 files). Seeded, so a rebuild is deterministic.
import sys,json,numpy as np
from PIL import Image
import os
SRC=os.environ.get('SKIN_SRC','./ambientcg'); OUT=sys.argv[1]
rng=np.random.default_rng(20261018)
def load(p,mode='RGB'): return np.asarray(Image.open(p).convert(mode),dtype=np.float32)/255
def save(a,p,q=92,mode='RGB'):
    a=np.clip(a,0,1); im=Image.fromarray((a*255+0.5).astype(np.uint8),mode); im.save(p,quality=q,subsampling=0 if mode=='RGB' else None,optimize=True) if mode=='RGB' else im.save(p,quality=q,optimize=True)
def lum(a): return a[...,0]*0.2126+a[...,1]*0.7152+a[...,2]*0.0722
def resize(a,w,h):
    if a.ndim==2: return np.asarray(Image.fromarray((np.clip(a,0,1)*65535).astype(np.uint16)).resize((w,h),Image.LANCZOS),dtype=np.float32)/65535
    return np.stack([resize(a[...,i],w,h) for i in range(a.shape[2])],-1)
def tile(a,nx,ny): return np.tile(a,(ny,nx,1) if a.ndim==3 else (ny,nx))
def pnoise(h,w,scale,seed):  # periodic band-limited noise, mean 0 std 1
    r=np.random.default_rng(seed); n=r.standard_normal((h,w)); F=np.fft.fft2(n)
    fy=np.fft.fftfreq(h)[:,None]*h; fx=np.fft.fftfreq(w)[None,:]*w; f=np.sqrt(fx**2+fy**2)
    F*=np.exp(-(f/scale)**2); o=np.real(np.fft.ifft2(F)); return (o-o.mean())/(o.std()+1e-9)
def height_to_normal(hm,strength):  # hm in pixels-height units; periodic central differences, GL (Y up = image up)
    dx=(np.roll(hm,-1,1)-np.roll(hm,1,1))*0.5*strength; dy=(np.roll(hm,1,0)-np.roll(hm,-1,0))*0.5*strength
    n=np.stack([-dx,-dy,np.ones_like(hm)],-1); n/=np.linalg.norm(n,axis=-1,keepdims=True); return n
def n_dec(a): n=a*2-1; return n/np.linalg.norm(n,axis=-1,keepdims=True)
def n_enc(n): return n*0.5+0.5
def n_blend(a,b):  # whiteout blend of two decoded normals
    n=np.stack([a[...,0]+b[...,0],a[...,1]+b[...,1],a[...,2]*b[...,2]],-1); return n/np.linalg.norm(n,axis=-1,keepdims=True)
def n_scale(n,s): m=np.stack([n[...,0]*s,n[...,1]*s,n[...,2]],-1); return m/np.linalg.norm(m,axis=-1,keepdims=True)
def rough_norm(r,mean=0.85): return np.clip(r*(mean/r.mean()),0.05,1)
def desat(a,keep): l=lum(a)[...,None]; return l+(a-l)*keep
meta={}
def emit(id,alb,nor,rou,tile_m,note):
    save(alb,f'{OUT}/{id}_albedo.jpg',90); save(n_enc(nor),f'{OUT}/{id}_normal.jpg',92); save(rou,f'{OUT}/{id}_rough.jpg',90,'L')
    meta[id]={'tile_m':tile_m,'size':[alb.shape[1],alb.shape[0]],'albedo_lum':float(lum(alb).mean()),'rough_mean':float(rou.mean()),'note':note}
    print(id,meta[id],flush=True)
c34=load(f'{SRC}/Concrete034/Concrete034_2K-JPG_Color.jpg'); c34n=n_dec(load(f'{SRC}/Concrete034/Concrete034_2K-JPG_NormalGL.jpg')); c34r=load(f'{SRC}/Concrete034/Concrete034_2K-JPG_Roughness.jpg','L')
if c34.shape[0]<c34.shape[1]: c34,c34n,c34r=tile(c34,1,2),tile(c34n,1,2),tile(c34r,1,2)
print('c34',c34.shape)
# 1) Brick: ambientCG Bricks105 (2048x1024 = 2.4 m x 1.2 m, 16 courses of 75 mm, ~225 mm bricks). AO baked in; 70% saturation.
b=load(f'{SRC}/Bricks105/Bricks105_2K-JPG_Color.jpg'); ao=load(f'{SRC}/Bricks105/Bricks105_2K-JPG_AmbientOcclusion.jpg','L')
b=desat(b,0.5)*(ao[...,None]**0.6)*np.array([1.03,1.0,0.97]); b*=0.70/lum(b).mean()
emit('brick',b,n_dec(load(f'{SRC}/Bricks105/Bricks105_2K-JPG_NormalGL.jpg')),rough_norm(load(f'{SRC}/Bricks105/Bricks105_2K-JPG_Roughness.jpg','L')),[2.4,1.2],'ambientCG Bricks105 (CC0)')
# 2) Cladding: ambientCG CorrugatedSteel007A (trapezoidal, 4 ribs per plate = 1.2 m at 0.3 m rib pitch). Neutral grey so the target colour tints it.
c=load(f'{SRC}/CorrugatedSteel007A/CorrugatedSteel007A_2K-JPG_Color.jpg'); ao=load(f'{SRC}/CorrugatedSteel007A/CorrugatedSteel007A_2K-JPG_AmbientOcclusion.jpg','L')
cn=n_dec(load(f'{SRC}/CorrugatedSteel007A/CorrugatedSteel007A_2K-JPG_NormalGL.jpg'))
l=lum(c); l=(l-l.mean())*0.8+l.mean(); rib=1+0.16*cn[...,0]  # gentle baked rib shading so the profile still reads once the normal map mips out
g=np.repeat((l*rib)[...,None],3,-1)*(ao[...,None]**1.4); g*=0.74/lum(g).mean()
emit('cladding',g,n_scale(cn,1.0),rough_norm(load(f'{SRC}/CorrugatedSteel007A/CorrugatedSteel007A_2K-JPG_Roughness.jpg','L')*0.6+0.4),[1.2,1.2],'ambientCG CorrugatedSteel007A (CC0), desaturated')
# 3) Precast / insulated panel: 3 m plate, joints every 1.0 m horizontally and one vertical joint; grain from Concrete034.
H=W=2048; px=W/3.0; hm=np.zeros((H,W),np.float32); alb=c34.copy()
yy,xx=np.mgrid[0:H,0:W]; jw=0.012*px
def groove(d,w): return np.clip(1-np.abs(d)/w,0,1)**0.7
dh=np.minimum.reduce([np.abs(yy-k*px) for k in range(0,4)]); dv=np.minimum(np.abs(xx-0),np.abs(xx-W))
gj=np.maximum(groove(dh,jw),groove(dv,jw)); hm-=gj*6
tone=np.zeros((H,W),np.float32)
for k in range(3): tone[(yy>=k*px)&(yy<(k+1)*px)]=rng.uniform(-0.035,0.035)
alb=(lum(alb).mean()+(desat(alb,0.0)-lum(alb).mean())*0.45)*(1+tone[...,None]+0.03*pnoise(H,W,6,1)[...,None])*(1-0.45*gj[...,None]); alb*=0.68/lum(alb).mean()
nor=n_blend(height_to_normal(hm,1.0),n_scale(c34n,0.6)); emit('panel',alb,nor,rough_norm(c34r*0.5+0.5),[3.0,3.0],'ambientCG Concrete034 (CC0) grain + drawn panel joints')
# 4) Concrete masonry units: 2.4 m plate, 400 x 200 mm modules (6 x 12), running bond, 10 mm recessed joints.
px=W/2.4; hm=np.zeros((H,W),np.float32); cw=0.4*px; ch=0.2*px; jw=0.006*px
row=(yy//ch).astype(int); off=(row%2)*cw/2; u=(xx+off)%cw; v=yy%ch; col=((xx+off)//cw).astype(int)%6
dj=np.minimum(np.minimum(u,cw-u),np.minimum(v,ch-v)); gj=groove(dj,jw*1.6); bev=np.clip(dj/(0.012*px),0,1)
hm=bev*5-gj*3
blk=rng.uniform(-0.05,0.05,(12,6)).astype(np.float32); bt=blk[row%12,col]
grain=lum(tile(resize(c34,1024,1024),2,2)); grain=(grain-grain.mean())*2.2
a=0.62+grain*0.35+bt+0.02*pnoise(H,W,10,2); a=a*(1-0.35*gj)+0.05*gj; alb=np.repeat(a[...,None],3,-1)*np.array([1.04,1.0,0.92]); alb*=0.62/lum(alb).mean()
nor=n_blend(height_to_normal(hm,1.2),n_scale(n_dec(tile(resize(c34n*0.5+0.5,1024,1024),2,2)),0.9)); emit('block',alb,nor,rough_norm(np.clip(0.8+grain*0.15+gj*0.1,0,1)),[2.4,2.4],'ambientCG Concrete034 (CC0) grain + drawn CMU courses')
# 5) Roof membrane: 4 m plate, lapped seams every 1.0 m, grain + periodic mottle, faint ponding stains.
px=W/4.0; hm=np.zeros((H,W),np.float32); s=(xx%px); lap=np.clip(1-np.abs(s-0.04*px)/(0.02*px),0,1)
hm+=lap*4+np.where(s<0.04*px,1.5,0)
grain=lum(tile(resize(c34,1024,1024),2,2)); grain=(grain-grain.mean())*1.6
mott=pnoise(H,W,4,3); stain=np.clip(pnoise(H,W,4,4)-1.0,0,None)
a=0.55+grain*0.18+0.02*mott-0.025*stain-0.06*lap; alb=np.repeat(a[...,None],3,-1)*np.array([0.985,1.0,1.02]); alb*=0.50/lum(alb).mean()
nor=n_blend(height_to_normal(hm,1.0),n_scale(n_dec(tile(resize(c34n*0.5+0.5,1024,1024),2,2)),0.7)); emit('membrane',alb,nor,rough_norm(np.clip(0.85+grain*0.1-0.06*stain,0,1)),[4.0,4.0],'ambientCG Concrete034 (CC0) grain + drawn lap seams')
print(json.dumps(meta,indent=1))
