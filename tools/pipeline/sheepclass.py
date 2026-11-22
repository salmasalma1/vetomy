import numpy as np,pickle
d=pickle.load(open('sheep_comps.pkl','rb'));V=d['V'];C=d['comps']
MIDX=35
def seg_dist(P,A,B):
    A=np.asarray(A,float);B=np.asarray(B,float);AB=B-A
    t=np.clip(((P-A)@AB)/(AB@AB),0,1);return np.linalg.norm(P-(A+t[:,None]*AB),axis=1)
CH={('fore','L'):[(740,670),(770,445),(605,345),(600,105),(595,65),(515,-110),(545,-200)],
    ('fore','R'):[(790,665),(820,470),(690,330),(795,95),(805,60),(835,-120),(880,-200)],
    ('hind','L'):[(35,560),(190,405),(30,130),(35,65),(150,-170),(205,-195)],
    ('hind','R'):[(20,575),(95,300),(-175,170),(-190,110),(-215,-115),(-165,-198)]}
SEGN={'fore':['scapula','humerus','radius','carpus','metacarpus','phalanges_fore'],
      'hind':['femur','tibia','tarsus','metatarsus','phalanges_hind']}
def limbvote(pts,S):
    bd=np.full(len(pts),1e9);lab=np.empty(len(pts),object)
    for (limb,s),J in CH.items():
        if s!=S: continue
        for i in range(len(J)-1):
            dd=seg_dist(pts[:,[2,1]],J[i],J[i+1]);b=dd<bd;bd[b]=dd[b];lab[b]=SEGN[limb][i]
    u,n=np.unique(lab.astype(str),return_counts=True);return u[n.argmax()],float(np.median(bd))
name={9:'skull',7:'mandible',2:'mandible',0:'os_coxae',1:'os_coxae',27:'os_coxae',28:'sacrum',45:'atlas',8:'axis'}
for i,c in enumerate([6,3,5,4,10]): name[c]=f'vertebra_c{i+3}'
for i,c in enumerate([12,16,14,15,22,23,25,26,50,57,41,43,42]): name[c]=f'vertebra_t{i+1}'
for i,c in enumerate([21,17,13,18,11,19]): name[c]=f'vertebra_l{i+1}'
for i,c in enumerate([118,126,129,134,137,138,140,139]): name[c]=f'vertebra_cd{i+1}'
for c in [77,81,61,68,60,24]: name[c]='sternum'
for c in [143,141,125,144,133,130,142]: name[c]='hyoid'
drop={146,147}
info={}
for c in C:
    i=c['id']
    if i in name or i in drop: continue
    x,y,z=c['c'];S='L' if x>MIDX else 'R'
    pts=V[np.unique(c['faces'])]
    lab,md=limbvote(pts,S)
    ribzone=(380<z<840) and y>380 and (md>40 or abs(x-MIDX)<70)
    name[i]=('ribs_'+S) if ribzone and not (lab in('scapula','humerus') and md<25) else lab+'_'+S
    info[i]=(lab,round(md))
for S in 'LR':
    for b in ('scapula','humerus','femur','tibia','radius'):
        cs=sorted([c for c in C if name.get(c['id'])==b+'_'+S],key=lambda c:-c['nf'])
        for c in cs[1:]:
            if b in('scapula','humerus') and 380<c['c'][2]<840 and c['c'][1]>380: name[c['id']]='ribs_'+S
            elif b=='femur' and c['nf']<15000: name[c['id']]='patella_'+S
            elif b=='radius' and c['nf']<15000: name[c['id']]='ulna_'+S
            elif b=='tibia' and c['nf']<15000: name[c['id']]='tibia_'+S
for d_ in drop: name[d_]=None
name[39]='scapula_R';name[40]='scapula_L';name[36]='ribs_L';name[83]='patella_L';name[75]=name[78]='os_coxae';name[145]=None
pickle.dump(name,open('sheep_names.pkl','wb'))
from collections import Counter
print(sorted(Counter(v for v in name.values() if v and not v.startswith('vertebra')).items()))
for c in C:
    n=name[c['id']]
    if n and n.split('_')[0] in ('scapula','humerus','radius','ulna','femur','tibia','patella','ribs') and c['nf']>12000 or (n and 'patella' in n) or (n and 'ulna' in n): print(c['id'],n,c['nf'],c['c'].round(0),(c['max']-c['min']).round(0),info.get(c['id']))
