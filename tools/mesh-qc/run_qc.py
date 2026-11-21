"""Vetomy skeletal mesh quality control.
Usage: python3 run_qc.py <species> <model.glb> [--report DIR] [--strict]
Reports only; it never edits or deletes geometry.  --strict exits 1 when any bone FAILs."""
import sys,os,json,re,argparse,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from meshqc import metrics,sample_surface,folds
from readglb import bones
from sources import SOURCES,RECONSTRUCTED,SOURCE_NOTES
from scipy.spatial import cKDTree
# Bones that legitimately consist of several separate pieces
MULTI=re.compile(r'^(ribs|teeth|carpus|tarsus|metacarpus|metatarsus|phalanges|phalanx|sternum|hyoid|costal_cartilage|vertebrae_|os_coxae|mandible|tibia|radius|ulna|fibula)')
def region(key):
    if re.match(r'(skull|mandible|teeth|hyoid)',key): return 'Head'
    if re.match(r'(scapula|humerus|radius|ulna|carpus|metacarpus|phalanges_fore|phalanx_.*_fore)',key): return 'Forelimb'
    if re.match(r'(os_coxae|femur|patella|tibia|fibula|tarsus|metatarsus|phalanges_hind|phalanx_.*_hind)',key): return 'Hindlimb'
    return 'Trunk'
def split(name):
    m=re.match(r'^(.*?)(?:_(L|R))?(?:\.\d{3})?$',name);return m.group(1),{'L':'Left','R':'Right'}.get(m.group(2),'—')
def surface_dev(src_p,src_f,out_p,out_f):
    """Two-sided deviation using dense surface samples (vertices + face centroids), relative to bone diagonal."""
    n=int(min(400000,max(60000,8*len(src_f))))
    a=sample_surface(src_p,src_f,n,1);b=sample_surface(out_p,out_f,n,2)
    diag=np.linalg.norm(np.ptp(src_p,0))
    d1=cKDTree(b).query(a)[0];d2=cKDTree(a).query(b)[0]
    # sampling noise floor: the source against a second sampling of itself
    c=sample_surface(src_p,src_f,n,3);d0=cKDTree(c).query(a)[0]
    p99=max(np.percentile(d1,99),np.percentile(d2,99))-np.percentile(d0,99)
    mx=max(d1.max(),d2.max())-d0.max()
    return float(max(p99,0)/diag),float(max(mx,0)/diag)
def judge(m,src,recon,multi,note):
    defects=[];status='PASS'
    def add(sev,txt,fix):
        nonlocal status
        defects.append((sev,txt,fix))
        if sev=='FAIL': status='FAIL'
        elif status=='PASS': status='WARNING'
    E=m['faces']*1.5
    srcbnd=src['m']['boundary_edges'] if src else None
    if m['boundary_edges']:
        if src is not None and m['boundary_edges']>max(srcbnd*2,srcbnd+4):
            add('FAIL',f"{m['boundary_edges']} open edges (source has {srcbnd}): holes created in processing",'Re-export from source with topology-preserving simplification')
        elif src is None:
            add('WARNING' if m['boundary_edges']<0.002*E else 'FAIL',f"{m['boundary_edges']} open edges (holes)",'Inspect; cap cut surfaces or replace the source model')
    if m['nonmanifold_edges']:
        r=m['nonmanifold_edges']/E
        srcnm=src['m']['nonmanifold_edges'] if src else 0
        if m['nonmanifold_edges']>srcnm+2:
            add('FAIL' if r>0.002 else 'WARNING',f"{m['nonmanifold_edges']} non-manifold edges",'Re-export with topology-preserving simplification')
    if m['flipped_edges']:
        srcfl=src['m']['flipped_edges'] if src else 0
        if m['flipped_edges']>srcfl+2:
            add('FAIL' if m['flipped_edges']/E>0.002 else 'WARNING',f"{m['flipped_edges']} edges with inconsistent winding (inverted normals)",'Re-orient faces consistently')
    if m['degenerate']>0.001*m['faces']: add('WARNING',f"{m['degenerate']} degenerate triangles",'Remove zero-area faces')
    sl0=src['m']['slivers']/max(src['m']['faces'],1) if src else 0
    le0=src['m']['long_edges']/max(src['m']['faces']*1.5,1) if src else 0
    if m['slivers']>max(0.03,2*sl0)*m['faces']: add('WARNING',f"{m['slivers']} sliver triangles (<2°)",'Check for thin/distorted surface')
    f0=src['m']['folds'] if src else None
    if f0 is not None:
        if m['folds']>1.5*f0+5: add('FAIL' if m['folds']>3*f0+20 else 'WARNING',f"{m['folds']} folded edges (spikes/torn sheets) vs {f0} in source",'Re-export with topology-preserving simplification')
    elif m['folds']>max(0.002*m['faces'],3): add('FAIL' if m['folds']>max(0.01*m['faces'],10) else 'WARNING',f"{m['folds']} folded edges (spikes/torn sheets)",'Inspect')
    if src:
        sm=src['m']
        if m['components']>sm['components']:
            add('FAIL',f"{m['components']} pieces vs {sm['components']} in source: fragments created",'Re-export from source')
        ar=m['area']/sm['area'];
        if abs(1-ar)>0.08: add('FAIL',f"surface area {ar:.0%} of source",'Re-export from source')
        elif abs(1-ar)>0.03: add('WARNING',f"surface area {ar:.0%} of source",'Inspect')
        if sm['boundary_edges']==0 and m['boundary_edges']==0 and sm['volume']>0:
            vr=m['volume']/sm['volume']
            if abs(1-vr)>0.08: add('FAIL',f"volume {vr:.0%} of source",'Re-export from source')
            elif abs(1-vr)>0.03: add('WARNING',f"volume {vr:.0%} of source",'Inspect')
        bb=np.array(m['bbox']);sb=np.ptp(src['p'],0);dev=np.abs(bb-sb).max()/max(sb.max(),1e-9)
        if dev>0.03: add('FAIL',f"bounding box differs {dev:.1%} from source",'Check clipping or transform')
        elif dev>0.01: add('WARNING',f"bounding box differs {dev:.1%} from source",'Inspect')
        p99,mx=src['dev']
        if p99>0.01 or mx>0.03: add('FAIL',f"surface deviation {p99:.2%} of bone size (99th pct), max {mx:.1%}",'Lower simplification')
        elif p99>0.004 or mx>0.015: add('WARNING',f"surface deviation {p99:.2%} (99th pct), max {mx:.1%}",'Inspect')
    elif recon:
        add('WARNING','reconstructed part, not in the original scan','Confirm position against a textbook')
    else:
        if m['components']>1 and not multi:
            add('WARNING',f"{m['components']} separate pieces in one bone",'Check for stray fragments')
    return status,defects
