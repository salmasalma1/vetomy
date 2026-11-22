import numpy as np,pickle
d=pickle.load(open('catorig_comps.pkl','rb'));V=d['V'];C=d['comps']
X,Y,Z=V.T;P=V
def seg_dist(P,A,B):
    A=np.asarray(A,float);B=np.asarray(B,float);AB=B-A
    t=np.clip(((P-A)@AB)/(AB@AB),0,1);return np.linalg.norm(P-(A+t[:,None]*AB),axis=1)
CH={'fore':[(0.82,0.76),(1.08,0.37),(0.8,-0.08),(0.9,-0.8),(0.95,-0.9),(1.05,-1.0),(1.17,-1.035)],
    'hind':[(-1.05,0.45),(-0.7,-0.02),(-1.2,-0.55),(-1.1,-0.7),(-0.88,-0.95),(-0.73,-0.995)]}
SEGN={'fore':['scapula','humerus','radius','carpus','metacarpus','phalanges_fore'],
      'hind':['femur','tibia','tarsus','metatarsus','phalanges_hind']}
def limbvote(pts,side):
    best=None;bd=np.full(len(pts),9.);lab=np.empty(len(pts),object)
    xs=np.median(np.abs(pts[:,0]))
    for limb,J in CH.items():
        J3=[(xs*side,y,z) for z,y in J]
        for i in range(len(J3)-1):
            dd=seg_dist(pts,J3[i],J3[i+1]);b=dd<bd;bd[b]=dd[b];lab[b]=SEGN[limb][i]
    u,n=np.unique(lab.astype(str),return_counts=True);return u[n.argmax()],np.median(bd)
spine_c=[15,18,41,36,39,23,27];spine_t=[22,21,24,19,34,28,35,25,30,26,33,29,20];spine_l=[17,16,14,13,12,11,10]
spine_cd=[38,42,45,52,53,85,81,87,109,110,108,111,112,117,116,115,124]
stern=[157,136,145,144,155,146,156,102]
name={0:'skull',3:'mandible',1:'os_coxae',2:'sacrum',15:'atlas',18:'axis'}
for i,c in enumerate(spine_c[2:]): name[c]=f'vertebra_c{i+3}'
for i,c in enumerate(spine_t): name[c]=f'vertebra_t{i+1}'
for i,c in enumerate(spine_l): name[c]=f'vertebra_l{i+1}'
for i,c in enumerate(spine_cd): name[c]=f'vertebra_cd{i+1}'
for c in stern: name[c]='sternum'
info={}
for c in C:
    i=c['id']
    if i in name: continue
    x,y,z=c['c']
    if z>1.55: name[i]='teeth';continue
    pts=V[np.unique(c['faces'])];side=1 if x>0 else -1;S='L' if x>0 else 'R'
    lab,md=limbvote(pts,side)
    ribzone=(-0.05<z<1.12) and y>-0.05 and (md>0.15 or abs(x)<0.09 or (abs(x)<0.16 and not (lab in('humerus','radius') and md<0.05)))
    if ribzone and lab!='scapula': name[i]='ribs_'+S
    else: name[i]=lab+'_'+S
    info[i]=(lab,round(float(md),3))
for S in 'LR':
    for b in ('scapula','humerus'):
        cs=sorted([c for c in C if name[c['id']]==b+'_'+S],key=lambda c:-c['nf'])
        for c in cs[1:]: name[c['id']]='ribs_'+S
# fix pairs: ulna/radius, fibula/tibia, patella
for S in 'LR':
    fa=[c for c in C if name[c['id']]=='radius_'+S]
    if len(fa)>=2:
        fa=sorted(fa,key=lambda c:-c['nf'])[:2]; u=max(fa,key=lambda c:c['max'][1]); name[u['id']]='ulna_'+S
    tb=sorted([c for c in C if name[c['id']]=='tibia_'+S],key=lambda c:-c['nf'])
    for c in tb[1:]:
        if c['nf']>2500 and (c['max'][1]-c['min'][1])>0.3: name[c['id']]='fibula_'+S
        elif c['nf']<2500 and c['c'][1]>-0.12: name[c['id']]='patella_'+S
    for c in C:
        if name[c['id']]=='femur_'+S and c['nf']<3000: name[c['id']]='patella_'+S
pickle.dump(name,open('catorig_names.pkl','wb'))
from collections import Counter
cnt=Counter(name.values());print(sorted(cnt.items()));import sys;sys.exit()
for c in C:
    n=name[c['id']]
    if any(n.startswith(k) for k in ('scapula','humerus','radius','ulna','femur','tibia','fibula','patella')): print(c['id'],n,c['nf'],c['c'].round(2),(c['max']-c['min']).round(2),info.get(c['id']))
