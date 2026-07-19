import re,sys
def clean(path):
    s=open(path).read()
    # split off <defs> (clipPaths live there) — only clean the body before defs
    idx=s.find('<defs>')
    body, tail = (s[:idx], s[idx:]) if idx>=0 else (s, '')
    body=re.sub(r'<rect width="\d+" height="\d+" fill="#F5F5F5"/>','',body,count=1)
    body=re.sub(r'<rect width="\d+(?:\.\d+)?" height="\d+(?:\.\d+)?"(?: fill="white")? transform="translate\([^)]*\)"(?: fill="white")?/>','',body)
    open(path,"w").write(body+tail)
    print(path,"ok")
for p in sys.argv[1:]: clean(p)
