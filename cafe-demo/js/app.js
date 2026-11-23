/* QR Menu engine v2 — SFDA-aware, bilingual (AR/EN), WhatsApp order cart. Data: data/menu.json */
(() => {
  "use strict";
  const DATA_URL = "data/menu.json";
  const packed = window.MENU_IMAGES || {};

  // الـ14 مسبب حساسية — المصدر الرسمي: لائحة الهيئة العامة للغذاء والدواء (إفصاح عن مسببات الحساسية، البند 8.4)
  // The 14 allergens — official source: SFDA technical regulation (allergen disclosure, clause 8.4)
  const ALLERGENS = {
    gluten:   { ar: "الحبوب المحتوية على الغلوتين", en: "Cereals containing gluten" },
    crustaceans: { ar: "القشريات", en: "Crustaceans" },
    eggs:     { ar: "البيض", en: "Eggs" },
    fish:     { ar: "الأسماك", en: "Fish" },
    peanuts:  { ar: "الفول السوداني", en: "Peanuts" },
    treenuts: { ar: "المكسرات", en: "Tree nuts" },
    milk:     { ar: "الحليب (اللاكتوز)", en: "Milk (lactose)" },
    sulphites:{ ar: "الكبريتيت (١٠ جزء في المليون فأكثر)", en: "Sulphites (≥10 ppm)" },
    celery:   { ar: "الكرفس", en: "Celery" },
    mustard:  { ar: "الخردل", en: "Mustard" },
    sesame:   { ar: "السمسم", en: "Sesame" },
    molluscs: { ar: "الرخويات", en: "Molluscs" },
    lupin:    { ar: "الترمس", en: "Lupin" },
    soy:      { ar: "فول الصويا", en: "Soybeans" }
  };
  const SHORT = { // short names on the item line
    gluten: ["الغلوتين", "Gluten"], crustaceans: ["القشريات", "Crustaceans"], eggs: ["البيض", "Eggs"],
    fish: ["الأسماك", "Fish"], peanuts: ["الفول السوداني", "Peanuts"], treenuts: ["المكسرات", "Tree nuts"],
    milk: ["الحليب", "Milk"], sulphites: ["الكبريتيت", "Sulphites"], celery: ["الكرفس", "Celery"],
    mustard: ["الخردل", "Mustard"], sesame: ["السمسم", "Sesame"], molluscs: ["الرخويات", "Molluscs"],
    lupin: ["الترمس", "Lupin"], soy: ["الصويا", "Soy"]
  };
  // العبارتان النظاميتان الثابتتان — دليل الهيئة للسعرات الحرارية (البندان 7 و8)
  const STATEMENTS = {
    ar: ["يحتاج البالغون إلى 2000 سعر حراري في المتوسط يوميًا، وقد تختلف الاحتياجات الفردية من الشخص لآخر.", "البيانات التغذوية الإضافية متاحة عند الطلب."],
    en: ["Adults need an average of 2000 calories per day; individual calorie needs may vary.", "Additional nutritional information is available upon request."]
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (Math.round(n * 100) / 100).toString();

  const state = { data: null, lang: "ar", cart: {}, mode: "dine_in", table: "", name: "", notes: "", sheet: false };
  const L = (o, k) => (state.lang === "en" ? (o[k + "_en"] ?? o[k + "_ar"]) : (o[k + "_ar"] ?? o[k + "_en"])) ?? "";
  const T = (ar, en) => (state.lang === "en" ? en : ar);
  const cur = () => T(state.data.ui?.currency_ar || "ر.س", state.data.ui?.currency_en || "SAR");

  const allItems = () => state.data.categories.flatMap((c) => c.items);
  const itemById = (id) => allItems().find((i) => i.id === id);
  const cartLines = () => Object.entries(state.cart).filter(([, q]) => q > 0).map(([id, q]) => ({ item: itemById(id), qty: q })).filter((l) => l.item);
  const cartCount = () => cartLines().reduce((a, l) => a + l.qty, 0);
  const cartTotal = () => cartLines().reduce((a, l) => a + l.qty * l.item.price, 0);
  const vatPortion = (total) => (total * (state.data.vat_percent ?? 15)) / (100 + (state.data.vat_percent ?? 15));

  const img = (src, cls = "", alt = "") => `<img class="${cls}" src="${esc(packed[src] || src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

  const itemHtml = (it) => {
    const contains = (it.allergens || []).map((k) => SHORT[k][state.lang === "en" ? 1 : 0]);
    const may = (it.may || []).map((k) => SHORT[k][state.lang === "en" ? 1 : 0]);
    const sep = state.lang === "en" ? ", " : "، ";
    const allergenLine = `
      <p class="allergen"><b>${T("الحساسية:", "Allergens:")}</b>
        ${contains.length ? `<span class="al-yes">${T("يحتوي على ", "Contains ")}${esc(contains.join(sep))}</span>` : `<span class="al-none">${T("لا يحتوي على أي من مسببات الحساسية الـ14", "Contains none of the 14 allergens")}</span>`}
        ${may.length ? `<span class="al-may"> · ${T("قد يحتوي على ", "May contain ")}${esc(may.join(sep))}</span>` : ""}
      </p>`;
    const chips = [];
    if (it.caffeine_mg != null) chips.push(`<span class="chip chip-caf">${T("الكافيين", "Caffeine")}: ${it.caffeine_mg} ${T("ملغ", "mg")}</span>`);
    if (it.high_salt) chips.push(`<span class="chip chip-salt" title="${T("وسم الملّاحة: محتوى عالٍ من الملح", "Salt shaker label: high in salt")}">🧂 ${T("الملّاحة — ملح عالٍ", "High salt")}</span>`);
    if (it.activity_min) chips.push(`<span class="chip chip-act">${T("لحرق السعرات: ", "To burn it off: ")}≈ ${it.activity_min} ${T("دقيقة مشي", "min walking")}</span>`);
    const q = state.cart[it.id] || 0;
    const ctrl = q > 0
      ? `<div class="stepper" role="group" aria-label="${T("الكمية", "Quantity")}"><button type="button" data-dec="${esc(it.id)}" aria-label="${T("إنقاص", "Decrease")}">−</button><span>${q}</span><button type="button" data-inc="${esc(it.id)}" aria-label="${T("زيادة", "Increase")}">+</button></div>`
      : `<button type="button" class="add" data-inc="${esc(it.id)}">${T("أضف", "Add")}</button>`;
    return `
      <article class="item ${it.image ? "" : "no-img"}" id="item-${esc(it.id)}">
        ${it.image ? img(it.image, "thumb", L(it, "name")) : ""}
        <div class="body">
          <h3>${esc(L(it, "name"))}</h3>
          <p class="desc">${esc(L(it, "desc"))}</p>
          ${allergenLine}
          ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
        </div>
        <div class="side">
          <div class="pk"><div class="price">${num(it.price)} <small>${cur()}</small></div>
          <div class="kcal">${it.kcal} ${T("سعرة حرارية", "kcal")}</div></div>
          ${state.data.order?.enabled === false ? "" : ctrl}
        </div>
      </article>`;
  };

  const isOpenNow = (h) => {
    try {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: h.timezone || "Asia/Riyadh" }));
      const m = now.getHours() * 60 + now.getMinutes();
      const p = (s) => { const [a, b] = s.split(":").map(Number); return a * 60 + (b || 0); };
      const r = (h.weekly || []).find((x) => x.days.includes(now.getDay()));
      return !!r && m >= p(r.open) && m < p(r.close);
    } catch (e) { return false; }
  };

  const orderMessage = () => {
    const d = state.data, lines = cartLines(), total = cartTotal();
    const modes = { dine_in: T("داخل المحل", "Dine-in"), pickup: T("استلام من المحل", "Pickup") };
    const out = [];
    out.push(T(`طلب جديد — ${d.brand.name_ar}`, `New order — ${d.brand.name_en}`));
    if (d.demo) out.push(T("(طلب تجريبي من نموذج — ليس طلبًا حقيقيًا)", "(Test order from a demo — not a real order)"));
    out.push(`${T("نوع الطلب", "Order type")}: ${modes[state.mode]}${state.mode === "dine_in" && state.table ? ` — ${T("طاولة", "Table")} ${state.table}` : ""}`);
    if (state.name) out.push(`${T("الاسم", "Name")}: ${state.name}`);
    out.push("────────────");
    lines.forEach((l) => out.push(`${l.qty} × ${L(l.item, "name")} — ${num(l.qty * l.item.price)} ${cur()}`));
    out.push("────────────");
    out.push(`${T("الإجمالي (شامل ضريبة القيمة المضافة)", "Total (VAT included)")}: ${num(total)} ${cur()}`);
    out.push(`${T("منها ضريبة القيمة المضافة", "of which VAT")} ${state.data.vat_percent ?? 15}%: ${num(Math.round(vatPortion(total) * 100) / 100)} ${cur()}`);
    if (state.notes) out.push(`${T("ملاحظات", "Notes")}: ${state.notes}`);
    return out.join("\n");
  };
  window.__orderMessage = orderMessage; // للاختبار / for tests

  const sheetHtml = () => {
    const lines = cartLines(), total = cartTotal(), wa = state.data.whatsapp || {};
    const rows = lines.map((l) => `
      <div class="line"><div class="ln"><b>${esc(L(l.item, "name"))}</b><small>${num(l.item.price)} ${cur()}</small></div>
      <div class="stepper"><button type="button" data-dec="${esc(l.item.id)}" aria-label="−">−</button><span>${l.qty}</span><button type="button" data-inc="${esc(l.item.id)}" aria-label="+">+</button></div>
      <div class="lt">${num(l.qty * l.item.price)}</div></div>`).join("");
    return `
    <div class="sheet-bd" data-close-sheet></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${T("طلبك", "Your order")}">
      <div class="grab"></div>
      <div class="sheet-head"><h2>${T("طلبك", "Your order")}</h2><button type="button" class="x" data-close-sheet aria-label="${T("إغلاق", "Close")}">✕</button></div>
      <div class="lines">${rows || `<p class="empty">${T("السلة فارغة", "Your cart is empty")}</p>`}</div>
      <div class="form">
        <div class="seg" role="radiogroup">
          <button type="button" class="${state.mode === "dine_in" ? "on" : ""}" data-mode="dine_in">${T("داخل المحل", "Dine-in")}</button>
          <button type="button" class="${state.mode === "pickup" ? "on" : ""}" data-mode="pickup">${T("استلام", "Pickup")}</button>
        </div>
        ${state.mode === "dine_in" ? `<input id="f-table" inputmode="numeric" placeholder="${T("رقم الطاولة", "Table number")}" value="${esc(state.table)}">` : ""}
        <input id="f-name" placeholder="${T("الاسم (اختياري)", "Name (optional)")}" value="${esc(state.name)}">
        <textarea id="f-notes" rows="2" placeholder="${T("ملاحظات (مثلاً: بدون بصل، أو أخبرنا بحساسيتك)", "Notes (e.g. no onions, or tell us about your allergy)")}">${esc(state.notes)}</textarea>
      </div>
      <div class="totals">
        <div><span>${T("الإجمالي (شامل الضريبة)", "Total (VAT included)")}</span><b>${num(total)} ${cur()}</b></div>
        <small>${T(`منها ضريبة القيمة المضافة ${state.data.vat_percent ?? 15}%: `, `Of which VAT ${state.data.vat_percent ?? 15}%: `)}${num(Math.round(vatPortion(total) * 100) / 100)} ${cur()}</small>
      </div>
      <button type="button" class="send" id="send" ${lines.length ? "" : "disabled"}>${T("إرسال الطلب عبر واتساب", "Send order via WhatsApp")}</button>
      ${wa.number ? "" : `<p class="demo-hint">${T("نموذج: لا يوجد رقم واتساب لمحل حقيقي، سيُعرض لك شكل الرسالة قبل الفتح.", "Demo: no real shop number is set; you'll see the message preview first.")}</p>`}
    </section>`;
  };

  const render = () => {
    const d = state.data, ui = d.ui || {}, cats = d.categories, wa = d.whatsapp || {}, h = d.hours || {}, loc = d.location || {};
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "en" ? "ltr" : "rtl";
    document.title = L(d.meta, "title");
    const y = window.scrollY;
    const open = h.weekly ? isOpenNow(h) : null;
    const count = cartCount();
    const orderOn = d.order?.enabled !== false;
    $("#app").innerHTML = `
    ${d.demo ? `<div class="demo-banner">${esc(L(d.banner, "text"))}</div>` : ""}
    <header class="hero">
      ${d.hero?.image ? img(d.hero.image, "hero-img", "") : ""}
      <div class="hero-shade"></div>
      <button type="button" class="lang" id="lang">${state.lang === "en" ? "العربية" : "English"}</button>
      <div class="hero-in">
        <p class="kicker">${esc(L(d.hero, "kicker"))}</p>
        <h1>${esc(L(d.brand, "name"))}</h1>
        <p class="lead">${esc(L(d.hero, "lead"))}</p>
        ${open === null ? "" : `<span class="open ${open ? "yes" : "no"}">${open ? T("مفتوح الآن", "Open now") : T("مغلق الآن", "Closed now")}</span>`}
      </div>
    </header>
    <nav class="cats" aria-label="${T("أقسام المنيو", "Menu sections")}">${cats.map((c, i) => `<a href="#${esc(c.id)}" class="${i === 0 ? "on" : ""}">${esc(L(c, "name"))}</a>`).join("")}</nav>
    <main>
      <aside class="notice" aria-label="${T("معلومات نظامية", "Regulatory information")}">
        <p><b>${T("الأسعار شاملة ضريبة القيمة المضافة", "Prices include VAT")} ${d.vat_percent ?? 15}%.</b></p>
        <p>${esc(STATEMENTS[state.lang][0])}</p>
        <p>${esc(STATEMENTS[state.lang][1])}</p>
        ${state.lang === "en" ? `<p class="ar-note" dir="rtl">${STATEMENTS.ar[0]}<br>${STATEMENTS.ar[1]}</p>` : ""}
        <p class="small">${T("السعرات حسب الصنف الكامل ما لم يُذكر خلاف ذلك. الكافيين بالملغ لكل مشروب. الحد المرجعي: ٤٠٠ ملغ يوميًا للبالغين و٢٠٠ ملغ للحامل.", "Calories are per full item unless noted. Caffeine is mg per drink. Reference limit: 400 mg/day for adults, 200 mg/day for pregnant women.")}</p>
      </aside>
      ${cats.map((c) => `<section class="sec" id="${esc(c.id)}"><h2>${esc(L(c, "name"))}</h2>${c.items.map(itemHtml).join("")}</section>`).join("")}
      <section class="sec legend"><h2>${T("دليل مسببات الحساسية الـ14", "The 14 allergens")}</h2>
        <p>${T("يُفصح عنها بصيغة «يحتوي على» أو «قد يحتوي على» (احتمال التلوث الخلطي).", "Shown as “Contains” or “May contain” (cross-contamination risk).")}</p>
        <ul>${Object.values(ALLERGENS).map((a) => `<li>${esc(state.lang === "en" ? a.en : a.ar)}</li>`).join("")}</ul>
        <p class="small">${T("المصدر: اللائحة الفنية للهيئة العامة للغذاء والدواء — الإفصاح عن مسببات الحساسية في قائمة وجبات المنشآت الغذائية (البند 8.4).", "Source: SFDA technical regulation — allergen disclosure on food-establishment menus (clause 8.4).")}</p>
      </section>
      <section class="sec info">
        <h2>${esc(L(h, "label") || T("أوقات العمل", "Opening hours"))}</h2>
        ${(h.lines || []).map((l) => `<p>${esc(L(l, "t"))}</p>`).join("")}
        <h2>${T("الموقع", "Location")}</h2>
        <p>${esc(L(loc, "address"))}</p>
        ${loc.maps_url ? `<p><a class="link" href="${esc(loc.maps_url)}" target="_blank" rel="noopener">${esc(L(loc, "link"))}</a></p>` : ""}
      </section>
    </main>
    <footer class="foot">
      <p>${esc(L(d.footer, "l1"))}</p>
      <p class="small">${esc(L(d.footer, "l2"))}</p>
      <p class="small">${esc(L(d.footer, "l3"))}</p>
    </footer>
    ${orderOn && count ? `<button type="button" class="cartbar" id="open-cart"><span class="cnt">${count}</span><span>${T("عرض الطلب", "View order")}</span><b>${num(cartTotal())} ${cur()}</b></button>` : ""}
    <div id="sheet-root">${state.sheet ? sheetHtml() : ""}</div>
    <div id="modal-root"></div>`;
    window.scrollTo(0, y);
    bind();
  };

  const showPreview = () => {
    const wa = state.data.whatsapp || {};
    const msg = orderMessage();
    const number = String(wa.number || "").replace(/\D/g, "");
    const href = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
    if (number && !state.data.demo) { window.open(href, "_blank", "noopener"); return; }
    $("#modal-root").innerHTML = `
      <div class="modal-bd" data-close-modal></div>
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${T("معاينة رسالة الطلب (نموذج)", "Order message preview (demo)")}</h3>
        <pre id="msg-pre">${esc(msg)}</pre>
        <p class="small">${T("هكذا تصل رسالة الطلب لواتساب المحل مرتبة وجاهزة. في المنيو الحقيقي يُفتح مباشرة محادثة المحل.", "This is how the order reaches the shop's WhatsApp, neatly formatted. On a real menu it opens the shop's chat directly.")}</p>
        <div class="modal-actions">
          <a class="send" id="wa-link" href="${href}" target="_blank" rel="noopener">${T("فتح واتساب", "Open WhatsApp")}</a>
          <button type="button" class="ghost" data-close-modal>${T("إغلاق", "Close")}</button>
        </div>
      </div>`;
    $$("[data-close-modal]").forEach((b) => b.addEventListener("click", () => ($("#modal-root").innerHTML = "")));
  };

  const readForm = () => {
    const t = $("#f-table"), n = $("#f-name"), no = $("#f-notes");
    if (t) state.table = t.value.trim();
    if (n) state.name = n.value.trim();
    if (no) state.notes = no.value.trim();
  };

  const bind = () => {
    $("#lang").addEventListener("click", () => { readForm(); state.lang = state.lang === "en" ? "ar" : "en"; render(); });
    $$("[data-inc]").forEach((b) => b.addEventListener("click", () => { readForm(); const id = b.dataset.inc; state.cart[id] = (state.cart[id] || 0) + 1; render(); }));
    $$("[data-dec]").forEach((b) => b.addEventListener("click", () => { readForm(); const id = b.dataset.dec; state.cart[id] = Math.max(0, (state.cart[id] || 0) - 1); if (!cartCount()) state.sheet = false; render(); }));
    const oc = $("#open-cart"); if (oc) oc.addEventListener("click", () => { state.sheet = true; render(); });
    $$("[data-close-sheet]").forEach((b) => b.addEventListener("click", () => { readForm(); state.sheet = false; render(); }));
    $$("[data-mode]").forEach((b) => b.addEventListener("click", () => { readForm(); state.mode = b.dataset.mode; render(); }));
    const s = $("#send"); if (s) s.addEventListener("click", () => { readForm(); showPreview(); });
    // scroll spy
    const links = $$(".cats a");
    const secs = state.data.categories.map((c) => document.getElementById(c.id));
    const spy = () => { let idx = 0; secs.forEach((el, i) => { if (el && el.getBoundingClientRect().top < 140) idx = i; }); links.forEach((a, i) => a.classList.toggle("on", i === idx)); };
    window.removeEventListener("scroll", window.__spy || (() => {})); window.__spy = spy; window.addEventListener("scroll", spy, { passive: true });
  };

  const boot = async () => {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("menu.json " + res.status);
      state.data = await res.json();
      state.lang = new URLSearchParams(location.search).get("lang") === "en" ? "en" : (state.data.locale_default || "ar");
      const r = document.documentElement.style;
      Object.entries(state.data.theme || {}).forEach(([k, v]) => r.setProperty("--" + k.replace(/_/g, "-"), v));
      render();
    } catch (e) {
      $("#app").innerHTML = `<div class="demo-banner">تعذّر تحميل data/menu.json — افتح الصفحة عبر خادم وليس كملف مباشر.</div>`;
      console.error(e);
    }
  };
  boot();
})();
