import re

with open('data/pengeluaran.json','r',encoding='utf-8') as f:
    content = f.read()

# Find all "> followed by digit (malformed colon)
matches = [(m.start(), content[max(0,m.start()-30):m.start()+30]) for m in re.finditer(r'\">', content)]
print('Found', len(matches), 'instances of ">')
for pos, ctx in matches:
    print('  pos=%d ctx=%r' % (pos, ctx))
