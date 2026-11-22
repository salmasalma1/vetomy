import ctypes,numpy as np,os
_lib=ctypes.CDLL(os.path.join(os.path.dirname(os.path.abspath(__file__)),'libmeshopt.so'))
_f=_lib.meshopt_simplify
_f.restype=ctypes.c_size_t
_f.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_size_t,ctypes.c_size_t,ctypes.c_float,ctypes.c_uint,ctypes.c_void_p]
LOCK_BORDER=1
def simplify(p,f,target_faces,max_rel_error=0.002,options=0):
    """Quadric edge-collapse simplification (meshoptimizer). Returns (p,f,error)."""
    v=np.ascontiguousarray(p,np.float32);i=np.ascontiguousarray(f,np.uint32).ravel()
    out=np.empty_like(i);err=ctypes.c_float(0)
    n=_f(out.ctypes.data,i.ctypes.data,i.size,v.ctypes.data,len(v),12,int(target_faces)*3,max_rel_error,options,ctypes.byref(err))
    g=out[:n].reshape(-1,3).astype(np.int64)
    used,inv=np.unique(g,return_inverse=True)
    return np.asarray(p)[used],inv.reshape(-1,3),float(err.value)
