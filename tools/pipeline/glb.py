import json, struct, numpy as np
CT = {5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(path):
    with open(path,'rb') as f:
        f.read(12)
        clen,_=struct.unpack('<II',f.read(8)); j=json.loads(f.read(clen))
        blen,_=struct.unpack('<II',f.read(8)); b=f.read(blen)
    return j,b
def accessor(j,b,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
    dt=CT[a['componentType']]; n=NC[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride',0); itemsize=np.dtype(dt).itemsize*n
    if stride and stride!=itemsize:
        raw=np.frombuffer(b,dtype=np.uint8,count=stride*(a['count']-1)+itemsize,offset=off)
        arr=np.lib.stride_tricks.as_strided(raw,shape=(a['count'],itemsize),strides=(stride,1)).copy().view(dt).reshape(a['count'],n)
    else:
        arr=np.frombuffer(b,dtype=dt,count=a['count']*n,offset=off).reshape(a['count'],n)
    return arr
def node_matrix(n):
    if 'matrix' in n: return np.array(n['matrix'],dtype=float).reshape(4,4).T
    T=np.eye(4); R=np.eye(4); S=np.eye(4)
    if 'translation' in n: T[:3,3]=n['translation']
    if 'rotation' in n:
        x,y,z,w=n['rotation']
        R[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    if 'scale' in n: S[:3,:3]=np.diag(n['scale'])
    return T@R@S
def world_meshes(path):
    j,b=load(path); nodes=j['nodes']
    out=[]
    def walk(i,M):
        n=nodes[i]; W=M@node_matrix(n)
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                v=accessor(j,b,p['attributes']['POSITION']).astype(float)
                v=(np.c_[v,np.ones(len(v))]@W.T)[:,:3]
                idx=accessor(j,b,p['indices']).ravel() if 'indices' in p else np.arange(len(v))
                out.append({'node':i,'name':n.get('name',''),'v':v,'f':idx.reshape(-1,3)})
        for c in n.get('children',[]): walk(c,W)
    for r in j['scenes'][j.get('scene',0)]['nodes']: walk(r,np.eye(4))
    return j,out
