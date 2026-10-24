"""แปลงข้อความชีต "บัญชีรับส่งสินค้า สหมิตร" เป็น stock/data/sheet-receipts.json

ใช้: python3 parse_sheet.py <ไฟล์ข้อความที่ส่งออกจากชีต> sheet-receipts.json
อ่านเฉพาะแท็บ "ใบรับสินค้า(เข้า)": หัวใบรับ ตาชั่งรถ กระสอบ (ลำดับ 1-40) และบรรทัดราคา
ใบรับมีบล็อกราคาสองชุด เลือกชุดที่น้ำหนักรวมตรงกับกระสอบ และมีราคา
"""
import re, json, sys
src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding='utf-8').read()
sheet1 = text.split('# คัดแยกเกรด & Stock คงเหลือ')[0]
lines = sheet1.split('\n')
NUM = re.compile(r'(?:(?<=^)|(?<=,))\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)\s*(?=,|$)')
def tok(line):
    line = NUM.sub(lambda m: m.group(1).replace(',', ''), line)
    return [t.strip() for t in line.split(',')]
def isnum(t):
    return re.fullmatch(r'-?\d+(\.\d+)?', t or '') is not None
def num(t): return float(t)

# split blocks
starts = [i for i,l in enumerate(lines) if re.search(r',\s*B\d\d-\d+\s*,', l)]
receipts = []
for bi, s in enumerate(starts):
    e = starts[bi+1] if bi+1 < len(starts) else len(lines)
    blk = lines[s:e]
    rid = re.search(r'B\d\d-\d+', blk[0]).group(0)
    r = {'id': rid, 'date': None, 'supplier': None, 'plates': [], 'truckIn': [], 'truckOut': [], 'truckNet': [], 'trip': None,
         'bags': [], 'lines': [], 'altLines': []}
    rows = [tok(l) for l in blk]
    for t in rows[1:7]:
        if t[0] == 'ว/ด/ป':
            r['date'] = t[1]
            r['supplier'] = t[3].strip()
        elif t[0] == 'ทะเบียนรถ':
            i = t.index('คันที่')
            r['plates'] = [x for x in t[1:i] if x]
            r['trip'] = t[i+1] if i+1 < len(t) else None
            if i+2 < len(t) and t[i+2] != 'ทะเบียนรถ' and t[i+2]: r['plates'].append(t[i+2])
        elif t[0].startswith('นน. ชั่งเข้า') or t[0] == 'นน.ชั่งออก' or t[0] == 'นน.สุทธิ':
            key = {'นน. ชั่งเข้า':'truckIn','นน.ชั่งออก':'truckOut','นน.สุทธิ':'truckNet'}[t[0]]
            vals = [num(x) for x in t[1:4] if isnum(x)]
            r[key] = vals
    # item rows
    blocks = [[], []]
    for t in rows:
        if not t or not re.fullmatch(r'\d+', t[0]): continue
        i = int(t[0])
        if i < 1 or i > 20: continue
        try: p = t.index(str(i+20))
        except ValueError: continue
        def grab(seg):
            if len(seg) >= 2 and seg[0] not in ('-', '') and not isnum(seg[0]) and isnum(seg[1]):
                v = [num(x) if isnum(x) else 0.0 for x in (seg[1:4] + ['', '', ''])[:3]]
                return seg[0], v
            return None
        g = grab(t[1:p])
        if g: r['bags'].append({'no': i, 'grade': g[0], 'gross': g[1][0], 'tare': g[1][1], 'net': g[1][2]})
        rest = t[p+1:]
        # right table: until next token == str(i)
        idx = [k for k,x in enumerate(rest) if x == str(i)]
        right = rest[:idx[0]] if idx else rest
        g = grab(right)
        if g: r['bags'].append({'no': i+20, 'grade': g[0], 'gross': g[1][0], 'tare': g[1][1], 'net': g[1][2]})
        segs = []
        for n, k in enumerate(idx[:2]):
            end = idx[n+1] if n+1 < len(idx) else len(rest)
            segs.append(rest[k+1:end])
        for n, seg in enumerate(segs):
            g = grab(seg)
            if g: blocks[n].append({'grade': g[0], 'net': g[1][0], 'price': g[1][1], 'total': g[1][2]})
    totalNet = round(sum(b['net'] for b in r['bags']), 2)
    def score(b):
        w = sum(x['net'] for x in b)
        priced = sum(1 for x in b if x['price'] > 0)
        return (abs(w - totalNet) < 1.0, priced > 0, len(b))
    # choose block whose weight matches the bag total; prefer priced
    cands = [b for b in blocks if b]
    if cands:
        best = max(cands, key=score)
        r['lines'] = best
        other = [b for b in cands if b is not best]
        if other:
            for ln in best:
                if ln['price'] == 0:
                    m = [x for x in other[0] if x['grade'] == ln['grade'] and abs(x['net'] - ln['net']) < 1 and x['price'] > 0]
                    if m: ln['price'], ln['total'] = m[0]['price'], m[0]['total']
    r['bagNet'] = totalNet
    # ใบที่ยังไม่กรอกกระสอบ: บรรทัดราคาเป็นสำเนาค้างจากใบก่อนหน้า (เช่น B10-06 ซ้ำกับ B10-05) จึงไม่นับ
    if not r['bags'] and receipts and any(sorted(map(str, x['lines'])) == sorted(map(str, r['lines'])) for x in receipts):
        r['lines'] = []
        r['draft'] = True
    r['noVat'] = 'no vat' in (r['supplier'] or '').lower()
    receipts.append(r)

# normalise
sup_alias = {'K.ชม ( No vat )': 'K.ชม (No VAT)'}
for r in receipts:
    r['supplier'] = sup_alias.get(r['supplier'], r['supplier'])
    d, m, y = r['date'].split('/')
    r['date'] = f"{int(y)-543:04d}-{int(m):02d}-{int(d):02d}"
compact = [{
    'id': x['id'], 'date': x['date'], 'supplier': x['supplier'], 'plates': x['plates'], 'trip': x['trip'],
    'truckIn': x['truckIn'], 'truckOut': x['truckOut'], 'truckNet': x['truckNet'],
    'bags': [[b['no'], b['grade'], b['gross'], b['tare'], b['net']] for b in x['bags']],
    'lines': [[l['grade'], l['net'], l['price'], round(l['total'], 2)] for l in x['lines']],
    'noVat': x['noVat'], **({'draft': True} if x.get('draft') else {}),
} for x in receipts]
json.dump(compact, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
# report
from collections import Counter
print(len(receipts))
bad = [r['id'] for r in receipts if not r['bags']]
print('nobags', bad)
mism = [(r['id'], r['bagNet'], round(sum(x['net'] for x in r['lines']),2), r['truckNet']) for r in receipts if abs(r['bagNet'] - sum(x['net'] for x in r['lines'])) > 1]
print('mismatch', len(mism)); [print(x) for x in mism]
print(Counter(b['grade'] for r in receipts for b in r['bags']))
print(Counter(r['supplier'] for r in receipts))
unpriced = [r['id'] for r in receipts if not any(x['price']>0 for x in r['lines'])]
print('unpriced', unpriced)
