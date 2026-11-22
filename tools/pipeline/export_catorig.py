import pickle, numpy as np, json, struct
d=pickle.load(open('catorig_comps.pkl','rb')); V=d['V']; C=d['comps']
name=pickle.load(open('catorig_names.pkl','rb'))
for c in C:
    n=name[c['id']]
    if n.startswith(('metacarpus','metatarsus')) and (c['max'][1]-c['min'][1])<0.06 and c['nf']>900:
        name[c['id']]=n.replace('metacarpus','phalanges_fore').replace('metatarsus','phalanges_hind')
R=np.array([[0,0,1],[0,1,0],[-1,0,0]],float)
ground=V[:,1].min(); s=0.25/(0.78-ground)
groups={}
for c in C: groups.setdefault(name[c['id']],[]).append(c)
def vkey(n):
    import re
    m=re.match(r'vertebra_(c|t|l|cd)(\d+)',n)
    if n=='atlas': return (1,0)
    if n=='axis': return (1,1)
    if m: return (1,{'c':0,'t':100,'l':200,'cd':400}[m.group(1)]+int(m.group(2)))
    return (2,0)
order=['skull','mandible','teeth']+sorted([n for n in groups if vkey(n)[0]==1],key=vkey)+['sacrum','ribs_L','ribs_R','sternum','os_coxae']
for b in ['scapula','humerus','radius','ulna','carpus','metacarpus','phalanges_fore','femur','patella','tibia','fibula','tarsus','metatarsus','phalanges_hind']: order+=[b+'_L',b+'_R']
assert set(order)==set(groups), set(groups)^set(order)
bin_=bytearray(); bufviews=[]; accessors=[]; meshes=[]; nodes=[]
def add(arr, target, comp, typ, minmax=False, stride=None, norm=False, count=None):
    while len(bin_)%4: bin_.append(0)
    off=len(bin_); b=arr.tobytes(); bin_.extend(b)
    bv={'buffer':0,'byteOffset':off,'byteLength':len(b),'target':target}
    if stride: bv['byteStride']=stride
    bufviews.append(bv)
    a={'bufferView':len(bufviews)-1,'componentType':comp,'count':count or len(arr),'type':typ}
    if norm: a['normalized']=True
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    accessors.append(a); return len(accessors)-1
for nm in order:
    F=np.vstack([c['faces'] for c in groups[nm]])
    vi,inv=np.unique(F,return_inverse=True)
    f=inv.reshape(-1,3).astype(np.uint32)
    p=((V[vi]-[0,ground,0])@R.T*s).astype(np.float32)
    # area-weighted vertex normals
    a,b,c=p[f[:,0]],p[f[:,1]],p[f[:,2]]
    fn=np.cross(b-a,c-a); n=np.zeros_like(p)
    for k in range(3): np.add.at(n,f[:,k],fn)
    n/= (np.linalg.norm(n,axis=1,keepdims=True)+1e-12); n=n.astype(np.float32)
    nq=np.zeros((len(n),4),np.int8); nq[:,:3]=np.round(n*127)
    ip=add(p,34962,5126,'VEC3',True); inn=add(nq,34962,5120,'VEC3',stride=4,norm=True,count=len(n))
    ii=add(f.ravel().astype(np.uint16),34963,5123,'SCALAR') if len(p)<65536 else add(f.ravel(),34963,5125,'SCALAR')
    meshes.append({'name':nm,'primitives':[{'attributes':{'POSITION':ip,'NORMAL':inn},'indices':ii,'material':0}]})
    nodes.append({'name':nm,'mesh':len(meshes)-1})
gltf={'extensionsUsed':['KHR_mesh_quantization'],'extensionsRequired':['KHR_mesh_quantization'],'asset':{'version':'2.0','generator':'Vetomy pipeline',
  'extras':{'title':'Feline Skeleton Dec','author':'westerly (https://sketchfab.com/westerly)',
            'license':'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
            'source':'https://sketchfab.com/3d-models/feline-skeleton-dec-a5d0bb8f55dc4f49b103cd20d65e0b17',
            'modifications':'Split into individual named bones, renamed with anatomical names, reoriented and rescaled to metres.'}},
  'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,
  'materials':[{'name':'bone','pbrMetallicRoughness':{'baseColorFactor':[0.93,0.9,0.84,1],'metallicFactor':0,'roughnessFactor':0.6}}],
  'accessors':accessors,'bufferViews':bufviews,'buffers':[{'byteLength':len(bin_)}]}
js=json.dumps(gltf,separators=(',',':')).encode()
js+=b' '*((4-len(js)%4)%4)
while len(bin_)%4: bin_.append(0)
out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(bin_))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin_),0x004E4942)+bytes(bin_)
open('/home/claude/vetomy-gh/models/skeletons/cat.glb','wb').write(out)
print('written', len(out)/1e6,'MB', len(nodes),'bones')
