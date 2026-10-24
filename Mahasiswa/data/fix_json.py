with open('data/pengeluaran.json','r',encoding='utf-8') as f:
    content = f.read()

# Replace all "> (malformed colon between key and value) with ":
fixed = content.replace('">', '":')

with open('data/pengeluaran.json','w',encoding='utf-8') as f:
    f.write(fixed)

print('Done. Replaced occurrences.')

# Quick verify
import json
data = json.loads(fixed)
print('Record count:', len(data))
