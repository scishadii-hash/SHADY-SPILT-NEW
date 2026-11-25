/* اختبارات بوت SHADY SPILT. التشغيل: node tests/bot.test.js */
var SSBot = require('../bot/brain.js'), D = require('../bot/foods-eg.js'), C = require('../bot/engine.js');
var pass = 0, fail = 0, fails = [];
function ok(c, name, info) { if (c) { pass++; console.log('  ✓ ' + name); } else { fail++; fails.push(name); console.log('  ✗ ' + name + (info ? '  →  ' + info : '')); } }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1 : tol); }
function mk(o) {
  var log = [], st = { logged: log };
  var bot = SSBot.create(Object.assign({
    online: false,
    logItems: function (e, m, off) { log.push({ meal: m, items: e, off: off }); },
    getDay: function () { return { totals: { k: 900, p: 60, c: 100, f: 30 }, targets: { kcal: 3000, p: 130, c: 500, f: 65 }, entries: [{ meal: 'b', n: 'عيش بلدي', k: 400 }] }; },
    getTargets: function () { return { kcal: 3000, p: 130, c: 500, f: 65 }; }
  }, o || {}));
  bot.log = log; return bot;
}
function row(r, i) { return r.card && r.card.rows[i]; }
function T(r) { return r.card ? r.card.total : null; }
function mockFetch(products) { return function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ products: products }); } }); }; }

