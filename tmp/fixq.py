import re, os
os.chdir(os.path.expanduser('~/workspace'))
for path in ['es/getting-started/introduction.mdx','es/getting-started/quickstart.mdx','getting-started/quickstart.mdx']:
    with open(path) as f: c = f.read()
    def repl(m):
        v = m.group(2)
        return m.group(1) + '"' + v.replace('"','\\"') + '"'
    c2 = re.sub(r'^(description: )(.*)$', repl, c, count=1, flags=re.MULTILINE)
    with open(path,'w') as f: f.write(c2)
    print('fixed', path)
