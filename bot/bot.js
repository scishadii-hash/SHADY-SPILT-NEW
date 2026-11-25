/* SHADY SPILT bot: الحوار والحساب والتسجيل. بيعتمد على engine.js (المحلل) و foods-eg.js (القاعدة). */
(function (root) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.__SSBotCore;
  var D = (typeof module !== 'undefined' && module.exports) ? require('./foods-eg.js') : root.SS_FOODS_EG;
  var norm = C.norm, U = C.util, r0 = U.r0, f1 = U.f1;
  var MEAL_NAME = C.MEAL_NAME;
  var UNIT_LABEL = { 'حبه': 'حبة', 'رغيف': 'رغيف', 'طبق': 'طبق', 'كوبايه': 'كوباية', 'معلقه': 'معلقة', 'معلقه صغيره': 'معلقة صغيرة', 'شريحه': 'شريحة', 'قطعه': 'قطعة', 'علبه': 'علبة', 'سكوب': 'سكوب', 'كف': 'كف', 'صدر': 'صدر', 'فخده': 'فخدة', 'قرص': 'قرص', 'كيس': 'كيس', 'ساندوتش': 'ساندوتش', 'سمكه': 'سمكة', 'فرخه': 'فرخة', 'ورقه': 'ورقة', 'صباع': 'صباع', 'مثلث': 'مثلث', 'لوح': 'لوح', 'فنجان': 'فنجان', 'حصه': 'حصة' };
  var SINGULAR = { 'بيضه': 1, 'موزه': 1, 'رغيف': 1, 'تفاحه': 1, 'برتقاله': 1, 'جوافه': 1, 'خياره': 1, 'جزره': 1, 'قطعه': 1, 'شريحه': 1, 'حبه': 1, 'فخده': 1, 'سمكه': 1, 'تمره': 1, 'طماطه': 1, 'قرص': 1, 'صباع': 1 };
  var ORDINAL = { 'التانيه': 1, 'التاني': 1, 'الثانيه': 1, 'الاخيره': 1, 'الاخير': 1, 'الزياده': 1, 'الزيادة': 1, 'التالته': 1 };
  var TOTAL_W = { 'كلهم': 1, 'الاتنين': 1, 'الاثنين': 1, 'الكل': 1, 'سوا': 1, 'مجموعهم': 1, 'الاجمالي': 1, 'الرغيفين': 1, 'البيضتين': 1 };

  function unitsOf(f) {
    if (f._u) return f._u;
    var o = {}; Object.keys(f.units || {}).forEach(function (k) { o[norm(k)] = f.units[k]; });
    f._u = o; return o;
  }
  function fmtQty(q) {
    if (q === 0.5) return 'نص'; if (q === 0.25) return 'ربع'; if (Math.abs(q - 1 / 3) < 0.01) return 'تلت';
    return f1(q);
  }
  function convertCustom(c) {
    var u = {}; u[c.u || 'حصة'] = c.g || 100; u['حصة'] = c.g || 100; u['حبة'] = c.g || 100;
    return { id: c.id, grp: c.id, ck: '', name: c.n, names: c.n, k: c.k, p: c.p, c: c.c, f: c.f, units: u, du: c.u || 'حصة', def: true, ap: false, src: 'أكلاتك المحفوظة' };
  }

  function create(opts) {
    opts = opts || {};
    var foods = D.FOODS.slice();
    (opts.customFoods ? opts.customFoods() : []).forEach(function (c) { foods.push(convertCustom(c)); });
    var idx = C.buildIndex(foods, D.GENERIC);
    var st = { draft: [], meal: null, pending: null, last: null, offset: 0, replaced: false };
    var cache = {};

    /* ---------- حساب صنف ---------- */
    function compute(it) {
      var f = it.food; it.res = null; it.notes = [];
      if (!f) return;
      var Un = unitsOf(f), qty = it.qty == null ? 1 : it.qty, key, per = null, grams, explicit = false, label;
      key = it.unit ? it.unit : norm(f.du);
      if (key === 'معلقه' && (it.spoon === 'small' || (!it.spoon && false))) key = 'معلقه صغيره';
      if (it.wt != null) {
        if (it.wtAfter && it.qty != null && it.qty > 1) { per = it.wt; grams = per * qty; label = UNIT_LABEL[key] || key; it.notes.push('وزن ال' + label + ' ' + f1(per) + ' جم حسب كلامك، يعني ' + f1(grams) + ' جم لـ ' + fmtQty(qty) + ' ' + label); }
        else { grams = it.wt; explicit = true; }
      } else {
        per = Un[key];
        if (per == null) {
          var lab = UNIT_LABEL[key] || key;
          it.notes.push('مش عارف وزن «' + lab + '» من ' + f.name + '، فاعتبرت الحصة العادية');
          key = norm(f.du); per = Un[key]; if (per == null) per = 100;
        }
        var sz = it.size || 1; per = per * sz;
        if (it.vague) qty = qty * 0.5;
        grams = per * qty;
        label = UNIT_LABEL[key] || key;
        it.notes.push(label + ' ' + f.name + (sz !== 1 ? (sz < 1 ? ' الصغيرة' : ' الكبيرة') : '') + ' = ' + (per % 1 ? f1(per) : r0(per)) + ' جم' + (it.vague ? ' (شوية = نص الحصة)' : ''));
      }
      var m = grams / 100;
      it.res = { g: grams, k: f.k * m, p: f.p * m, c: f.c * m, f: f.f * m, explicit: explicit, key: key, label: label || '', per: per };
    }
    function qtyText(it) {
      var r = it.res; if (!r) return '';
      if (r.explicit) return r0(r.g) + ' جم';
      var q = it.qty == null ? 1 : it.qty;
      if (it.vague) return 'شوية (' + r0(r.g) + ' جم)';
      return fmtQty(q) + ' ' + r.label + ' (' + r0(r.g) + ' جم)';
    }
    function totals(items) {
      var t = { g: 0, k: 0, p: 0, c: 0, f: 0, n: 0 };
      (items || st.draft).forEach(function (it) { if (it.res && it.status === 'ok') { t.g += it.res.g; t.k += it.res.k; t.p += it.res.p; t.c += it.res.c; t.f += it.res.f; t.n++; } });
      return t;
    }
    function cardOf(items) {
      items = items || st.draft;
      var rows = items.map(function (it) {
        var ok = it.status === 'ok' && it.res;
        return { id: it.id, name: ok ? it.food.name : (it.label || it.unk.join(' ') || 'صنف'), qty: ok ? qtyText(it) : '', g: ok ? r0(it.res.g) : 0, k: ok ? r0(it.res.k) : 0, p: ok ? r1(it.res.p) : 0, c: ok ? r1(it.res.c) : 0, f: ok ? r1(it.res.f) : 0, ap: !!(it.food && it.food.ap), ok: !!ok, src: it.food && it.food.src };
      });
      var t = totals(items);
      return { rows: rows, total: { g: r0(t.g), k: r0(t.k), p: r1(t.p), c: r1(t.c), f: r1(t.f), n: t.n } };
    }
    function r1(x) { return Math.round(x * 10) / 10; }

    /* ---------- تطبيق الطهي ومن غير زيت ---------- */
    function variantOf(f, ck) {
      for (var i = 0; i < idx.foods.length; i++) { var x = idx.foods[i]; if (x.grp === f.grp && x.ck === ck && x.id !== f.id && x.ck) return x; }
      return null;
    }
    function applyCook(it) {
      var f = it.food; if (!f) return;
      if (it.cook) {
        var ck = it.cook;
        if (ck === 'raw' && C.RAWMAP[f.id]) { it.food = idx.byId[C.RAWMAP[f.id]]; }
        else if ((ck === 'cooked' || ck === 'boil') && f.ck === 'raw') {
          var back = Object.keys(C.RAWMAP).filter(function (k) { return C.RAWMAP[k] === f.id; })[0];
          if (back) it.food = idx.byId[back];
        } else if (ck !== 'cooked' && f.ck && f.ck !== ck) {
          var v = variantOf(f, ck);
          if (v) it.food = v;
          else if (!(ck === 'boil' && f.ck === 'grill')) it.notes0 = (it.notes0 || []).concat(['مفيش عندي «' + f.name + '» بطريقة ' + ({ boil: 'السلق', fry: 'التحمير', grill: 'الشوي', raw: 'النيء', bake: 'الفرن' }[ck] || '') + '، فحسبتها ' + f.name]);
        }
        it.cook = null;
      }
      if (it.no && it.no.length) {
        var oil = it.no.some(function (w) { return C.NO_OIL[w]; });
        if (oil) {
          var g2 = it.food.ck === 'fry' ? (variantOf(it.food, 'grill') || variantOf(it.food, 'boil')) : null;
          if (g2) it.food = g2; else if (it.food.ck === 'fry' || /محمر|مقلي/.test(it.food.name)) it.notes0 = (it.notes0 || []).concat(['ماقدرتش أشيل الزيت من ' + it.food.name + '، الحساب فيه زيت']);
        }
        it.no = [];
      }
    }

    /* ---------- بحث أونلاين صارم (Open Food Facts) ---------- */
    async function lookupOnline(phrase) {
      var key = norm(phrase);
      if (cache[key]) return cache[key];
      if (opts.online === false || !opts.fetchImpl) return { status: 'off' };
      var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null, to = null;
      try {
        if (ctl) to = setTimeout(function () { ctl.abort(); }, opts.timeoutMs || 6000);
        var url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(phrase) + '&search_simple=1&action=process&json=1&page_size=20&fields=product_name,product_name_ar,nutriments';
        var res = await opts.fetchImpl(url, { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined });
        if (!res.ok) throw new Error('http');
        var data = await res.json(), qt = key.split(' ').filter(function (w) { return w.length > 1; }), best = null;
        (data.products || []).forEach(function (p) {
          var nm = p.product_name_ar || p.product_name || ''; if (!nm) return;
          var nt = norm(nm).split(' ');
          if (!qt.length || !qt.every(function (w) { return nt.indexOf(w) >= 0; })) return;
          var n = p.nutriments || {}, k = Number(n['energy-kcal_100g']);
          if (!k && Number(n.energy_100g)) k = Number(n.energy_100g) / 4.184;
          var pr = Number(n.proteins_100g), cb = Number(n.carbohydrates_100g), ft = Number(n.fat_100g);
          if (![k, pr, cb, ft].every(isFinite) || !(k > 0) || k > 900) return;
          if (n.proteins_100g == null || n.carbohydrates_100g == null || n.fat_100g == null) return;
          if (Math.abs(pr * 4 + cb * 4 + ft * 9 - k) > Math.max(0.25 * k, 25)) return;
          if (!best || nt.length < best.len) best = { len: nt.length, name: nm, k: k, p: pr, c: cb, f: ft };
        });
        var out = best ? { status: 'ok', food: { id: 'off:' + key, grp: 'off:' + key, ck: '', name: best.name, names: best.name, k: best.k, p: best.p, c: best.c, f: best.f, units: { 'حصة': 100 }, du: 'حصة', def: true, ap: true, src: 'Open Food Facts' } } : { status: 'none' };
        cache[key] = out; return out;
      } catch (e) { return { status: 'offline' }; }
      finally { if (to) clearTimeout(to); }
    }
    root.__ssLookup = lookupOnline;
    var API = { _st: st, _idx: idx, compute: compute, cardOf: cardOf, totals: totals, lookupOnline: lookupOnline, applyCook: applyCook, variantOf: variantOf,
      qtyText: qtyText, fmtQty: fmtQty, convertCustom: convertCustom, UNIT_LABEL: UNIT_LABEL, SINGULAR: SINGULAR, ORDINAL: ORDINAL, TOTAL_W: TOTAL_W, opts: opts, r1: r1 };
    return API;
  }
  var core = { create: create, convertCustom: convertCustom, UNIT_LABEL: UNIT_LABEL, fmtQty: fmtQty };
  root.__SSBotBase = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
