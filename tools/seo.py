import re, json, glob, html, os
BASE="https://david2fat.github.io/tw-salary/"
pairs={"about/":"en/about/","privacy/":"en/privacy/"}
for f in sorted(glob.glob("**/index.html", recursive=True)):
    s=open(f,encoding="utf-8").read()
    rel=f[:-len("index.html")]
    url=BASE+rel
    depth=rel.count("/")
    up="../"*depth
    en=rel.startswith("en/")
    title=html.unescape(re.search(r"<title>(.*?)</title>",s).group(1))
    desc=html.unescape(re.search(r'<meta name="description" content="(.*?)">',s).group(1))
    h1=html.unescape(re.sub(r"<[^>]+>","",re.search(r"<h1[^>]*>(.*?)</h1>",s,re.S).group(1))).strip()
    add=[]
    # hreflang for about/privacy pairs
    for zh,e in pairs.items():
        if rel in (zh,e) and 'hreflang="en"' not in s.split("</head>")[0]:
            add+= [f'<link rel="alternate" hreflang="zh-Hant-TW" href="{BASE}{zh}">', f'<link rel="alternate" hreflang="en" href="{BASE}{e}">']
            s=s.replace('<link rel="alternate"','',0)
    head=s.split("</head>")[0]
    m=re.search(r'<link rel="alternate" hreflang="zh-Hant-TW" href="([^"]+)">',head+"\n".join(add))
    if m and "x-default" not in head:
        add.append(f'<link rel="alternate" hreflang="x-default" href="{m.group(1)}">')
    if 'rel="icon"' not in head:
        add.append(f'<link rel="icon" href="{up}favicon.svg" type="image/svg+xml">')
    if "og:title" not in head:
        e=html.escape
        add+=[f'<meta property="og:type" content="website">',
              f'<meta property="og:site_name" content="{"Taiwan Salary Tools" if en else "台灣薪資工具"}">',
              f'<meta property="og:locale" content="{"en_US" if en else "zh_TW"}">',
              f'<meta property="og:title" content="{e(title)}">',
              f'<meta property="og:description" content="{e(desc)}">',
              f'<meta property="og:url" content="{url}">',
              '<meta name="twitter:card" content="summary">']
    if '"WebApplication"' not in s and '"BreadcrumbList"' not in s and rel not in ("about/","privacy/","en/about/","en/privacy/"):
        home=BASE+("en/" if en else "")
        graph=[{"@type":"WebApplication","name":h1,"url":url,"description":desc,
                "applicationCategory":"FinanceApplication","operatingSystem":"Any",
                "inLanguage":"en" if en else "zh-Hant-TW","isAccessibleForFree":True,
                "offers":{"@type":"Offer","price":"0","priceCurrency":"TWD"}}]
        if url!=home:
            graph.append({"@type":"BreadcrumbList","itemListElement":[
              {"@type":"ListItem","position":1,"name":"Taiwan Salary Tools" if en else "台灣薪資工具","item":home},
              {"@type":"ListItem","position":2,"name":h1,"item":url}]})
        add.append('<script type="application/ld+json">\n'+json.dumps({"@context":"https://schema.org","@graph":graph},ensure_ascii=False)+'\n</script>')
    if add:
        s=re.sub(r'(<link rel="canonical"[^>]*>\n(?:<link rel="alternate"[^>]*>\n)*)', lambda m: m.group(1)+"\n".join(add)+"\n", s, count=1)
    # footer links
    if 'class="footlinks"' not in s:
        if en: links=f'<p class="footlinks"><a href="{up}en/about/">About</a> · <a href="{up}en/privacy/">Privacy policy</a></p>'
        else: links=f'<p class="footlinks"><a href="{up}about/">關於本站</a> · <a href="{up}privacy/">隱私權政策</a></p>'
        s=s.replace("</footer>","  "+links+"\n</footer>",1)
    open(f,"w",encoding="utf-8").write(s)
    print(f, len(add))
