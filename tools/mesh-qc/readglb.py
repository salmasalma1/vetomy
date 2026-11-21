"""Minimal GLB reader: positions and indices of every named mesh."""
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

def bones(path):
    j,b=load(path);out=[]
    for n in j['nodes']:
        if 'mesh' not in n: continue
        m=j['meshes'][n['mesh']]
        for pr in m['primitives']:
            p=accessor(j,b,pr['attributes']['POSITION']).astype(float)
            f=accessor(j,b,pr['indices']).astype(np.int64).reshape(-1,3)
            out.append((n.get('name',m.get('name')),p,f))
    return j,out
