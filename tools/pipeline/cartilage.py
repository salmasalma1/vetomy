import numpy as np
def tube(path_pts, radii, nseg=12):
    P=np.asarray(path_pts,float);n=len(P)
    T=np.gradient(P,axis=0);T/=np.linalg.norm(T,axis=1,keepdims=True)
    ref=np.array([0,1.,0]);verts=[]
    N0=np.cross(T[0],ref);
    if np.linalg.norm(N0)<1e-6: N0=np.cross(T[0],[1.,0,0])
    N=N0/np.linalg.norm(N0)
    for i in range(n):
        N=N-T[i]*(N@T[i]);N/=np.linalg.norm(N);B=np.cross(T[i],N)
        a=np.linspace(0,2*np.pi,nseg,endpoint=False)
        ring=P[i]+radii[i]*(np.cos(a)[:,None]*N+0.75*np.sin(a)[:,None]*B)
        verts.append(ring)
    V=np.vstack(verts);F=[]
    for i in range(n-1):
        for j in range(nseg):
            a=i*nseg+j;b=i*nseg+(j+1)%nseg;c=a+nseg;d=b+nseg
            F+=[[a,c,b],[b,c,d]]
    # caps
    for i,flip in ((0,True),(n-1,False)):
        ci=len(V);V=np.vstack([V,P[i][None]])
        for j in range(nseg):
            a=i*nseg+j;b=i*nseg+(j+1)%nseg
            F.append([ci,a,b] if flip else [ci,b,a])
    return V,np.array(F)
def bezier(E,K,T,n=18):
    t=np.linspace(0,1,n)[:,None];return (1-t)**2*E+2*(1-t)*t*K+t**2*T
def costal_cartilages(V,C,name,stern_name='sternum',targets_z=None,side_sign={'L':1,'R':-1},mid_x=0,nrib=8,r0=5.0,r1=3.5,up=1,order=None):
    st=np.vstack([V[np.unique(c['faces'])] for c in C if name.get(c['id'])==stern_name])
    out={}
    for S,sg in side_sign.items():
        if order:
            byid={c['id']:c for c in C};ribs=[byid[i] for i in order[S]]
        else:
            ribs=[c for c in C if name.get(c['id'])=='ribs_'+S]
            ribs.sort(key=lambda c:-c['max'][2])
        Vs=[];Fs=[];o=0
        for k,c in enumerate(ribs[:nrib]):
            p=V[np.unique(c['faces'])];E=p[p[:,up].argmin()]
            zt=targets_z[k]
            m=np.abs(st[:,2]-zt)<max(6,0.02*np.ptp(st[:,2]))
            q=st[m] if m.sum()>=10 else st[np.argsort(np.abs(st[:,2]-zt))[:200]]
            T=q[np.argmax(q[:,0]*sg)].copy()
            T[0]-=sg*r1*0.6   # sink slightly into the sternum
            K=np.array([0.65*E[0]+0.35*T[0],min(E[1],T[1])-0.25*abs(E[1]-T[1]),0.35*E[2]+0.65*T[2]])
            path=bezier(E,K,T)
            near=p[np.linalg.norm(p-E,axis=1)<4*r0]
            r=np.linspace(r0,r1,len(path))
            v,f=tube(path,r);Vs.append(v);Fs.append(f+o);o+=len(v)
        out['costal_cartilage_'+S]=(np.vstack(Vs),np.vstack(Fs))
    return out
