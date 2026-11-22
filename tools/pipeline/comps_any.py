from glb import *
import numpy as np, scipy.sparse as sp, scipy.sparse.csgraph as cg, pickle, sys, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
name=sys.argv[1]
j,ms=world_meshes(f'/home/claude/dl_models/{name}.plain.glb')
V=np.vstack([m['v'] for m in ms]); F=[];o=0
for m in ms: F.append(m['f']+o); o+=len(m['v'])
F=np.vstack(F); tol=np.ptp(V,axis=0).max()*1e-5
key=np.round(V/tol).astype(np.int64); _,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.ravel(); Fw=inv[F]; n=inv.max()+1
Vw=np.zeros((n,3)); Vw[inv]=V
G=sp.coo_matrix((np.ones(Fw.size),(np.r_[Fw[:,0],Fw[:,1],Fw[:,2]],np.r_[Fw[:,1],Fw[:,2],Fw[:,0]])),shape=(n,n))
nc,lab=cg.connected_components(G,directed=False); flab=lab[Fw[:,0]]
comps=[]
order=np.argsort(flab); fl=flab[order]; bounds=np.searchsorted(fl,np.arange(nc+1))
for c in range(nc):
    fi=order[bounds[c]:bounds[c+1]]
    if len(fi)==0: continue
    vi=np.unique(Fw[fi]); pts=Vw[vi]
    comps.append({'faces':Fw[fi],'nf':len(fi),'c':pts.mean(0),'min':pts.min(0),'max':pts.max(0)})
comps.sort(key=lambda c:-c['nf'])
for i,c in enumerate(comps): c['id']=i
pickle.dump({'V':Vw,'comps':comps},open(f'{name}_comps.pkl','wb'))
fig,axs=plt.subplots(2,1,figsize=(20,22))
rng=np.random.default_rng(0)
for ax,(hx,vy,title) in zip(axs,[(2,1,'lateral z-y'),(2,0,'dorsal z-x')]):
    for c in comps:
        vi=np.unique(c['faces']); pts=Vw[vi]
        if len(pts)>500: pts=pts[rng.choice(len(pts),500,replace=False)]
        big=c['nf']>200
        ax.scatter(pts[:,hx],pts[:,vy],s=0.4 if big else 0.2,color=plt.cm.tab20(c['id']%20) if big else '#bbb')
        if big and c['nf']>400: ax.text(c['c'][hx],c['c'][vy],str(c['id']),fontsize=6,ha='center')
    ax.set_aspect('equal'); ax.set_title(f'{name} {title}')
plt.savefig(f'{name}_comps.png',dpi=70,bbox_inches='tight')
print(name,'saved; big comps',sum(c['nf']>200 for c in comps))
for c in comps[:12]: print('  ',c['id'],c['nf'],'c',c['c'].round(2),'size',(c['max']-c['min']).round(2))
