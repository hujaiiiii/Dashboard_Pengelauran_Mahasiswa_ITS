import json

with open('data/pengeluaran.json','r',encoding='utf-8') as f:
    data = json.load(f)

fixes = {}
for r in data:
    expected = (r['pangan'] + r['papan'] + r['sandang'] + r['akademik'] +
                r['transportasi'] + r['kuota_internet'] + r['perabot_rt'] +
                r['hiburan'] + r['aksesoris_perhiasan'] + r['gadget_hobi'] +
                r['lainnya_tersier'])
    if expected != r['total_sep']:
        fixes[r['id']] = (r['total_sep'], expected)
        r['total_sep'] = expected

with open('data/pengeluaran.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Fixed', len(fixes), 'records:')
for rid, (old, new) in sorted(fixes.items()):
    print('  id=%d: %d -> %d' % (rid, old, new))

# Final validation
errors = []
for r in data:
    expected = (r['pangan'] + r['papan'] + r['sandang'] + r['akademik'] +
                r['transportasi'] + r['kuota_internet'] + r['perabot_rt'] +
                r['hiburan'] + r['aksesoris_perhiasan'] + r['gadget_hobi'] +
                r['lainnya_tersier'])
    if expected != r['total_sep']:
        errors.append(r['id'])
print('Remaining mismatches:', errors)
print('Total records:', len(data))
