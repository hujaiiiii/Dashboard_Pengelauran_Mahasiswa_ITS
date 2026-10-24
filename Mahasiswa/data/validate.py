import json
from collections import Counter

with open('data/pengeluaran.json','r',encoding='utf-8') as f:
    data = json.load(f)

print('Record count:', len(data))

errors = []
for r in data:
    expected = (r['pangan'] + r['papan'] + r['sandang'] + r['akademik'] +
                r['transportasi'] + r['kuota_internet'] + r['perabot_rt'] +
                r['hiburan'] + r['aksesoris_perhiasan'] + r['gadget_hobi'] +
                r['lainnya_tersier'])
    if expected != r['total_sep']:
        errors.append('id=%d expected=%d got=%d' % (r['id'], expected, r['total_sep']))

print('total_sep mismatches:', len(errors))
for e in errors[:20]:
    print(' ', e)

papan_errors = [r['id'] for r in data if r['tempat_tinggal'] == 'Rumah Orang Tua' and r['papan'] != 0]
print('papan!=0 for Rumah Orang Tua:', papan_errors)

print('Angkatan:', dict(Counter(r['angkatan'] for r in data)))
print('Gender:', dict(Counter(r['jenis_kelamin'] for r in data)))
print('Prodi:', dict(Counter(r['prodi'] for r in data)))
print('Tempat tinggal:', dict(Counter(r['tempat_tinggal'] for r in data)))
print('Sumber dana:', dict(Counter(r['sumber_dana'] for r in data)))
