import sherpa_onnx, numpy as np, json, os, sys
from parse import parse, to_speech
d="../models/vits-mms-tha/"
tts=sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=d+"model.onnx",tokens=d+"tokens.txt",noise_scale=0.6,noise_scale_w=0.7),num_threads=4)))
SPEED=float(sys.argv[1]) if len(sys.argv)>1 else 0.92
os.makedirs("vo",exist_ok=True)
secs=parse(); lines=[]
for s in secs:
    src = s["lines"] if s["kind"]=="insert" else [l for b in s["beats"] for l in b["lines"]]
    lines += src
meta=[]
for i,t in enumerate(lines):
    sp=to_speech(t)
    a=tts.generate(sp,sid=0,speed=SPEED)
    x=np.array(a.samples,dtype=np.float32)
    # trim leading/trailing silence
    env=np.abs(x)>0.02; idx=np.where(env)[0]
    if len(idx): x=x[max(0,idx[0]-400):idx[-1]+1600]
    np.save(f"vo/{i:04d}.npy",x)
    meta.append({"text":t,"speech":sp,"dur":len(x)/a.sample_rate})
json.dump({"sr":a.sample_rate,"lines":meta},open("vo/meta.json","w",encoding="utf8"),ensure_ascii=False,indent=0)
print(len(meta), sum(m["dur"] for m in meta)/60)
