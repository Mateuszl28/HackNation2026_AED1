import fitz, sys, os
d = fitz.open(sys.argv[1]); print("pages", len(d))
os.makedirs("_render/pdf", exist_ok=True)
for i, p in enumerate(d):
    p.get_pixmap(dpi=int(sys.argv[2]) if len(sys.argv)>2 else 70).save(f"_render/pdf/p{i+1:02d}.png")
