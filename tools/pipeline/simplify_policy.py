"""Simplification policy for published bones.
Topology-preserving quadric simplification (meshoptimizer), run separately on every connected
piece so each piece's error is measured against its own size. Small pieces are left untouched."""
import sys,os;sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'native'))
import numpy as np, scipy.sparse as sp, scipy.sparse.csgraph as cg
from meshopt import simplify
KEEP_BELOW=3000         # faces per piece: pieces at or under this are published exactly as scanned
MIN_KEEP_RATIO=0.25     # never go below 25% of a piece's original faces
MAX_ERROR=0.0015        # max deviation, relative to the piece's own size
def pieces(f,n):
    G=sp.coo_matrix((np.ones(f.size),(f.ravel(),np.roll(f,1,1).ravel())),shape=(n,n))
    _,lab=cg.connected_components(G,directed=False);fl=lab[f[:,0]]
    return [np.where(fl==k)[0] for k in np.unique(fl)]
def reduce(p,f,name,log=None):
    if name.startswith('costal') or len(f)<=KEEP_BELOW:
        if log is not None: log.append((name,len(f),len(f),0.0,'kept'))
        return p,f
    P=[];F=[];o=0;errs=[]
    for idx in pieces(f,len(p)):
        sub=f[idx];vi,inv=np.unique(sub,return_inverse=True);q=p[vi];g=inv.reshape(-1,3)
        if len(g)>KEEP_BELOW:
            q,g,e=simplify(q,g,max(KEEP_BELOW,int(MIN_KEEP_RATIO*len(g))),MAX_ERROR);errs.append(e)
        P.append(q);F.append(g+o);o+=len(q)
    q=np.vstack(P);g=np.vstack(F)
    if log is not None: log.append((name,len(f),len(g),max(errs) if errs else 0.0,'simplified'))
    return q,g
