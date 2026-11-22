import pickle, numpy as np, json, struct
d=pickle.load(open('dog-skeleton_comps.pkl','rb')); V=d['V']; C=d['comps']
R=np.array([[0,0,1],[0,1,0],[-1,0,0]],float)
ground=V[:,1].min(); s=0.55/(0.20-ground)
groups={'skeleton':C}
order=['skeleton']
bin_=bytearray(); bufviews=[]; accessors=[]; meshes=[]; nodes=[]
def add(arr, target, comp, typ, minmax=False):
    while len(bin_)%4: bin_.append(0)
    off=len(bin_); b=arr.tobytes(); bin_.extend(b)
    bufviews.append({'buffer':0,'byteOffset':off,'byteLength':len(b),'target':target})
    a={'bufferView':len(bufviews)-1,'componentType':comp,'count':len(arr),'type':typ}
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    accessors.append(a); return len(accessors)-1
for name in order:
    F=np.vstack([c['faces'] for c in groups[name]])
    vi,inv=np.unique(F,return_inverse=True)
    f=inv.reshape(-1,3).astype(np.uint32)
    p=((V[vi]-[0,ground,0])@R.T*s).astype(np.float32)
    # area-weighted vertex normals
    a,b,c=p[f[:,0]],p[f[:,1]],p[f[:,2]]
    fn=np.cross(b-a,c-a); n=np.zeros_like(p)
    for k in range(3): np.add.at(n,f[:,k],fn)
    n/= (np.linalg.norm(n,axis=1,keepdims=True)+1e-12); n=n.astype(np.float32)
    ip=add(p,34962,5126,'VEC3',True); inn=add(n,34962,5126,'VEC3'); ii=add(f.ravel(),34963,5125,'SCALAR')
    meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':ip,'NORMAL':inn},'indices':ii,'material':0}]})
    nodes.append({'name':name,'mesh':len(meshes)-1})
gltf={'asset':{'version':'2.0','generator':'Vetomy pipeline',
  'extras':{'title':'Dog Skeleton','author':'PratyushParag (Sketchfab)',
            'license':'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
            'source':'https://sketchfab.com/3d-models/dog-skeleton-9d8a370acbd04f93a7a6fcd15ef36eda',
            'modifications':'Kept as a single piece (not split into bones), reoriented and rescaled to metres.'}},
  'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,
  'materials':[{'name':'bone','pbrMetallicRoughness':{'baseColorFactor':[0.93,0.9,0.84,1],'metallicFactor':0,'roughnessFactor':0.6}}],
  'accessors':accessors,'bufferViews':bufviews,'buffers':[{'byteLength':len(bin_)}]}
js=json.dumps(gltf,separators=(',',':')).encode()
js+=b' '*((4-len(js)%4)%4)
while len(bin_)%4: bin_.append(0)
out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(bin_))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin_),0x004E4942)+bytes(bin_)
open('/home/claude/work/preview/dog.glb','wb').write(out)
print('written', len(out)/1e6,'MB', len(nodes),'bones')
