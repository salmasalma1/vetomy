import numpy as np,pickle
d=pickle.load(open('camelT_comps.pkl','rb'));V=d['V'];C=d['comps']
MIDX=0
def seg_dist(P,A,B):
    A=np.asarray(A,float);B=np.asarray(B,float);AB=B-A
    t=np.clip(((P-A)@AB)/(AB@AB),0,1);return np.linalg.norm(P-(A+t[:,None]*AB),axis=1)
CH={('fore','L'):[(1650,1690),(1780,1230),(1500,1035),(1505,460),(1515,420),(1560,60),(1700,0)],
    ('fore','R'):[(1580,1670),(1730,1215),(1640,930),(1830,440),(1855,380),(2000,60),(2150,0)],
    ('hind','L'):[(370,1360),(440,870),(90,560),(80,440),(20,110),(150,10)],
    ('hind','R'):[(370,1360),(575,990),(580,520),(600,440),(700,100),(800,10)]}
SEGN={'fore':['scapula','humerus','radius','carpus','metacarpus','phalanges_fore'],
      'hind':['femur','tibia','tarsus','metatarsus','phalanges_hind']}
def limbvote(pts,S):
    bd=np.full(len(pts),1e9);lab=np.empty(len(pts),object)
    for (limb,s),J in CH.items():
        if s!=S: continue
        for i in range(len(J)-1):
            dd=seg_dist(pts[:,[2,1]],J[i],J[i+1]);b=dd<bd;bd[b]=dd[b];lab[b]=SEGN[limb][i]
    u,n=np.unique(lab.astype(str),return_counts=True);return u[n.argmax()],float(np.median(bd))
name={6:'skull',8:'mandible',54:'hyoid',55:'os_coxae',24:'sacrum',63:'atlas',92:'axis'}
for i,c in enumerate([36,62,68,64,48]): name[c]=f'vertebra_c{i+3}'
for i,c in enumerate([47,52,37,44,28,43,49,35,41,42,38,56]): name[c]=f'vertebra_t{i+1}'
for i,c in enumerate([32,33,34,20,29,21,53]): name[c]=f'vertebra_l{i+1}'
for i,c in enumerate([57,46,67,81,119,9,107,103,117,126,130,129,131,132,133,134,135,136,139]): name[c]=f'vertebra_cd{i+1}'
for c in [10,11,45,22]: name[c]='sternum'
drop=set()
info={}
for c in C:
    i=c['id']
    if i in name or i in drop: continue
    x,y,z=c['c'];S='L' if x>MIDX else 'R'
    pts=V[np.unique(c['faces'])]
    lab,md=limbvote(pts,S)
    ribzone=(880<z<1900) and y>1000 and (md>80 or abs(x-MIDX)<120)
    name[i]=('ribs_'+S) if ribzone and not (lab in('scapula','humerus') and md<50) else lab+'_'+S
    info[i]=(lab,round(md))
for S in 'LR':
    for b in ('scapula','humerus','femur','tibia','radius'):
        cs=sorted([c for c in C if name.get(c['id'])==b+'_'+S],key=lambda c:-c['nf'])
        for c in cs[1:]:
            if b in('scapula','humerus') and 880<c['c'][2]<1900 and c['c'][1]>1000: name[c['id']]='ribs_'+S
            elif b=='femur' and c['nf']<15000: name[c['id']]='patella_'+S
            elif b=='radius' and c['nf']<15000: name[c['id']]='ulna_'+S
            elif b=='tibia' and c['nf']<15000: name[c['id']]='tibia_'+S
for d_ in drop: name[d_]=None
name[50]='scapula_R';name[51]='scapula_L';name[18]='ribs_R';name[19]='ribs_L';name[1]=name[2]='carpus_L';name[61]='radius_L';name[120]='patella_R'
pickle.dump(name,open('camel_names.pkl','wb'))
from collections import Counter
print(sorted(Counter(v for v in name.values() if v and not v.startswith('vertebra')).items()))
for c in C:
    n=name[c['id']]
    if n and n.split('_')[0] in ('scapula','humerus','radius','ulna','femur','tibia','patella','ribs') and c['nf']>9000 or (n and 'patella' in n) or (n and 'ulna' in n): print(c['id'],n,c['nf'],c['c'].round(0),(c['max']-c['min']).round(0),info.get(c['id']))
