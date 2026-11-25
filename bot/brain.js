/* SHADY SPILT bot brain: فهم نية الرسالة والحوار المستمر والتصحيح والتسجيل */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Base = node ? require('./bot.js') : root.__SSBotBase;
  var C = node ? require('./engine.js') : root.__SSBotCore;
  var norm = C.norm, U = C.util, r0 = U.r0, f1 = U.f1, MEAL_NAME = C.MEAL_NAME;
  var AR = '[\\u0600-\\u06FF]*';
  function re(s) { return new RegExp(s); }
  var R = {
    reset: re('(ابدا من (الاول|جديد)|ابدا تاني|وجبه جديده|امسح الحساب|امسح كل|الغي الحساب|صفر الحساب|^clear$|^reset$)'),
    log: re('(^| )(سجل|سجلها|سجله|سجلهم|خزن|خزنها|احفظ|احفظها)( |$)|(^| )(ضيفها|ضيفه|ضيفهم|حطها|حطه|حطهم)( |$)'),
    today: re('(اكلت ايه|كلت ايه|اكلي ايه|ايه اللي (اكلته|كلته)|اللي (اكلته|كلته)|حسابي (النهارده|اليوم)|ملخص (اليوم|النهارده)|اكلي (النهارده|اليوم)|اكلت قد ايه)'),
    remain: re('(فاضل|فاضله|فاضلي|المتبقي|متبقي|باقي لي|باقيلي)'),
    query: re('(كام|قد ايه|احسب|احسبلي|احسبيلي|عرفني|ايه)\\s*(ال)?(بروتين|كارب|كربوهيدرات|نشويات|دهون|سعرات|سعره|كالوري|ماكروز)|(بروتين|سعرات|كارب|دهون|ماكروز) (الوجبه|الحساب|دي)'),
    remove: re('^(?:ممكن |انا |لو سمحت )?(?:شيل|شيلي|شيلها|شيله|امسح|احذف|الغي|الغ|بلاش|استبعد|متحسبش|ماتحسبش)(?: |$)(.*)$'),
    correct: re('(^| )(كان|كانت|كانوا)( |$)|^(خلي|خليه|خليها|خليهم|غير|غيرها|عدل|عدلها)' + AR + ' | بدل '),
    add: re('^(?:ممكن |لو سمحت |انا )?(?:زود|زودلي|زودها|ضيف|ضيفلي|اضف|حط|حطلي|كمان|زوود)' + AR + '(?: |$)(.*)$'),
    help: re('(ساعد|تعمل ايه|بتعمل ايه|ازاي استخدم|مساعده|^help$|اتعامل معاك)'),
    greet: re('^(ازيك|اهلا|مرحبا|هاي|سلام|صباح|مساء|hello|hi|هلا|عامل ايه|اخبارك|ازاي الحال|يا باشا|ياباشا)'),
    thanks: re('(شكرا|تسلم|تسلمي|thanks|ميرسي|جزاك)'),
    yes: re('^(ايوه|ايوا|اه|اة|ايه ده هو|صح|تمام|ده هو|هو ده|قصدي|ok|yes|اي|ايوة|اكيد)( |$)'),
    no: re('^(لا|لاء|no|مش كده|غلط|لأ)( |$)'),
    skip: re('^(سيبه|سيبها|تجاهله|تجاهلها|خلاص|مش مهم|شيله|شيلها|لا مش مهم|بلاش|ماتحسبوش|متحسبوش)( |$)')
  };
  var FIELD = [[/بروتين/, 'p', 'بروتين'], [/(كارب|كربوهيدرات|نشويات)/, 'c', 'كارب'], [/دهون/, 'f', 'دهون'], [/(سعر|كالوري)/, 'k', 'سعرات']];

  function create(opts) {
    var B = Base.create(opts), st = B._st, idx = B._idx, compute = B.compute;
    st.queue = []; st.lastId = null;
    var ORDINAL = B.ORDINAL, SINGULAR = B.SINGULAR; ORDINAL['تاني'] = 1; ORDINAL['تانيه'] = 1; ORDINAL['ثاني'] = 1;

    /* ---------- رد منسّق ---------- */
    function mkReply(text, o) {
      o = o || {};
      var r = { text: text, card: o.card || null, notes: o.notes || [], chips: o.chips || [], kind: o.kind || 'text', pending: st.pending ? st.pending.type : null };
      var lines = [text];
      if (r.card) {
        r.card.rows.forEach(function (x) { lines.push('• ' + x.name + (x.ok ? ' — ' + x.qty + ': ' + x.k + ' سعرة' : ' — محتاج بيانات')); });
        if (r.card.total.n) lines.push('الإجمالي: ' + r.card.total.k + ' سعرة · بروتين ' + f1(r.card.total.p) + ' · كارب ' + f1(r.card.total.c) + ' · دهون ' + f1(r.card.total.f));
      }
      r.notes.forEach(function (n) { lines.push(n); });
      r.plain = lines.join('\n');
      return r;
    }
    function noteLines(fresh) {
      var assume = [], warn = [], seen = {};
      st.draft.forEach(function (it) {
        if (fresh && fresh.indexOf(it.id) < 0) return;
        (it.notes || []).forEach(function (n) { if (seen[n]) return; seen[n] = 1; (n.indexOf(' = ') >= 0 ? assume : warn).push(n); });
        (it.notes0 || []).forEach(function (n) { if (!seen[n]) { seen[n] = 1; warn.push(n); } });
        if (it.food && it.food.src === 'Open Food Facts') warn.push('«' + it.food.name + '»: القيم من Open Food Facts (منتج مطابق لاسمه)، وممكن تختلف حسب الماركة.');
      });
      var out = [];
      if (assume.length) { out.push('اعتبرت:'); assume.forEach(function (a) { out.push('• ' + a); }); }
      warn.forEach(function (w) { out.push(w); });
      var anyAp = st.draft.some(function (it) { return (!fresh || fresh.indexOf(it.id) >= 0) && it.food && it.food.ap && it.status === 'ok' && it.food.src !== 'Open Food Facts'; });
      if (anyAp) out.push('الأكلات المركبة قيمتها تقريبية لأن الوصفة بتختلف من بيت لبيت.');
      if (assume.length && !st.hintShown) { st.hintShown = true; out.push('لو الوزن مختلف قولي (مثلًا: «الرغيف كان 70 جرام») وأنا أظبط الحسبة.'); }
      return out;
    }
    function mealChips() {
      var arr = [['b', 'الفطار'], ['l', 'الغدا'], ['d', 'العشا'], ['s', 'سناكس']].map(function (m) { return { label: 'سجّل في ' + m[1], act: 'log', meal: m[0], primary: st.meal === m[0] }; });
      return arr;
    }
    function showCard(head, fresh, extra) {
      var card = B.cardOf(), notes = noteLines(fresh);
      var q = askNext();
      var chips = q ? q.chips : (card.total.n ? mealChips() : []);
      var text = head;
      if (q) text += '\n\n' + q.text;
      return mkReply(text, { card: card, notes: notes, chips: chips, kind: 'calc' });
    }

    /* ---------- أسئلة التوضيح ---------- */
    function askNext() {
      st.pending = st.queue.length ? st.queue[0] : null;
      var p = st.pending; if (!p) return null;
      var it = byId(p.id); if (!it) { st.queue.shift(); return askNext(); }
      if (p.type === 'generic') return { text: p.g.q + ' (' + p.g.opts.join(' / ') + ')', chips: p.g.opts.map(function (o) { return { label: o, send: o }; }) };
      if (p.type === 'suggest') return { text: 'تقصد «' + p.entry.name + '»؟', chips: [{ label: 'أيوه', send: 'ايوه' }, { label: 'لأ', send: 'لا' }] };
      return { text: p.msg, chips: [{ label: 'سيبه', send: 'سيبه' }] };
    }
    function byId(id) { for (var i = 0; i < st.draft.length; i++) if (st.draft[i].id === id) return st.draft[i]; return null; }
    function dropPending(id) { st.queue = st.queue.filter(function (q) { return q.id !== id; }); }
    function removeItemById(id) { st.draft = st.draft.filter(function (x) { return x.id !== id; }); dropPending(id); }

    /* ---------- حل الأصناف الجديدة ---------- */
    function nearest(phrase) {
      var best = null, bd = 99, tie = false, lim = phrase.length >= 7 ? 2 : (phrase.length >= 4 ? 1 : 0);
      if (!lim) return null;
      idx.aliasKeys.forEach(function (k) {
        if (Math.abs(k.length - phrase.length) > lim) return;
        var d = C.lev(phrase, k);
        if (d <= lim) { if (d < bd) { bd = d; best = idx.alias[k].entry; tie = false; } else if (d === bd && idx.alias[k].entry.id !== best.id) tie = true; }
      });
      return tie ? null : best;
    }
    async function unknownFlow(it, phrase) {
      var near = nearest(phrase);
      if (near) { it.status = 'ask'; it.label = phrase; st.queue.push({ type: 'suggest', id: it.id, entry: near, phrase: phrase }); return; }
      var on = await B.lookupOnline(phrase);
      if (on.status === 'ok') { it.food = on.food; it.status = 'ok'; return; }
      it.status = 'ask'; it.label = phrase;
      var why = on.status === 'offline' ? 'جهازك ظاهر إنه من غير اتصال بالإنترنت' : (on.status === 'error' ? 'الاتصال بمصدر البحث الخارجي فشل، رغم إن ده مش معناه إن نت موبايلك فاصل' : (on.status === 'none' ? 'بحثت أونلاين ومفيش بيانات مطابقة بالاسم' : ''));
      st.queue.push({ type: 'unknown', id: it.id, phrase: phrase, msg: 'مش لاقي «' + phrase + '» في قاعدتي' + (why ? '، ' + why : '') + '.\nاكتبلي قيمته لكل 100 جم كده: «150 سعرة 10 بروتين 20 كارب 5 دهون»، أو قولي اسم أكلة قريبة، أو اكتب «سيبه» وأشيله من الحساب.' });
    }
    async function ingest(items) {
      var fresh = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i]; it.id = U.uid(); it.status = 'ok'; it.notes = []; fresh.push(it.id);
        if (it.food) { B.applyCook(it); }
        else if (it.generic) { it.status = 'ask'; it.label = it.generic.w; st.queue.push({ type: 'generic', id: it.id, g: it.generic }); }
        else { await unknownFlow(it, it.unk.join(' ')); if (it.food && it.status === 'ok') B.applyCook(it); }
        compute(it);
      }
      return fresh;
    }
    function mergeInto(list, items) {
      items.forEach(function (n) {
        var m = null;
        if (n.status === 'ok' && n.food && n.wt == null && !n.vague) list.forEach(function (o) { if (!m && o.status === 'ok' && o.food && o.food.id === n.food.id && o.wt == null && !o.vague && (o.unit || null) === (n.unit || null) && (o.size || 1) === (n.size || 1)) m = o; });
        if (m) { m.qty = (m.qty == null ? 1 : m.qty) + (n.qty == null ? 1 : n.qty); compute(m); n.merged = m.id; }
        else list.push(n);
      });
    }
    function mealHint(n) {
      var toks = n.split(' '), m = null;
      toks.forEach(function (t) { var s = C.stripAl(t); if (C.MEALW[s]) m = C.MEALW[s]; else if (C.MEALW[t]) m = C.MEALW[t]; });
      return m;
    }

    /* ---------- المحاور ---------- */
    async function doCalc(n, addMode) {
      var items = C.parseItems(idx, n).filter(function (x) { return x.food || x.generic || x.unk.length; });
      if (!items.length) return null;
      var hint = mealHint(n); if (hint) st.meal = hint;
      var hadDraft = st.draft.length > 0, replaced = false;
      if (!addMode) { replaced = hadDraft; st.draft = []; st.queue = []; st.hintShown = false; }
      var fresh = await ingest(items);
      var before = st.draft.length; mergeInto(st.draft, items);
      fresh = fresh.filter(function (id) { return !!byId(id); });
      st.lastId = items[items.length - 1].id;
      var addedNames = items.filter(function (x) { return x.food; }).map(function (x) { return x.food.name; });
      var head = addMode ? 'ضفتلك ' + (addedNames.length ? addedNames.join('، ') : 'الصنف') + '، والحساب بقى كده:' : (replaced ? 'بدأت حساب جديد بدل اللي فات:' : 'تمام، حسبتلك الوجبة:');
      if (st.queue.length && !st.draft.some(function (x) { return x.status === 'ok'; })) head = (replaced ? 'بدأت حساب جديد بدل اللي فات. ' : '') + 'محتاج توضيح بسيط:';
      return showCard(head, fresh);
    }
    function findTargets(phrase) {
      var its = C.parseItems(idx, phrase).filter(function (x) { return x.food; });
      var out = [];
      if (its.length) {
        var e = its[0].food;
        st.draft.forEach(function (d) { if (d.food && (d.food.id === e.id || d.food.grp === e.grp)) out.push(d); });
        if (out.length) return { items: out, parsed: its[0] };
      }
      var toks = C.canonTokens(idx, phrase);
      toks.forEach(function (t) { var cu = C.CUNIT[t]; if (cu) st.draft.forEach(function (d) { if (d.food && (d.unit === cu.key || C.norm(d.food.du) === cu.key) && out.indexOf(d) < 0) out.push(d); }); });
      return { items: out, parsed: its[0] || null };
    }
    function doRemove(rest) {
      if (!st.draft.length) return mkReply('مفيش حساب دلوقتي عشان أشيل منه حاجة.');
      var f = findTargets(rest), toks = C.canonTokens(idx, rest);
      if (!f.items.length) return mkReply('مش لاقي «' + rest + '» في الحساب الحالي. الموجود: ' + st.draft.map(function (x) { return x.food ? x.food.name : (x.label || '؟'); }).join('، ') + '.');
      var single = toks.some(function (t) { return SINGULAR[t] || ORDINAL[t]; }), explicitQty = f.parsed ? f.parsed.qty : null, msg = [];
      f.items.forEach(function (it) {
        var q = it.qty == null ? 1 : it.qty, nm = it.food ? it.food.name : (it.label || 'الصنف');
        if (explicitQty != null && it.wt == null && it.qty != null && explicitQty < q) { it.qty = q - explicitQty; compute(it); msg.push('شيلت ' + fmtN(explicitQty) + ' من ' + nm); }
        else if (single && explicitQty == null && it.wt == null && it.qty != null && q > 1) { it.qty = q - 1; compute(it); msg.push('شيلت واحدة من ' + nm); }
        else { removeItemById(it.id); msg.push('شيلت ' + nm); }
      });
      var head = msg.join('، ') + '.';
      if (!st.draft.length) return mkReply(head + ' الحساب بقى فاضي.');
      return showCard(head + ' الحساب بقى كده:', []);
    }
    function fmtN(x) { return x === 1 ? 'واحدة' : String(x); }
    function doCorrect(n) {
      var toks = C.canonTokens(idx, n), bd = toks.indexOf('بدل');
      /* تغيير طريقة الطهي: «مشوي بدل مقلي» */
      if (bd > 0 && C.COOKW[toks[bd - 1]] && C.COOKW[toks[bd + 1]]) {
        var nc = C.COOKW[toks[bd - 1]], oc = C.COOKW[toks[bd + 1]];
        var rest = toks.filter(function (t, i) { return i !== bd - 1 && i !== bd && i !== bd + 1; }).join(' ');
        var tg = rest.trim() ? findTargets(rest).items : [];
        if (!tg.length) tg = st.draft.filter(function (x) { return x.food && x.food.ck === oc; });
        if (!tg.length) return mkReply('مفيش حاجة في الحساب بطريقة ' + ({ fry: 'التحمير', boil: 'السلق', grill: 'الشوي' }[oc] || 'دي') + ' عشان أغيّرها.');
        var done = [], fresh = [];
        tg.forEach(function (it) { var v = B.variantOf(it.food, nc); if (v) { it.food = v; compute(it); done.push(v.name); fresh.push(it.id); } });
        if (!done.length) return mkReply('مفيش عندي النسخة دي من الأكل ده، فسيبت الحساب زي ما هو.');
        return showCard('غيّرتها لـ ' + done.join('، ') + ':', fresh);
      }
      var m = n.match(/^(?:(.*?)\s+)?(?:كان|كانت|كانوا)\s+(.+)$/), target = null, val = null;
      if (m) { target = m[1] || ''; val = m[2]; }
      else {
        m = n.match(new RegExp('^(?:خلي|خليه|خليها|خليهم|غير|غيرها|عدل|عدلها)' + AR + '\\s+(.+?)\\s+(?:ل|لـ|الي|الى|ب|يبقي|يبقى)?\\s*(\\d.*)$'));
        if (m) { target = m[1]; val = m[2]; }
        else { m = n.match(new RegExp('^(?:خلي|خليه|خليها|خليهم|غير|غيرها|عدل|عدلها)' + AR + '\\s+(?:ل|لـ|الي|الى)?\\s*(\\d.*)$')); if (m) { target = ''; val = m[1]; } }
      }
      if (val == null) return null;
      val = val.replace(/\s*(?:بدل|مش|وليس|مو|بدلا من)\s+.*$/, '').trim();
      var vp = C.parseItems(idx, val + ' بيضة')[0];
      if (!vp || (vp.wt == null && vp.qty == null)) return null;
      var tgt = [];
      if (target && target.trim()) tgt = findTargets(target).items;
      else if (st.lastId && byId(st.lastId)) tgt = [byId(st.lastId)];
      else if (st.draft.length === 1) tgt = [st.draft[0]];
      if (!tgt.length && st.draft.length === 1) tgt = [st.draft[0]];
      if (!tgt.length) return mkReply(st.draft.length ? 'تقصد أنهي صنف؟ الموجود: ' + st.draft.map(function (x) { return x.food ? x.food.name : '؟'; }).join('، ') + '.' : 'مفيش حساب أعدّل فيه. ابعتلي الأكل الأول.');
      var all = target ? C.canonTokens(idx, target + ' ' + val) : toks, tot = all.some(function (t) { return TOTAL_W_has(t); });
      var tp = target ? C.parseItems(idx, target)[0] : null, dual = tp && tp.qty === 2 && C.matchFood(idx, C.canonTokens(idx, target), 0) && C.matchFood(idx, C.canonTokens(idx, target), 0).dual;
      var fresh2 = [];
      tgt.forEach(function (it) {
        if (vp.wt != null) {
          it.wt = vp.wt;
          it.wtAfter = !!(it.qty != null && it.qty > 1 && !tot && !dual);
        } else if (vp.qty != null) {
          if (it.wt == null && (vp.qty <= 20 || vp.unit)) { it.qty = vp.qty; if (vp.unit) it.unit = vp.unit; }
          else { it.wt = vp.qty; it.wtAfter = false; }
        }
        compute(it); fresh2.push(it.id); st.lastId = it.id;
      });
      var names = tgt.map(function (x) { return x.food ? x.food.name : 'الصنف'; }).join('، ');
      return showCard('تمام، عدّلت ' + names + ' وحسبت الوجبة من جديد:', fresh2);
    }
    function TOTAL_W_has(t) { return !!B.TOTAL_W[t]; }

    /* ---------- أسئلة عن الوجبة واليوم ---------- */
    function fieldsOf(n) { var out = []; FIELD.forEach(function (f) { if (f[0].test(n)) out.push(f); }); if (/ماكروز/.test(n) || !out.length) out = FIELD.slice(); return out; }
    function dayOf(offset) { try { return opts.getDay ? opts.getDay(offset || 0) : null; } catch (e) { return null; } }
    function macroLine(t) { return r0(t.k) + ' سعرة · بروتين ' + f1(t.p) + ' · كارب ' + f1(t.c) + ' · دهون ' + f1(t.f); }
    function doQuery(n) {
      var fs = fieldsOf(n);
      var its = C.parseItems(idx, n).filter(function (x) { return x.food; });
      if (its.length && !/(الوجبه|الحساب|دي)/.test(n)) {
        var tmp = its.map(function (x) { x.id = U.uid(); x.status = 'ok'; x.notes = []; B.applyCook(x); compute(x); return x; });
        var t = B.totals(tmp), nm = tmp.map(function (x) { return B.qtyText(x) + ' ' + x.food.name; }).join(' + ');
        return mkReply(nm + ': ' + fs.map(function (f) { return (f[1] === 'k' ? r0(t.k) + ' سعرة' : f1(t[f[1]]) + ' جم ' + f[2]); }).join(' · ') + '.', { kind: 'info' });
      }
      var day = null;
      if (/(النهارده|اليوم|انهارده)/.test(n) && !/(الوجبه|دي)/.test(n)) day = dayOf(0);
      if (day) {
        var T = day.totals; return mkReply('النهارده لحد دلوقتي: ' + fs.map(function (f) { return f[1] === 'k' ? r0(T.k) + ' سعرة' : f1(T[f[1]]) + ' جم ' + f[2]; }).join(' · ') + '.', { kind: 'info' });
      }
      var t2 = B.totals();
      if (!t2.n) return mkReply('ابعتلي الوجبة الأول (مثلًا: «احسبلي 2 بيضة ورغيفين عيش بلدي») وأنا أقولك.');
      var tg = (opts.getTargets ? opts.getTargets() : null) || {};
      var line = fs.map(function (f) {
        var v = t2[f[1]], goal = f[1] === 'k' ? tg.kcal : tg[f[1]], pc = goal ? ' (' + r0(v / goal * 100) + '% من هدفك)' : '';
        return (f[1] === 'k' ? r0(v) + ' سعرة' : f1(v) + ' جم ' + f[2]) + pc;
      }).join(' · ');
      return mkReply('الوجبة دي فيها حوالي ' + line + '.', { kind: 'info', chips: mealChips() });
    }
    function doToday(offset) {
      var day = dayOf(offset);
      if (!day) return mkReply('مقدرتش أقرا سجل اليوم دلوقتي.');
      if (!day.entries || !day.entries.length) return mkReply('لسه ما سجلتش أكل ' + (offset ? 'في اليوم ده' : 'النهارده') + '.');
      var by = {}; day.entries.forEach(function (e) { (by[e.meal] = by[e.meal] || []).push(e); });
      var lines = ['سجّلت ' + (offset ? 'اليوم ده' : 'النهارده') + ':'];
      ['b', 'l', 'd', 's'].forEach(function (m) { if (by[m]) lines.push('• ' + MEAL_NAME[m] + ': ' + by[m].map(function (e) { return e.n; }).join('، ') + ' (' + r0(by[m].reduce(function (a, e) { return a + e.k; }, 0)) + ' سعرة)'); });
      lines.push('الإجمالي: ' + macroLine(day.totals) + (day.targets ? '\nمن هدفك ' + day.targets.kcal + ' سعرة.' : ''));
      return mkReply(lines.join('\n'), { kind: 'day' });
    }
    function doRemain(offset) {
      var day = dayOf(offset);
      if (!day || !day.targets) return mkReply('لسه ما حدّدتش هدفك اليومي. اضبط بياناتك من الإعدادات وبعدها أقولك فاضل كام سعرة.');
      var T = day.totals, G = day.targets, left = G.kcal - T.k;
      var head = left >= 0 ? 'فاضلك ' + r0(left) + ' سعرة من هدفك (' + G.kcal + ').' : 'عديت هدفك بـ ' + r0(-left) + ' سعرة (الهدف ' + G.kcal + ').';
      var mac = 'بروتين: ' + (G.p - T.p >= 0 ? 'فاضل ' + f1(G.p - T.p) + ' جم' : 'زيادة ' + f1(T.p - G.p) + ' جم') + ' · كارب: ' + (G.c - T.c >= 0 ? 'فاضل ' + f1(G.c - T.c) + ' جم' : 'زيادة ' + f1(T.c - G.c) + ' جم') + ' · دهون: ' + (G.f - T.f >= 0 ? 'فاضل ' + f1(G.f - T.f) + ' جم' : 'زيادة ' + f1(T.f - G.f) + ' جم');
      return mkReply(head + '\n' + mac, { kind: 'day' });
    }

    /* ---------- التسجيل ---------- */
    function doLog(n, mealArg) {
      var ready = st.draft.filter(function (x) { return x.status === 'ok' && x.res; });
      if (!ready.length) return mkReply(st.draft.length ? 'لسه فيه أصناف محتاجة بيانات. كمّلها الأول أو قول «سيبه» وبعدين سجّل.' : 'مفيش حساب أسجله. ابعتلي الأكل الأول.');
      var meal = mealArg || mealHint(n) || st.meal;
      if (!meal) return mkReply('تسجلها في أنهي وجبة؟', { chips: mealChips(), card: B.cardOf(), kind: 'ask-meal' });
      var offset = /امبارح/.test(n) ? -1 : 0;
      var entries = ready.map(function (it) {
        var q = it.qty, nm = it.food.name + ((!it.res.explicit && q != null && q !== 1 && !it.vague) ? ' ×' + fmtQ(q) : '');
        return { name: nm, g: it.res.g, k: it.res.k, p: it.res.p, c: it.res.c, f: it.res.f, foodId: it.food.id, src: it.food.src || 'قاعدة SHADY SPILT' };
      });
      if (!opts.logItems) return mkReply('التسجيل مش متاح دلوقتي.');
      opts.logItems(entries, meal, offset);
      var skipped = st.draft.length - ready.length, tt = B.totals(ready);
      st.last = { meal: meal, items: ready.length }; st.hintShown = false; st.draft = []; st.queue = []; st.pending = null; st.meal = null;
      var day = dayOf(offset), tail = '';
      if (day && day.targets) tail = ' إجمالي ' + (offset ? 'اليوم ده' : 'النهارده') + ' بقى ' + r0(day.totals.k) + ' من ' + day.targets.kcal + ' سعرة.';
      return mkReply('تمام، سجلتها في ' + MEAL_NAME[meal] + ': ' + ready.length + ' ' + (ready.length > 2 && ready.length < 11 ? 'أصناف' : 'صنف') + '، حوالي ' + r0(tt.k) + ' سعرة.' + tail + (skipped ? '\nمن غير ' + skipped + ' صنف كانوا محتاجين بيانات.' : ''), { kind: 'logged', logged: { meal: meal, n: ready.length, k: r0(tt.k) } });
    }
    function fmtQ(q) { return B.fmtQty(q); }

    /* ---------- أسئلة معلقة ---------- */
    function parseMacros(n) {
      function g(rx) { var m = n.match(rx); return m ? parseFloat(m[1] || m[2]) : null; }
      var k = g(/(\d+(?:\.\d+)?)\s*(?:سعره|سعرات|كالوري|kcal|كيلو كالوري)/), p = g(/(\d+(?:\.\d+)?)\s*(?:جم\s*|جرام\s*)?بروتين|بروتين\s*[:=]?\s*(\d+(?:\.\d+)?)/),
        c = g(/(\d+(?:\.\d+)?)\s*(?:جم\s*|جرام\s*)?(?:كارب|كربوهيدرات|نشويات)|(?:كارب|كربوهيدرات|نشويات)\s*[:=]?\s*(\d+(?:\.\d+)?)/), f = g(/(\d+(?:\.\d+)?)\s*(?:جم\s*|جرام\s*)?(?:دهون|دهن)|(?:دهون|دهن)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      return (k != null && p != null && c != null && f != null) ? { k: k, p: p, c: c, f: f } : null;
    }
    async function resolvePending(n) {
      var p = st.pending, it = p && byId(p.id);
      if (!it) { st.queue.shift(); st.pending = null; return null; }
      var fin = function (head) { st.queue.shift(); compute(it); return showCard(head, [it.id]); };
      if (R.skip.test(n)) { removeItemById(it.id); if (!st.draft.length) return mkReply('تمام، شيلته. الحساب فاضي.'); return showCard('تمام، شيلته من الحساب:', []); }
      if (p.type === 'generic') {
        var hit = null, toks = C.canonTokens(idx, n);
        p.g.opts.forEach(function (o) { var on = norm(o); if (!hit && (on === n || on.split(' ').some(function (w) { return toks.indexOf(w) >= 0 && w !== norm(p.g.w); }))) hit = o; });
        if (!hit) { var mf = C.matchFood(idx, toks, 0); if (mf && p.g.opts.indexOf(mf.entry.name) >= 0) hit = mf.entry.name; }
        if (!hit) { st.queue.shift(); st.pending = null; return null; }
        var e = idx.alias[norm(hit)].entry; it.food = e; it.generic = null; it.status = 'ok'; B.applyCook(it); return fin('تمام، حسبتها ' + e.name + ':');
      }
      if (p.type === 'suggest') {
        if (R.yes.test(n)) { it.food = p.entry; it.status = 'ok'; it.unk = []; B.applyCook(it); return fin('تمام، حسبتها ' + p.entry.name + ':'); }
        if (R.no.test(n)) { st.queue.shift(); st.pending = null; var on = await B.lookupOnline(p.phrase); if (on.status === 'ok') { it.food = on.food; it.status = 'ok'; compute(it); return showCard('لقيته أونلاين:', [it.id]); } st.queue.unshift({ type: 'unknown', id: it.id, phrase: p.phrase, msg: 'ماشي. مش لاقي «' + p.phrase + '» عندي' + (on.status === 'offline' ? ' والجهاز ظاهر أوفلاين' : (on.status === 'error' ? ' لكن الاتصال بمصدر البحث فشل، مش بالضرورة النت عندك' : '')) + '.\nاكتبلي قيمته لكل 100 جم كده: «150 سعرة 10 بروتين 20 كارب 5 دهون»، أو اكتب «سيبه».' }); return showCard('تمام:', []); }
        st.queue.shift(); st.pending = null; return null;
      }
      if (p.type === 'unknown') {
        var mc = parseMacros(n);
        if (mc) {
          var cf = { id: 'cu' + U.uid(), n: p.phrase, k: mc.k, p: mc.p, c: mc.c, f: mc.f, g: 100, u: 'حصة' };
          if (opts.saveCustomFood) { try { opts.saveCustomFood(cf); } catch (e) { } }
          var fo = Base.convertCustom(cf); fo.src = 'من إدخالك'; C.addAlias(idx, fo, p.phrase);
          it.food = fo; it.status = 'ok'; it.unk = []; return fin('تمام، حفظت «' + p.phrase + '» وحسبتها:');
        }
        var all2 = C.parseItems(idx, n), re2 = (all2.length === 1 && all2[0].food && all2[0].qty == null && all2[0].wt == null && !all2[0].unit) ? all2[0] : null;
        if (re2) { it.food = re2.food; it.status = 'ok'; it.unk = []; B.applyCook(it); return fin('تمام، حسبتها ' + re2.food.name + ':'); }
        st.queue.shift(); st.pending = null; return null;
      }
      return null;
    }

    function helpReply() {
      return mkReply('أنا بحسبلك الأكل بالمصري. جرّب:\n• «احسبلي 2 بيضة ورغيفين عيش بلدي»\n• «زود معلقة زيت» / «شيل البيضة»\n• «الرغيف كان 70 جرام»\n• «كام بروتين في الوجبة دي؟»\n• «سجلها في الفطار»\n• «أنا أكلت إيه النهارده؟» / «فاضلي كام سعرة؟»');
    }
    /* ---------- المدخل الرئيسي ---------- */
    async function handle(text) {
      try {
        var raw = String(text == null ? '' : text).trim();
        if (!raw) return mkReply('اكتبلي أكلك وأنا أحسبه.');
        var n = norm(raw), out;
        if (st.pending) { out = await resolvePending(n); if (out) return out; }
        if (R.reset.test(n)) { st.draft = []; st.queue = []; st.pending = null; st.meal = null; st.hintShown = false; return mkReply('تمام، مسحت الحساب. ابعتلي الأكل اللي عايز تحسبه.'); }
        if (R.log.test(n) && !C.parseItems(idx, n.replace(R.log, ' ')).some(function (x) { return x.food && x.qty != null; })) return doLog(n);
        if (R.today.test(n)) return doToday(/امبارح/.test(n) ? -1 : 0);
        if (R.remain.test(n) && /(سعر|كالوري|هدف|بروتين|كارب|دهون|ماكروز|كام)/.test(n)) return doRemain(0);
        if (R.query.test(n)) return doQuery(n);
        var rm = n.match(R.remove);
        if (rm && rm[1] !== undefined && rm[1].trim()) return doRemove(rm[1].trim());
        if (st.draft.length && R.correct.test(n)) { out = doCorrect(n); if (out) return out; }
        var ad = n.match(R.add);
        if (ad && ad[1] !== undefined && ad[1].trim()) { out = await doCalc(ad[1].trim(), true); if (out) return out; }
        var addMode = st.draft.length > 0 && /^(و|كمان|مع)( |$)/.test(n);
        var known = C.parseItems(idx, n).some(function (x) { return x.food || x.generic; });
        if (!known) {
          if (R.help.test(n)) return helpReply();
          if (R.greet.test(n)) return mkReply('أهلًا! قولي أكلت إيه وأنا أحسبهولك، مثلًا: «احسبلي 200 جرام فراخ مشوية و150 جرام رز».');
          if (R.thanks.test(n)) return mkReply('العفو، في أي وقت.');
        }
        out = await doCalc(n, addMode);
        if (out) return out;
        if (R.help.test(n)) return helpReply();
        if (R.greet.test(n)) return mkReply('أهلًا! قولي أكلت إيه وأنا أحسبهولك، مثلًا: «احسبلي 200 جرام فراخ مشوية و150 جرام رز».');
        if (R.thanks.test(n)) return mkReply('العفو، في أي وقت.');
        return mkReply('مفهمتش قصدك. اكتب الأكل والكمية، زي: «احسبلي 2 بيضة ورغيفين عيش بلدي»، أو اكتب «مساعدة».');
      } catch (e) {
        return mkReply('حصلت مشكلة صغيرة وأنا بحسب. جرّب تبعت الرسالة تاني، وحسابك الحالي لسه زي ما هو.', { kind: 'error' });
      }
    }

    /* ---------- واجهة للشاشة ---------- */
    function setGrams(id, g) { var it = byId(id); if (!it || !(g > 0)) return false; it.wt = g; it.wtAfter = false; compute(it); st.lastId = id; return true; }
    function removeItem(id) { removeItemById(id); askNext(); }
    function clear() { st.draft = []; st.queue = []; st.pending = null; st.meal = null; }
    function getState() { return JSON.parse(JSON.stringify({ draft: st.draft.map(function (x) { var c = Object.assign({}, x); delete c.res; delete c.generic; return c; }), meal: st.meal, queue: st.queue.map(function (q) { var c = Object.assign({}, q); delete c.entry; delete c.g; return c; }) })); }
    function setState(s) {
      try {
        if (!s || !Array.isArray(s.draft)) return;
        st.draft = s.draft.filter(function (x) { return x && x.id && x.food; }); st.meal = s.meal || null; st.queue = []; st.pending = null;
        st.draft.forEach(function (x) { if (x.food && x.food.id && idx.byId[x.food.id]) x.food = idx.byId[x.food.id]; x.notes = []; compute(x); });
      } catch (e) { clear(); }
    }
    return { handle: handle, getCard: function () { return B.cardOf(); }, setGrams: setGrams, removeItem: removeItem, clear: clear, logDraft: function (m) { return doLog('', m); }, getState: getState, setState: setState,
      hasDraft: function () { return st.draft.length > 0; }, pendingType: function () { return st.pending ? st.pending.type : null; }, mealChips: mealChips, _st: st, _B: B, _idx: idx };
  }
  var api = { create: create };
  root.SSBot = api;
  if (node) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
