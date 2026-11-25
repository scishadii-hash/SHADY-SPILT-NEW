/* SHADY SPILT bot engine: فهم كلام مصري + حساب + حوار. مفيش DOM هنا، فبيتختبر بـ node. */
(function (root) {
  'use strict';

  /* ---------- تطبيع عربي ---------- */
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    s = s.replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٫]/g, '.').replace(/[،؛]/g, ',').replace(/[؟?!]/g, ' ')
      .replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/\./g, ' ').replace(/\u0001/g, '.')
      .replace(/(\d)\s*x\b/g, '$1 ').replace(/[^؀-ۿa-z0-9.,+\s]/g, ' ')
      .replace(/(\d)([^\d\s.,])/g, '$1 $2').replace(/([^\d\s.,])(\d)/g, '$1 $2')
      .replace(/([,+])/g, ' $1 ').replace(/\s+/g, ' ').trim();
    return s;
  }
  function stripAl(w) { return w.length > 3 && w.indexOf('ال') === 0 ? w.slice(2) : w; }

  /* ---------- معجم ---------- */
  var NUMW = {
    'واحد': 1, 'واحده': 1, 'وحده': 1, 'اتنين': 2, 'اثنين': 2, 'تنين': 2, 'اثنان': 2, 'تلاته': 3, 'ثلاثه': 3, 'تلات': 3, 'ثلاث': 3,
    'اربعه': 4, 'اربع': 4, 'خمسه': 5, 'خمس': 5, 'سته': 6, 'ست': 6, 'سبعه': 7, 'سبع': 7, 'تمانيه': 8, 'ثمانيه': 8, 'تمنيه': 8, 'تمان': 8, 'ثمان': 8,
    'تسعه': 9, 'تسع': 9, 'عشره': 10, 'عشر': 10, 'احداشر': 11, 'حداشر': 11, 'اتناشر': 12, 'تلتاشر': 13, 'اربعتاشر': 14, 'خمستاشر': 15,
    'عشرين': 20, 'تلاتين': 30, 'ثلاثين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70, 'تمانين': 80, 'ثمانين': 80, 'تسعين': 90,
    'ميه': 100, 'مايه': 100, 'ميت': 100, 'مئه': 100, 'ميتين': 200, 'مئتين': 200, 'تلتميه': 300, 'تلاتميه': 300, 'ثلاثميه': 300,
    'ربعميه': 400, 'اربعميه': 400, 'خمسميه': 500, 'ستميه': 600, 'سبعميه': 700, 'تمنميه': 800, 'تسعميه': 900, 'الف': 1000, 'الفين': 2000
  };
  var FRAC = { 'نص': 0.5, 'نصف': 0.5, 'ربع': 0.25, 'تلت': 1 / 3, 'ثلث': 1 / 3, 'تلتين': 2 / 3 };
  var WUNIT = { 'جم': 1, 'جرام': 1, 'غرام': 1, 'غ': 1, 'g': 1, 'gm': 1, 'جرامات': 1, 'كيلو': 1000, 'كجم': 1000, 'كيلوجرام': 1000, 'kg': 1000, 'مل': 1, 'ملي': 1, 'ملل': 1, 'ml': 1, 'لتر': 1000 };
  var CUNIT = {};
  [['رغيف', 'رغيف'], ['رغفان', 'رغيف'], ['حبه', 'حبه'], ['حبايه', 'حبه'], ['حبات', 'حبه'], ['وحده', 'حبه'], ['قطعه', 'قطعه'], ['قطع', 'قطعه'], ['شريحه', 'شريحه'], ['شرايح', 'شريحه'],
    ['علبه', 'علبه'], ['علب', 'علبه'], ['سكوب', 'سكوب'], ['كف', 'كف'], ['صدر', 'صدر'], ['فخده', 'فخده'], ['فخذه', 'فخده'], ['قرص', 'قرص'], ['اقراص', 'قرص'], ['كيس', 'كيس'],
    ['ساندوتش', 'ساندوتش'], ['سمكه', 'سمكه'], ['ورقه', 'ورقه'], ['صباع', 'صباع'], ['اصابع', 'صباع'], ['مثلث', 'مثلث'], ['لوح', 'لوح'], ['فنجان', 'فنجان'],
    ['طبق', 'طبق'], ['صحن', 'طبق'], ['اطباق', 'طبق'], ['كوبايه', 'كوبايه'], ['كوب', 'كوبايه'], ['كبايه', 'كوبايه'], ['كوبايات', 'كوبايه'], ['معلقه', 'معلقه'], ['ملعقه', 'معلقه'], ['معالق', 'معلقه'],
    ['حصه', 'حصه'], ['عنقود', 'حصه']].forEach(function (p) { CUNIT[p[0]] = { key: p[1], q: 1 }; });
  [['رغيفين', 'رغيف'], ['حبتين', 'حبه'], ['قطعتين', 'قطعه'], ['شريحتين', 'شريحه'], ['علبتين', 'علبه'], ['سكوبين', 'سكوب'], ['كفين', 'كف'], ['صدرين', 'صدر'], ['فخدتين', 'فخده'],
    ['قرصين', 'قرص'], ['كيسين', 'كيس'], ['ساندوتشين', 'ساندوتش'], ['سمكتين', 'سمكه'], ['طبقين', 'طبق'], ['كوبايتين', 'كوبايه'], ['كوبتين', 'كوبايه'], ['معلقتين', 'معلقه'],
    ['ملعقتين', 'معلقه'], ['فنجانين', 'فنجان'], ['مثلثين', 'مثلث'], ['لوحين', 'لوح'], ['صباعين', 'صباع'], ['حصتين', 'حصه']].forEach(function (p) { CUNIT[p[0]] = { key: p[1], q: 2 }; });
  var SIZEW = { 'صغير': 0.7, 'صغيره': 0.7, 'صغيرين': 0.7, 'كبير': 1.3, 'كبيره': 1.3, 'كبيرين': 1.3, 'متوسط': 1, 'متوسطه': 1, 'وسط': 1, 'عادي': 1, 'عاديه': 1 };
  var COOKW = {
    'مسلوق': 'boil', 'مسلوقه': 'boil', 'مسلوقين': 'boil', 'مسلوقات': 'boil', 'مسلوقا': 'boil',
    'مقلي': 'fry', 'مقليه': 'fry', 'مقليين': 'fry', 'محمر': 'fry', 'محمره': 'fry', 'محمرين': 'fry', 'متحمر': 'fry', 'متحمره': 'fry', 'مقلى': 'fry',
    'مشوي': 'grill', 'مشويه': 'grill', 'مشويين': 'grill', 'مشوى': 'grill', 'جريل': 'grill',
    'ني': 'raw', 'نيء': 'raw', 'نيئ': 'raw', 'نيئه': 'raw', 'خام': 'raw', 'ناشف': 'raw', 'ناشفه': 'raw',
    'مطبوخ': 'cooked', 'مطبوخه': 'cooked', 'مستوي': 'cooked', 'مستويه': 'cooked', 'بالفرن': 'bake', 'فرن': 'bake'
  };
  var FILL = { 'احسبلي': 1, 'احسب': 1, 'احسبيلي': 1, 'حسبلي': 1, 'حسب': 1, 'عايز': 1, 'عايزه': 1, 'عاوز': 1, 'عاوزه': 1, 'ممكن': 1, 'لو': 1, 'سمحت': 1, 'لوسمحت': 1, 'انا': 1, 'اني': 1,
    'كلت': 1, 'اكلت': 1, 'فطرت': 1, 'تغديت': 1, 'اتعشيت': 1, 'شربت': 1, 'هاكل': 1, 'باكل': 1, 'تناولت': 1, 'وجبه': 1, 'وجبتي': 1, 'في': 1, 'على': 1, 'علي': 1, 'من': 1, 'مع': 0,
    'دي': 1, 'ده': 1, 'دا': 1, 'تقريبا': 1, 'حوالي': 1, 'نحو': 1, 'يعني': 1, 'بس': 1, 'كده': 1, 'الحساب': 1, 'هنا': 1, 'النهارده': 1, 'انهارده': 1, 'اليوم': 1, 'هو': 1, 'هي': 1,
    'عندي': 1, 'معايا': 1, 'بتاعت': 1, 'بتاع': 1, 'برضو': 1, 'تاني': 1, 'الفطار': 1, 'الغدا': 1, 'العشا': 1, 'اللي': 1, 'ال': 1, 'فيه': 1, 'فيها': 1, 'خلي': 1, 'خليني': 1, 'ياعم': 1, 'يا': 1, 'معلش': 1, 'طيب': 1, 'تمام': 1, 'اه': 1, 'ايوه': 1, 'ايوا': 1 };
  ['كام', 'ايه', 'قد', 'فى', 'بقي', 'لسه', 'دلوقتي', 'امبارح', 'ارجوك', 'بالله', 'عليك', 'هل', 'لي', 'لك', 'ليا', 'انت', 'حاجه', 'كل', 'كله', 'الحاجه', 'دول', 'بعد', 'قبل', 'كمل', 'جديد', 'جديده', 'تانيه', 'التانيه', 'الثانيه', 'الاخيره', 'الاولي', 'الاولانيه', 'ايوه', 'لا', 'مش', 'بدل', 'كان', 'كانت', 'كانوا', 'الوجبه', 'سعره', 'سعرات', 'كالوري', 'بروتين', 'كارب', 'كربوهيدرات', 'نشويات', 'دهون', 'ماكروز', 'سجل', 'سجلها', 'ضيف', 'زود', 'شيل', 'ب', 'ل', 'له', 'لها', 'هم'].forEach(function (w) { FILL[w] = 1; });
  var MEALW = { 'فطار': 'b', 'فطور': 'b', 'فطرت': 'b', 'غدا': 'l', 'غداء': 'l', 'غدا': 'l', 'غذاء': 'l', 'تغديت': 'l', 'عشا': 'd', 'عشاء': 'd', 'اتعشيت': 'd', 'سناك': 's', 'سناكس': 's', 'تصبيره': 's', 'سناكات': 's' };
  var MEAL_NAME = { b: 'الفطار', l: 'الغدا', d: 'العشا', s: 'السناكس' };
  var RAWMAP = { rice_cooked: 'rice_raw', pasta_cooked: 'pasta_raw' };
  var NO_OIL = { 'زيت': 1, 'سمنه': 1, 'زبده': 1, 'سمن': 1 };

  /* ---------- أدوات ---------- */
  function r0(x) { return Math.round(x); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function f1(x) { var v = r1(x); return (v % 1 === 0) ? String(v) : v.toFixed(1); }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  var uidN = 0;
  function uid() { uidN++; return 'i' + Date.now().toString(36) + uidN; }
  function isNum(t) { return /^\d+(\.\d+)?$/.test(t); }
  function numVal(t) { return isNum(t) ? parseFloat(t) : (NUMW.hasOwnProperty(t) ? NUMW[t] : null); }

  /* ---------- الفهرس ---------- */
  function buildIndex(foods, generic) {
    var idx = { alias: {}, byId: {}, known: {}, maxLen: 1, aliasKeys: [], foods: foods, generic: {} };
    function addKnown(w) { idx.known[w] = 1; }
    foods.forEach(function (f) {
      idx.byId[f.id] = f;
      String(f.names).split('|').forEach(function (raw) {
        var dual = false;
        if (raw.indexOf('#2') === 0) { dual = true; raw = raw.slice(2); }
        var p = norm(raw); if (!p) return;
        if (!idx.alias[p] || (f.def && !idx.alias[p].entry.def)) idx.alias[p] = { entry: f, dual: dual };
        var ts = p.split(' '); ts.forEach(addKnown); if (ts.length > idx.maxLen) idx.maxLen = ts.length;
      });
    });
    idx.aliasKeys = Object.keys(idx.alias);
    (generic || []).forEach(function (g) { idx.generic[norm(g.w)] = g; addKnown(norm(g.w)); });
    [NUMW, FRAC, WUNIT, CUNIT, SIZEW, COOKW, FILL, MEALW].forEach(function (o) { Object.keys(o).forEach(addKnown); });
    ['و', 'من', 'غير', 'بدون', 'مع', 'كمان', 'جرام', 'شويه', 'شوي', 'شويت', 'كبيره', 'صغيره', 'شاي', 'اكل', 'سادم'].forEach(addKnown);
    return idx;
  }
  function addAlias(idx, food, name) {
    var p = norm(name); idx.byId[food.id] = food; idx.alias[p] = { entry: food, dual: false };
    p.split(' ').forEach(function (w) { idx.known[w] = 1; });
    idx.aliasKeys = Object.keys(idx.alias); idx.foods.push(food);
  }
  /* بيفكّ السوابق (و، ال، ب) بس لو الكلمة بعد الفك معروفة. الكلمة المعروفة زي ما هي بتفضل زي ما هي */
  function canonTokens(idx, text) {
    var out = [];
    norm(text).split(' ').forEach(function (t) {
      if (!t) return;
      if (idx.known[t] || isNum(t) || t === ',' || t === '+') { out.push(t); return; }
      var w = t, pre = false;
      if (w.length > 2 && w[0] === 'و') {
        var r = w.slice(1);
        if (idx.known[r] || idx.known[stripAl(r)] || isNum(r) || idx.known[r.replace(/^ب/, '')]) { pre = true; w = r; }
      }
      var cands = [w, stripAl(w), w.replace(/^بال/, ''), w.replace(/^ب/, ''), stripAl(w.replace(/^ب/, '')), w.replace(/^لل/, '').replace(/^ل/, '')];
      var hit = null;
      for (var i = 0; i < cands.length; i++) if (cands[i] && (idx.known[cands[i]] || isNum(cands[i]))) { hit = cands[i]; break; }
      if (pre) out.push('و');
      out.push(hit || w);
    });
    return out;
  }
  function matchFood(idx, toks, i) {
    for (var L = Math.min(idx.maxLen, toks.length - i); L >= 1; L--) {
      var ph = toks.slice(i, i + L).join(' ');
      if (idx.alias[ph]) return { entry: idx.alias[ph].entry, dual: idx.alias[ph].dual, n: L };
    }
    return null;
  }

  /* ---------- المحلل ---------- */
  function newCur() { return { qty: null, unit: null, wt: null, wtAfter: false, size: 1, spoon: null, cook: null, vague: false, food: null, dual: false, no: [], unk: [], generic: null, sizeSet: false }; }
  function isSep(t) { return t === ',' || t === '+' || t === 'و' || t === 'مع' || t === 'كمان'; }
  function foodFollows(idx, toks, i) {
    for (var j = i + 1, skip = 0; j < toks.length && skip < 3; j++) {
      if (SIZEW.hasOwnProperty(toks[j]) || COOKW.hasOwnProperty(toks[j]) || toks[j] === 'شاي' || toks[j] === 'اكل') { skip++; continue; }
      return !!(matchFood(idx, toks, j) || idx.generic[toks[j]]);
    }
    return false;
  }
  function parseItems(idx, text) {
    var toks = canonTokens(idx, text), items = [], cur = newCur(), i = 0, issues = [];
    function push() {
      if (cur.food || cur.unk.length || cur.generic) items.push(cur);
      cur = newCur();
    }
    function readNum(j) {
      var t = toks[j], v = FRAC.hasOwnProperty(t) ? FRAC[t] : numVal(t), n = 1;
      if (v == null) return null;
      var base = t;
      if (!FRAC.hasOwnProperty(t) && toks[j + 1] === 'و' && NUMW.hasOwnProperty(toks[j + 2]) && !isNum(t)) {
        var a = NUMW[t], b = NUMW[toks[j + 2]];
        if ((a < 10 && b >= 20 && b < 100) || (a >= 100 && b < a && a % 100 === 0 && b < 100) || (a >= 1000 && b < a)) { v = a + b; n = 3; }
      }
      if (!FRAC.hasOwnProperty(base) && toks[j + n] === 'و' && FRAC.hasOwnProperty(toks[j + n + 1]) && !(matchFood(idx, toks, j + n + 2) || CUNIT.hasOwnProperty(toks[j + n + 2]))) { v += FRAC[toks[j + n + 1]]; n += 2; }
      return { v: v, n: n };
    }
    while (i < toks.length) {
      var t = toks[i], m;
      if (t === 'من' && toks[i + 1] === 'غير') { if (toks[i + 2]) cur.no.push(toks[i + 2]); i += 3; continue; }
      if (t === 'بدون' || t === 'بلا') { if (toks[i + 1]) cur.no.push(toks[i + 1]); i += 2; continue; }
      if (t === 'و' && FRAC.hasOwnProperty(toks[i + 1]) && (cur.food || cur.unit) && cur.wt == null && !(matchFood(idx, toks, i + 2) || CUNIT.hasOwnProperty(toks[i + 2]))) {
        cur.qty = (cur.qty == null ? 1 : cur.qty) + FRAC[toks[i + 1]]; i += 2; continue;
      }
      if (isSep(t)) { if (cur.food || cur.unk.length) push(); i++; continue; }
      /* رقم أو كسر */
      var rn = (isNum(t) || NUMW.hasOwnProperty(t) || FRAC.hasOwnProperty(t)) ? readNum(i) : null;
      if (rn) {
        var after = toks[i + rn.n];
        if (WUNIT.hasOwnProperty(after)) {
          if (cur.food && cur.wt == null && cur.qty == null && !cur.unk.length) { cur.wt = rn.v * WUNIT[after]; cur.wtAfter = true; i += rn.n + 1; continue; }
          if (cur.food || cur.unk.length) push();
          cur.wt = rn.v * WUNIT[after]; i += rn.n + 1; continue;
        }
        if (cur.food || cur.unk.length) push();
        if (cur.qty != null) { /* رقمين ورا بعض: نبدأ صنف جديد */ push(); }
        cur.qty = rn.v; i += rn.n; continue;
      }
      /* وحدة عدّ */
      if (CUNIT.hasOwnProperty(t)) {
        var cu = CUNIT[t], hasFood = foodFollows(idx, toks, i), asFood = matchFood(idx, toks, i);
        if (hasFood || !asFood) {
          if (cur.food && (cur.unit || cur.qty != null)) push();
          cur.unit = cu.key; if (cu.q === 2 && cur.qty == null) cur.qty = 2;
          if (!hasFood && !asFood) cur.unkUnit = true;
          i++; continue;
        }
      }
      if (SIZEW.hasOwnProperty(t)) {
        if (cur.unit === 'معلقه') cur.spoon = SIZEW[t] > 1 ? 'big' : 'small'; else { cur.size = SIZEW[t]; cur.sizeSet = true; }
        i++; continue;
      }
      if ((t === 'شاي' || t === 'اكل') && cur.unit === 'معلقه') { cur.spoon = t === 'شاي' ? 'small' : 'big'; i++; continue; }
      if (COOKW.hasOwnProperty(t) && !matchFood(idx, toks, i)) { cur.cook = COOKW[t]; i++; continue; }
      if (t === 'شويه' || t === 'شوي' || t === 'شويت') { cur.vague = true; i++; continue; }
      m = matchFood(idx, toks, i);
      if (m) {
        if (cur.food) push();
        cur.food = m.entry; if (m.dual && cur.qty == null) cur.qty = 2; i += m.n; continue;
      }
      if (idx.generic[t]) { if (cur.food) push(); cur.generic = idx.generic[t]; i++; continue; }
      if (FILL.hasOwnProperty(t) && FILL[t]) { i++; continue; }
      if (WUNIT.hasOwnProperty(t)) { i++; continue; }
      if (!isNum(t) && t.length > 1) { if (cur.food) push(); cur.unk.push(t); }
      i++;
    }
    push();
    return items;
  }

  var api = { norm: norm, stripAl: stripAl, buildIndex: buildIndex, addAlias: addAlias, canonTokens: canonTokens, matchFood: matchFood, parseItems: parseItems, lev: lev,
    NUMW: NUMW, FRAC: FRAC, WUNIT: WUNIT, CUNIT: CUNIT, SIZEW: SIZEW, COOKW: COOKW, MEALW: MEALW, MEAL_NAME: MEAL_NAME, RAWMAP: RAWMAP, NO_OIL: NO_OIL, FILL: FILL,
    util: { r0: r0, r1: r1, f1: f1, uid: uid, isNum: isNum } };
  root.__SSBotCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