(async function () {
  console.log('\n== قاعدة الأكل ==');
  var ids = {}, bad = [], coll = {};
  D.FOODS.forEach(function (f) {
    if (ids[f.id]) bad.push('dup ' + f.id); ids[f.id] = 1;
    if (f.k >= 40 && Math.abs(f.p * 4 + f.c * 4 + f.f * 9 - f.k) / f.k > 0.15) bad.push('macro ' + f.id);
    if (!f.units[f.du]) bad.push('du ' + f.id);
  });
  ok(bad.length === 0, 'كل صنف: سعراته متسقة مع ماكروزه (±15%) والوحدة الافتراضية موجودة', bad.join(', '));
  var seen = {}, collisions = [];
  D.FOODS.forEach(function (f) { String(f.names).split('|').forEach(function (a) { a = C.norm(a.replace(/^#2/, '')); if (seen[a] && seen[a] !== f.id) collisions.push(a + ':' + seen[a] + '/' + f.id); seen[a] = f.id; }); });
  ok(collisions.length === 0, 'مفيش اسم واحد بيشاور على صنفين', collisions.join(' | '));

  console.log('\n1) «2 بيضة و2 رغيف عيش بلدي»');
  var b = mk(), r = await b.handle('2 بيضة و2 رغيف عيش بلدي');
  ok(r.card.rows.length === 2 && row(r, 0).k === 155 && row(r, 1).k === 486 && T(r).k === 641, 'بيض 155 + عيش 486 = 641', JSON.stringify(T(r)));
  ok(/اعتبرت/.test(r.plain) && /90 جم/.test(r.plain) && /50 جم/.test(r.plain), 'بيوضح إنه افترض وزن البيضة 50 والرغيف 90');

  console.log('\n2) «بيضتين ورغيف ونص»');
  b = mk(); r = await b.handle('بيضتين ورغيف ونص');
  ok(row(r, 0).g === 100 && near(row(r, 1).g, 135, 0.6) && near(T(r).k, 155 + 364.5, 1.5), 'بيضتين=100جم، رغيف ونص=135جم', JSON.stringify(r.card.rows.map(function (x) { return x.g; })));

  console.log('\n3) «150 جرام رز مطبوخ و200 جرام فراخ مشوية»');
  b = mk(); r = await b.handle('150 جرام رز مطبوخ و200 جرام فراخ مشوية');
  ok(row(r, 0).g === 150 && row(r, 0).k === 195 && row(r, 1).g === 200 && row(r, 1).k === 330 && T(r).k === 525, 'رز 195 + فراخ 330 = 525', JSON.stringify(T(r)));
  ok(!/اعتبرت:/.test(r.plain), 'مفيش افتراض أوزان لأن الأوزان مكتوبة');

  console.log('\n4) «زود معلقة زيت»');
  r = await b.handle('زود معلقة زيت');
  ok(r.card.rows.length === 3 && row(r, 2).g === 14 && row(r, 2).k === 124 && T(r).k === 649, 'الزيت 14جم = 124 سعرة، والإجمالي اتحدث 649', JSON.stringify(T(r)));
  r = await b.handle('زود على الحساب معلقة زيت');
  ok(row(r, 2).g === 28, '«زود على الحساب معلقة زيت» بتدمج مع الزيت الموجود (28جم)', JSON.stringify(r.card.rows.map(function (x) { return x.name + x.g; })));

  console.log('\n5) «الرغيف كان 70 جرام بدل 90»');
  b = mk(); await b.handle('احسبلي 2 بيضة ورغيفين عيش بلدي');
  r = await b.handle('الرغيف كان 70 جرام بدل 90');
  ok(row(r, 1).g === 140 && row(r, 1).k === 378 && row(r, 0).k === 155 && T(r).k === 533, 'الرغيفين بقوا 140جم، والبيض ما اتغيرش، والإجمالي 533', JSON.stringify(T(r)));
  ok(!/\?|إيه/.test(r.text), 'من غير ما يسأل عن باقي الوجبة');

  console.log('\n6) «شيل البيضة»');
  b = mk(); await b.handle('2 بيضة ورغيف'); r = await b.handle('شيل البيضة');
  ok(row(r, 0).g === 50 && r.card.rows.length === 2, 'بيضتين → بيضة واحدة', JSON.stringify(r.card.rows.map(function (x) { return x.name + x.g; })));
  r = await b.handle('شيل البيضة');
  ok(r.card.rows.length === 1 && row(r, 0).name === 'عيش بلدي', 'تاني مرة بتشيل الصنف كله');
  b = mk(); await b.handle('3 بيضات ورز'); r = await b.handle('شيل البيضة التانية');
  ok(row(r, 0).g === 100, '«شيل البيضة التانية» من 3 → 2');
  b = mk(); await b.handle('3 بيضات ورز'); r = await b.handle('شيل الرز');
  ok(r.card.rows.length === 1, '«شيل الرز» بيشيل الصنف');

  console.log('\n7) «احسبلي بروتين الوجبة»');
  b = mk(); await b.handle('150 جرام رز مطبوخ و200 جرام فراخ مشوية'); r = await b.handle('احسبلي بروتين الوجبة');
  ok(/66\.1/.test(r.text) || /66/.test(r.text), 'بروتين الوجبة ≈ 66 جم', r.text);
  r = await b.handle('كام بروتين في الوجبة دي؟');
  ok(/66/.test(r.text), '«كام بروتين في الوجبة دي؟»', r.text);
  r = await mk().handle('كام بروتين في الوجبة دي؟');
  ok(/ابعتلي الوجبة/.test(r.text), 'من غير وجبة بيطلبها بدل ما يخترع رقم');

  console.log('\n8) «سجلها في الفطار»');
  b = mk(); await b.handle('2 بيضة ورغيفين عيش بلدي'); r = await b.handle('سجلها في الفطار');
  ok(b.log.length === 1 && b.log[0].meal === 'b' && b.log[0].items.length === 2 && near(b.log[0].items[1].k, 486, 0.6), 'اتسجلت في الفطار بنفس نظام التطبيق (logItems)', JSON.stringify(b.log[0] && b.log[0].meal));
  ok(!b.hasDraft(), 'والحساب اتفضّى بعد التسجيل');
  b = mk(); await b.handle('بيضتين'); r = await b.handle('سجلها');
  ok(/أنهي وجبة/.test(r.text) && b.log.length === 0 && r.chips.length === 4, 'من غير وجبة بيسأل وبيدّي أزرار');
  b = mk(); await b.handle('بيضتين'); await b.handle('سجلها في الغدا'); ok(b.log[0].meal === 'l', 'الغدا');
  b = mk(); await b.handle('فطرت بيضتين'); await b.handle('سجلها'); ok(b.log[0] && b.log[0].meal === 'b', '«فطرت» بتحدد الوجبة لوحدها');

  console.log('\n9) صنف غير معروف');
  b = mk(); r = await b.handle('احسبلي بيتزا مارجريتا و2 بيضة');
  ok(/مش لاقي «بيتزا مارجريتا»/.test(r.text) && r.card.rows.length === 2 && r.card.rows[0].ok === false, 'بيقول مش لاقيه ومش بيخترع قيمة', r.text);
  ok(T(r).k === 155 && /محتاج بيانات/.test(r.plain), 'الإجمالي من الأصناف المعروفة بس، والمجهول ظاهر ومش مخفي');
  r = await b.handle('150 سعرة 10 بروتين 20 كارب 5 دهون');
  ok(r.card.rows.length === 2 && row(r, 0).ok && row(r, 0).k === 150 && T(r).k === 305, 'لما أدّيله القيم بيحسب ويكمّل', JSON.stringify(T(r)));
  b = mk(); await b.handle('بيتزا'); r = await b.handle('سيبه'); ok(!b.hasDraft(), '«سيبه» بتشيل الصنف المجهول');

  console.log('\n10) فشل الإنترنت');
  b = mk({ online: true, fetchImpl: function () { return Promise.reject(new Error('network')); } });
  r = await b.handle('بيتزا مارجريتا');
  ok(/النت مش واصل/.test(r.text) && !/Error|undefined|network/.test(r.plain), 'رسالة بشرية من غير تفاصيل تقنية', r.text);
  r = await b.handle('2 بيضة'); ok(T(r).k === 155, 'التطبيق بيكمّل شغل على القاعدة المحلية');

  console.log('\n11) نتيجة بحث غير مطابقة');
  b = mk({ online: true, fetchImpl: mockFetch([{ product_name: 'Cheese Slices', nutriments: { 'energy-kcal_100g': 300, proteins_100g: 20, carbohydrates_100g: 3, fat_100g: 23 } }]) });
  r = await b.handle('pizza margherita');
  ok(/مش لاقي/.test(r.text) && r.card.rows[0].ok === false, 'منتج بإسم مختلف مش بيتاخد');
  b = mk({ online: true, fetchImpl: mockFetch([{ product_name: 'Pizza Margherita Frozen', nutriments: { 'energy-kcal_100g': 250, proteins_100g: 10, carbohydrates_100g: 30, fat_100g: 9 } }]) });
  r = await b.handle('100 جرام pizza margherita');
  ok(row(r, 0).ok && row(r, 0).k === 250 && /Open Food Facts/.test(r.plain), 'منتج مطابق بالاسم ومتسق بيتاخد ومصدره ظاهر', r.plain);
  b = mk({ online: true, fetchImpl: mockFetch([{ product_name: 'Pizza Margherita', nutriments: { 'energy-kcal_100g': 900, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } }]) });
  r = await b.handle('pizza margherita'); ok(/مش لاقي/.test(r.text), 'منتج أرقامه متناقضة (سعرات ≠ ماكروز) بيترفض');

  console.log('\n12) أرقام عربية');
  b = mk(); r = await b.handle('٢ بيضة و٣ رغيف عيش بلدي'); ok(row(r, 0).g === 100 && row(r, 1).g === 270, '٢ بيضة و٣ رغيف', JSON.stringify(r.card.rows.map(function (x) { return x.g; })));
  b = mk(); r = await b.handle('١٥٠ جم رز'); ok(row(r, 0).g === 150, '١٥٠ جم رز');

  console.log('\n13) كميات بالكلمات');
  b = mk(); r = await b.handle('تلات بيضات ومية وخمسين جرام رز'); ok(row(r, 0).g === 150 && row(r, 1).g === 150, 'تلات بيضات (150جم) + مية وخمسين جرام رز', JSON.stringify(r.card.rows.map(function (x) { return x.g; })));
  b = mk(); r = await b.handle('اتنين رغيف وتلاتة بيض'); ok(row(r, 0).g === 180 && row(r, 1).g === 150, 'اتنين رغيف وتلاتة بيض');
  b = mk(); r = await b.handle('نص رغيف'); ok(row(r, 0).g === 45, 'نص رغيف = 45جم');
  b = mk(); r = await b.handle('ربع فرخة'); ok(near(row(r, 0).g, 162.5, 1), 'ربع فرخة ≈ 162 جم', row(r, 0).g);
  b = mk(); r = await b.handle('ربع كيلو رز'); ok(row(r, 0).g === 250, 'ربع كيلو = 250جم');

  console.log('\n14) وجبة بعدة أصناف');
  b = mk(); r = await b.handle('كلت طبق كشري متوسط وكوباية عصير مانجا وموزة وعلبة تونة');
  ok(r.card.rows.length === 4 && r.card.rows.every(function (x) { return x.ok; }), '4 أصناف كلها اتحسبت', JSON.stringify(r.card.rows.map(function (x) { return x.name; })));
  ok(/كشري = 350 جم/.test(r.plain) && /تقريبية/.test(r.plain), 'الكشري: حجم الطبق معلن + تنبيه إنه تقريبي');
  var sum = r.card.rows.reduce(function (a, x) { return a + x.k; }, 0); ok(near(sum, T(r).k, 2), 'الإجمالي = مجموع الأصناف (متسق)', sum + ' vs ' + T(r).k);
  b = mk(); r = await b.handle('أنا فطرت 3 بيضات و100 جرام جبنة قريش ورغيف صغير');
  ok(r.card.rows.length === 3 && row(r, 1).g === 100 && row(r, 2).g === 63, 'مثال المستخدم: بيض + قريش 100جم + رغيف صغير (63جم)', JSON.stringify(r.card.rows.map(function (x) { return x.g; })));

  console.log('\n15) تصحيح بعد الحساب');
  b = mk(); await b.handle('150 جرام رز و200 جرام فراخ مشوية'); r = await b.handle('غير الرز ل 100 جرام');
  ok(row(r, 0).g === 100 && row(r, 1).g === 200, '«غير الرز ل 100 جرام»', JSON.stringify(r.card && r.card.rows.map(function (x) { return x.g; })));
  r = await b.handle('الفراخ كانت 250 جرام'); ok(row(r, 1).g === 250, '«الفراخ كانت 250 جرام»');
  b = mk(); await b.handle('بيضتين'); r = await b.handle('كانوا 3'); ok(row(r, 0).g === 150, '«كانوا 3» بتعدل العدد');
  b = mk(); await b.handle('فراخ محمرة وبطاطس محمرة'); r = await b.handle('مشوي بدل مقلي');
  ok(/فراخ مشوية/.test(r.plain) && /بطاطس محمرة/.test(r.plain), '«مشوي بدل مقلي»: الفراخ اتغيرت، والبطاطس فضلت (مفيش مشوية)', r.plain);
  b = mk(); r = await b.handle('بطاطس محمرة من غير زيت'); ok(/بطاطس مسلوقة/.test(r.plain) || /ماقدرتش أشيل الزيت/.test(r.plain), '«من غير زيت» مش متجاهلة بصمت', r.plain);

  console.log('\nإضافية: توضيح وأخطاء إملائية ووحدات');
  b = mk(); r = await b.handle('كوباية عصير');
  ok(/عصير إيه/.test(r.text) && r.chips.length === 4, 'اسم عام (عصير) بيسأل بدل ما يخمّن');
  r = await b.handle('مانجا'); ok(row(r, 0).name === 'عصير مانجا' && row(r, 0).g === 250, 'الرد «مانجا» بيكمّل الحساب');
  b = mk(); r = await b.handle('بيضت'); ok(/تقصد «بيضة مسلوقة»/.test(r.text), 'خطأ إملائي: بيقترح ومش بيحوّل بصمت');
  r = await b.handle('ايوه'); ok(row(r, 0) && row(r, 0).k === 78, 'بعد التأكيد بيحسب');
  b = mk(); r = await b.handle('معلقة زيت كبيرة'); ok(row(r, 0).g === 14, 'معلقة زيت كبيرة = 14جم');
  r = await mk().handle('معلقة زيت صغيرة'); ok(row(r, 0).g === 5, 'معلقة زيت صغيرة = 5جم');
  r = await mk().handle('رغيف عيش بلدي 70 جرام'); ok(row(r, 0).g === 70 && !/اعتبرت:/.test(r.plain), 'رغيف 70 جرام → 70 بالظبط من غير افتراض');
  r = await mk().handle('شوية مكسرات'); ok(row(r, 0).g === 15 && /شوية/.test(r.plain), 'شوية مكسرات = 15جم ومعلن');
  r = await mk().handle('حوالي 200 جرام فراخ مشوية'); ok(row(r, 0).g === 200, '«حوالي 200 جرام»');
  r = await mk().handle('احسبلي 200 جرام رز نيء'); ok(row(r, 0).k === 720, 'رز نيء ≠ رز مطبوخ (720 سعرة)', row(r, 0).k);
  r = await mk().handle('رز'); ok(r.card.rows.length === 1 && /طبق رز أبيض مطبوخ = 200/.test(r.plain), '«رز» لوحده: طبق 200جم معلن');
  r = await mk().handle('كام سعرة في بيضة مقلية'); ok(/78|90/.test(r.text) && /سعرة/.test(r.text), 'سؤال عن صنف بيجاوب من غير ما يضيفه للحساب', r.text);
  b = mk(); r = await b.handle('أنا أكلت إيه النهارده؟'); ok(/الفطار/.test(r.text) && /900/.test(r.text), 'أكلت إيه النهارده');
  r = await b.handle('فاضلي كام سعرة من هدفي؟'); ok(/2100/.test(r.text), 'فاضلي كام سعرة (3000-900)');
  b = mk(); r = await b.handle('ازيك'); ok(r.text.length > 0 && !r.card, 'تحية');
  r = await b.handle('asdf qwer'); ok(/مفهمتش|مش لاقي/.test(r.text), 'كلام مش مفهوم مش بيعمل كارثة');

  console.log('\n==== النتيجة: ' + pass + ' نجح، ' + fail + ' فشل ====');
  if (fail) { console.log('الفاشلة:\n - ' + fails.join('\n - ')); process.exit(1); }
})();
