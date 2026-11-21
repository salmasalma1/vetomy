"""Original (source) geometry for each species, transformed into the published model's frame.
Mirrors the transforms in work/export_*.py so source and output can be compared directly."""
import pickle,numpy as np
import os
# Folder holding the split source data (*_comps.pkl, *_names.pkl). Not stored in the repo:
# the original scans are large and some are licensed for display only.
W=os.environ.get('VETOMY_SOURCES','')
if W and not W.endswith('/'): W+='/'
R=np.array([[0,0,1],[0,1,0],[-1,0,0]],float)
def _group(comps_pkl,names_pkl,shift,scale_fn,relabel=None):
    d=pickle.load(open(W+comps_pkl,'rb'));nm=dict(pickle.load(open(W+names_pkl,'rb')));V=d['V']
    ground=V[:,1].min();s=scale_fn(ground);V=V-[shift,0,0]
    if relabel: relabel(d['comps'],nm)
    g={}
    for c in d['comps']:
        n=nm.get(c['id'])
        if n: g.setdefault(n,[]).append(c['faces'])
    out={}
    for n,fl in g.items():
        F=np.vstack(fl);vi,inv=np.unique(F,return_inverse=True)
        out[n]=(((V[vi]-[0,ground,0])@R.T)*s,inv.reshape(-1,3))
    return out
def _cat_relabel(C,nm):
    for c in C:
        n=nm[c['id']]
        if n.startswith(('metacarpus','metatarsus')) and (c['max'][1]-c['min'][1])<0.06 and c['nf']>900:
            nm[c['id']]=n.replace('metacarpus','phalanges_fore').replace('metatarsus','phalanges_hind')
def _available(fn,*files):
    return fn if W and all(os.path.exists(W+f) for f in files) else None
_ALL={
 'sheep':lambda:_group('sheep_comps.pkl','sheep_names.pkl',35,lambda g:0.001),
 'camel':lambda:_group('camelT_comps.pkl','camel_names.pkl',0,lambda g:0.001),
 'cat':  lambda:_group('catorig_comps.pkl','catorig_names.pkl',0,lambda g:0.25/(0.78-g),_cat_relabel),
}
SOURCES={k:v for k,v in _ALL.items() if W and os.path.exists(W+{'sheep':'sheep_comps.pkl','camel':'camelT_comps.pkl','cat':'catorig_comps.pkl'}[k])}
# Parts that are not in any scan: reconstructed on purpose, always need a human eye
RECONSTRUCTED={'sheep':{'costal_cartilage_L','costal_cartilage_R'}}
# Source known to be unreliable (no clean original to compare against)
SOURCE_NOTES={'dog':'AI-generated source (Tripo) with fused bones; split by geometric cuts. No clean original exists.',
              'horse':'Original split before this QC existed; source comparison not available.'}
