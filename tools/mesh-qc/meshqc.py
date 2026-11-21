"""Mesh metrics for one triangle mesh (p: Nx3, f: Mx3)."""
import numpy as np, scipy.sparse as sp, scipy.sparse.csgraph as cg
def weld(p,f,tol_rel=1e-6):
    tol=max(np.ptp(p,0).max()*tol_rel,1e-12)
    _,inv=np.unique(np.round(p/tol).astype(np.int64),axis=0,return_inverse=True);inv=inv.ravel()
    q=np.zeros((inv.max()+1,3));q[inv]=p;return q,inv[f]
def metrics(p,f):
    p=np.asarray(p,float);p,f=weld(p,np.asarray(f,np.int64))
    a,b,c=p[f[:,0]],p[f[:,1]],p[f[:,2]]
    cr=np.cross(b-a,c-a);area2=np.linalg.norm(cr,axis=1)
    e=np.r_[np.linalg.norm(b-a,axis=1),np.linalg.norm(c-b,axis=1),np.linalg.norm(a-c,axis=1)]
    med=np.median(e)
    degen=int(((area2<1e-12*max(med,1e-9)**2)|(f[:,0]==f[:,1])|(f[:,1]==f[:,2])|(f[:,0]==f[:,2])).sum())
    E=np.sort(np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),1)
    _,cnt=np.unique(E,axis=0,return_counts=True)
    boundary=int((cnt==1).sum());nonman=int((cnt>2).sum())
    n=len(p);G=sp.coo_matrix((np.ones(f.size),(f.ravel(),np.roll(f,1,1).ravel())),shape=(n,n))
    used=np.unique(f);nc,lab=cg.connected_components(G,directed=False)
    comps=len(np.unique(lab[used]))
    vol=float(np.einsum('ij,ij->i',a,np.cross(b,c)).sum()/6)
    area=float(area2.sum()/2)
    # orientation consistency: directed edges that appear twice in the same direction
    D=np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);_,dc=np.unique(D,axis=0,return_counts=True)
    flipped=int((dc>1).sum())
    # spikes: vertices whose incident edges are much longer than the mesh median edge
    long_edges=int((e>8*med).sum())
    # sliver triangles (very sharp): min angle < 2 degrees
    def ang(u,v):
        cu=np.einsum('ij,ij->i',u,v)/(np.linalg.norm(u,axis=1)*np.linalg.norm(v,axis=1)+1e-30);return np.degrees(np.arccos(np.clip(cu,-1,1)))
    mn=np.minimum(np.minimum(ang(b-a,c-a),ang(a-b,c-b)),ang(a-c,b-c))
    slivers=int((mn<2).sum())
    ext=np.ptp(p[used],0)
    return dict(faces=len(f),verts=len(used),area=area,volume=vol,bbox=ext.round(4).tolist(),boundary_edges=boundary,
                nonmanifold_edges=nonman,degenerate=degen,components=comps,flipped_edges=flipped,long_edges=long_edges,
                slivers=slivers,median_edge=float(med))

def sample_surface(p,f,n,seed=0):
    rng=np.random.default_rng(seed);p=np.asarray(p,float);f=np.asarray(f)
    a,b,c=p[f[:,0]],p[f[:,1]],p[f[:,2]];ar=np.linalg.norm(np.cross(b-a,c-a),axis=1)
    if ar.sum()<=0: return p
    idx=rng.choice(len(f),n,p=ar/ar.sum());u=rng.random(n);v=rng.random(n);s=u+v>1;u[s]=1-u[s];v[s]=1-v[s]
    return a[idx]+u[:,None]*(b[idx]-a[idx])+v[:,None]*(c[idx]-a[idx])
def spike_score(p,f):
    """Per-vertex umbrella displacement divided by mean incident edge length. Needles score high."""
    p,f=weld(np.asarray(p,float),np.asarray(f,np.int64));n=len(p)
    E=np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);E=np.unique(np.sort(E,1),axis=0)
    i=np.r_[E[:,0],E[:,1]];j=np.r_[E[:,1],E[:,0]]
    deg=np.bincount(i,minlength=n).astype(float);deg[deg==0]=1
    nb=np.zeros((n,3));np.add.at(nb,i,p[j]);nb/=deg[:,None]
    el=np.linalg.norm(p[i]-p[j],axis=1);ml=np.bincount(i,el,minlength=n)/deg
    return np.linalg.norm(p-nb,axis=1)/np.maximum(ml,1e-12)

def folds(p,f,cos_thr=-0.5):
    """Edges whose two faces point in nearly opposite directions: folded sheets and spikes."""
    p,f=weld(np.asarray(p,float),np.asarray(f,np.int64))
    nrm=np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]]);ln=np.linalg.norm(nrm,axis=1);ok=ln>0;nrm[ok]/=ln[ok,None]
    E=np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);E=np.sort(E,1);fid=np.tile(np.arange(len(f)),3)
    key=E[:,0]*(len(p)+1)+E[:,1];o=np.argsort(key);k=key[o];fo=fid[o]
    same=k[1:]==k[:-1];a=fo[:-1][same];b=fo[1:][same]
    c=np.einsum('ij,ij->i',nrm[a],nrm[b])
    return int((c<cos_thr).sum())