def run(species,glb,report_dir=None):
    j,bs=bones(glb)
    src=SOURCES[species]() if species in SOURCES else {}
    rows=[]
    for name,p,f in bs:
        key,side=split(name);m=metrics(p,f);m['folds']=folds(p,f)
        s=None
        if name in src:
            sp,sf=src[name];sm=metrics(sp,sf);sm['folds']=folds(sp,sf);s={'p':sp,'m':sm,'dev':surface_dev(sp,sf,p,f)}
        st,defs=judge(m,s,name in RECONSTRUCTED.get(species,()),bool(MULTI.match(key)),SOURCE_NOTES.get(species) if not src else None)
        rows.append(dict(species=species,system='Skeletal',region=region(key),bone=key,side=side,mesh=name,status=st,
            defects=[d[1] for d in defs],severity=max([d[0] for d in defs],key=['WARNING','FAIL'].index) if defs else '—',
            fix='; '.join(dict.fromkeys(d[2] for d in defs)) or '—',manual='Yes' if st!='PASS' else 'No',
            faces=m['faces'],src_faces=s['m']['faces'] if s else None))
    if report_dir:
        os.makedirs(report_dir,exist_ok=True)
        json.dump(rows,open(f'{report_dir}/{species}_qc.json','w'),indent=1)
    return rows
def markdown(all_rows,title):
    out=[f'# {title}\n']
    for sp in dict.fromkeys(r['species'] for r in all_rows):
        rows=[r for r in all_rows if r['species']==sp]
        c={k:sum(r['status']==k for r in rows) for k in ('PASS','WARNING','FAIL')}
        out.append(f"\n## {sp.capitalize()} — {c['PASS']} pass, {c['WARNING']} warning, {c['FAIL']} fail\n")
        if sp in SOURCE_NOTES: out.append(f"> Source: {SOURCE_NOTES[sp]} Checks here are on the published mesh only.\n")
        out.append('| Bone | Side | Region | Status | Defects | Suggested correction | Manual check |\n|---|---|---|---|---|---|---|')
        for r in sorted(rows,key=lambda r:(['FAIL','WARNING','PASS'].index(r['status']),r['region'],r['bone'])):
            out.append(f"| {r['bone']} | {r['side']} | {r['region']} | **{r['status']}** | {'; '.join(r['defects']) or '—'} | {r['fix']} | {r['manual']} |")
    return '\n'.join(out)+'\n'
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('species');ap.add_argument('glb');ap.add_argument('--report');ap.add_argument('--strict',action='store_true')
    a=ap.parse_args();rows=run(a.species,a.glb,a.report)
    c={k:sum(r['status']==k for r in rows) for k in ('PASS','WARNING','FAIL')};print(a.species,c)
    if a.report: open(f'{a.report}/{a.species}_qc.md','w').write(markdown(rows,f'Mesh QC: {a.species}'))
    sys.exit(1 if a.strict and c['FAIL'] else 0)
