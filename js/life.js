/* Everyday life in Baltimore: the "doors" beyond weather and heat.
   Money help (benefits checker), Health, Family and kids, Seniors, Jobs and learning, Community, and the All services hub.
   Also adds "Your street" to My block (live 311 requests, streetlights out, vacant buildings, residential parking)
   and a neighbor buddy list for checking on people in extreme heat and cold.
   Data: pipeline/life.py (HRSA, OpenStreetMap, Baltimore DHCD, City Schools, Legistar, 311) rebuilt daily;
   311, vacant notices and parking zones are asked live from the city's map servers.
   Program rules were checked against official pages in November 2026 (listed on Sources). */
const LIFE = (() => {
  const tile = (ic, c, s = 22) => `<span class="tile" style="--tc:${c}">${I(ic, s)}</span>`;
  const dirBtn = (lat, lon, name) => `<a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(name)}" title="Directions">${I("nav", 18)}</a>`;
  const callBtn = (ph, who) => ph ? `<a class="round call" href="tel:${ph.replace(/[^\d+]/g, "")}" aria-label="Call ${U.esc(who)}" title="Call ${U.esc(ph)}">${I("phone", 20)}</a>` : "";
  const ext = (u, t) => `<a href="${U.esc(u)}" target="_blank" rel="noopener">${t}</a>`;
  const tel = (n, show) => `<a href="tel:${n.replace(/[^\d+]/g, "")}">${show || n}</a>`;
  const life = () => MORE.file("life.json");
  const svc = () => MORE.file("services.json");
  const here = () => { const l = U.store.get("loc", null); return l ? [l.lat, l.lon, l.label] : [LIVE.CENTER[0], LIVE.CENTER[1], null]; };
  const near = (list, lat, lon) => (list || []).filter(x => x.lat != null).map(x => ({ ...x, d: U.km([lon, lat], [x.lon, x.lat]) })).sort((a, b) => a.d - b.d);
  const S = (id, h, sub, link) => `<div class="section-h" id="${id}"><div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div>${link || ""}</div>`;
  // one program or service: icon, title, words, small links, call button
  const prog = (ic, col, t, d, links, ph) => `<div class="place">${tile(ic, col)}<div><b>${t}</b><small>${d}</small>${links ? `<small>${links}</small>` : ""}</div>${ph ? `<div class="go">${callBtn(ph[0], ph[1] || t)}</div>` : ""}</div>`;
  const placeRow = (x, ic, col, sub, extra) => `<div class="place">${tile(ic, col)}<div><b>${U.esc(x.name)}</b><small>${U.esc(x.address || "")}${sub ? " · " + sub : ""}</small>${extra || ""}</div><div class="go"><span class="tnum">${U.dist(x.d)}</span>${x.phone ? callBtn(x.phone, x.name) : ""}${dirBtn(x.lat, x.lon, x.name)}</div></div>`;
  const whereNote = () => { const [, , label] = here(); return label ? `Closest to ${U.esc(label.split(",")[0])} first.` : `Closest to downtown first. <a href="#place">Add your address</a> to sort by your home.`; };
  const more = (rows, n, what) => rows.slice(0, n).join("") + (rows.length > n ? `<div class="more-rows" hidden>${rows.slice(n).join("")}</div><button class="btn small alt showmore" data-showmore>Show ${rows.length - n} more ${what}</button>` : "");
  function wire(root) {
    U.$$("[data-showmore]", root).forEach(b => b.onclick = () => { b.previousElementSibling.hidden = false; b.remove(); });
    CINEMA.loadImgs(root);
  }
  const checked = d => `<p class="note">Last checked ${d || "November 2026"}. Rules change: the program has the final word.</p>`;

  // =====================================================================================================
  // MONEY HELP: benefits checker
  // 2026 federal poverty guidelines; Maryland SNAP from Oct 1, 2026 (200% gross, broad-based categorical eligibility);
  // Maryland energy assistance (OHEP) FY27 at 200%; WIC July 2026-June 2027 at 185%; Medicaid adults 138%, children 322%, pregnancy 264%.
  const FPL = n => 15960 + 5680 * (n - 1);
  const T200 = [2660, 3607, 4553, 5500, 6447, 7393, 8340, 9287], T185 = [2461, 3337, 4212, 5088, 5964, 6839, 7715, 8591];
  const LIGHT = [74800, 85450, 96150, 106800, 115350, 123900, 132450, 141000];
  const tab = (t, n, step) => n <= 8 ? t[n - 1] : t[7] + step * (n - 8);
  const DEF = { n: 1, inc: "", s60: false, kid5: false, kids: false, home: "rent", water: true, work: false };
  function checker() {
    const v = { ...DEF, ...U.store.get("checker", {}) };
    return `<div class="card checker" id="ckCard">
      <div class="ck-grid">
        <label class="ck-f"><span>People living in your home</span><select id="ckN">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${v.n == i + 1 ? " selected" : ""}>${i + 1}</option>`).join("")}</select></label>
        <label class="ck-f"><span>Money coming in each month, before taxes</span><span class="ck-money"><b>$</b><input id="ckInc" type="number" inputmode="numeric" min="0" step="50" placeholder="for example 2400" value="${U.esc(v.inc)}"></span></label>
      </div>
      <p class="note" style="margin:4px 0 10px">Add up pay, Social Security, disability, child support and other money for everyone at home.</p>
      <fieldset class="ck-box"><legend>Check any that fit</legend>
        <label class="chk"><input type="checkbox" id="ckS60"${v.s60 ? " checked" : ""}> Someone is 60 or older, or has a disability</label>
        <label class="chk"><input type="checkbox" id="ckKid5"${v.kid5 ? " checked" : ""}> A child under 5, or someone pregnant</label>
        <label class="chk"><input type="checkbox" id="ckKids"${v.kids ? " checked" : ""}> Children under 18 live here</label>
        <label class="chk"><input type="checkbox" id="ckWork"${v.work ? " checked" : ""}> Working, in school or in job training</label>
        <label class="chk"><input type="checkbox" id="ckWater"${v.water ? " checked" : ""}> We pay a water bill</label>
      </fieldset>
      <div class="seg ck-home" role="group" aria-label="Your home"><button data-home="rent" aria-pressed="${v.home === "rent"}">We rent</button><button data-home="own" aria-pressed="${v.home === "own"}">We own</button><button data-home="none" aria-pressed="${v.home === "none"}">Neither</button></div>
      <p class="note">Your answers stay on this phone. Nothing is sent anywhere.</p>
    </div><div id="ckOut" aria-live="polite"></div>`;
  }
  function results(v) {
    const n = +v.n || 1, M = v.inc === "" ? null : Math.max(0, +v.inc), A = M == null ? null : M * 12, pct = A == null ? null : A / FPL(n) * 100;
    const out = [];
    const add = (fit, ic, col, t, d, links, ph) => out.push({ fit, html: prog(ic, col, t, d, links, ph) });
    const lim = x => "$" + Math.round(x).toLocaleString();
    const fit = (ok, maybe) => M == null ? "check" : ok ? "yes" : maybe ? "maybe" : "no";
    add(fit(M <= tab(T200, n, 947), v.s60), "basket", "#b8382b", "Food: SNAP (food stamps)",
      `Money for groceries each month on an EBT card. For ${n} ${n > 1 ? "people" : "person"}, the limit is about ${lim(tab(T200, n, 947))} a month before taxes.${v.s60 ? " Homes with someone 60+ or disabled can qualify above this limit." : ""}`,
      `${ext("https://mymdthink.maryland.gov", "Apply online (myMDTHINK)")} · 211 can help you apply`, ["211", "211 Maryland"]);
    add(fit(M <= tab(T200, n, 947)), "bolt", "var(--accent)", "Gas and electric bills: energy assistance (OHEP)",
      `Help paying BGE bills and past-due balances, once a year. For ${n} ${n > 1 ? "people" : "person"}, the limit is about ${lim(tab(T200, n, 947))} a month.`,
      `${ext("https://dhs.maryland.gov/office-of-home-energy-programs/", "Energy assistance")} · Community Action Partnership 410-396-5555`, ["4103965555", "Community Action Partnership"]);
    add(v.water ? fit(pct <= 200) : M == null ? "check" : "maybe", "droplet", "var(--link)", "Water bill: Water4All",
      `Lowers Baltimore water and sewer bills for homes under 200% of the poverty line (about ${lim(FPL(n) * 2 / 12)} a month for ${n}). Homeowners and tenants on the bill can apply, or tenants whose lease says they pay water. Lasts one year. A Social Security number is not required.`,
      `${ext("https://cityservices.baltimorecity.gov/water4all/Initial-Eligibility-Check", "Apply online")} · In person: 3939 Reisterstown Rd · Questions 410-396-5555`, ["4103965555", "Water4All"]);
    add(v.kid5 ? fit(M <= tab(T185, n, 876)) : "no", "heart", "#c2417a", "Babies and young children: WIC",
      `Healthy food, formula and nutrition help for pregnant people, new mothers and children under 5. Limit about ${lim(tab(T185, n, 876))} a month for ${n}. Families on SNAP or Medicaid meet the income rule automatically.`,
      ext("https://health.maryland.gov/phpa/wic/pages/wic-apply.aspx", "Maryland WIC") + " · 211 can find your nearest WIC office", ["211", "211 Maryland"]);
    const med = M == null ? "check" : pct <= 138 ? "yes" : (v.kids && pct <= 322) || (v.kid5 && pct <= 264) ? "yes" : "no";
    add(med, "hospital", "var(--s4)", "Health insurance: Medicaid and MCHP",
      `Free or low-cost health coverage. Adults up to 138% of the poverty line (about ${lim(FPL(n) * 1.38 / 12)} a month for ${n}); children up to 322%; pregnant people up to 264%. New in 2026: some adults must report work or school, and renew every 6 months.`,
      `${ext("https://www.marylandhealthconnection.gov", "Maryland Health Connection")} · 1-855-642-8572`, ["18556428572", "Maryland Health Connection"]);
    add(v.home === "rent" && (v.s60 || v.kids) ? (M == null ? "check" : pct <= 200 ? "maybe" : "no") : "no", "home", "#6b4c9a", "Renters' Tax Credit: up to $1,000 back",
      "A yearly check for renters with low income who are 60 or older, 100% disabled, or under 60 with a child under 18 and no housing subsidy. Apply by October 1.",
      `${ext("https://dat.maryland.gov/renters", "Renters' Tax Credit")} · 410-767-5915`, ["4107675915", "the Renters' Tax Credit office"]);
    add(fit(A <= 69000), "doc", "var(--s0)", "Free tax filing",
      "Free help filing your taxes from IRS-certified volunteers (VITA and the CASH Campaign of Maryland) for incomes up to $69,000. You may get the Earned Income Tax Credit and Child Tax Credit back.",
      "Call 211 for an appointment · " + ext("https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers", "IRS free tax help"), ["211", "211 Maryland"]);
    add(v.kids && v.work ? (M == null ? "check" : "maybe") : "no", "users", "#1d6fb8", "Child care: Child Care Scholarship",
      "Help paying for child care if you work or go to school or training. Apply online with two documents; a decision comes in about 3 business days, and you can get up to 60 days of help while you wait.",
      ext("https://money4childcare.com", "Apply at money4childcare.com"));
    add(v.home === "own" ? fit(A <= tab(LIGHT, n, 8550)) : "no", "home", "var(--s3)", "Homeowners: free or low-cost home repairs (LIGHT)",
      `Loans, some forgiven, and grants for roofs, heating, plumbing, electric, lead hazards and accessibility, for owner-occupied homes. Income limit for ${n}: ${lim(tab(LIGHT, n, 8550))} a year.`,
      `${ext("https://www.baltimorecity.gov/dhcd/housing-rehabilitation-and-repairs", "Home repair help")} · 410-396-3023`, ["4103963023", "home repair intake"]);
    const yes = out.filter(o => o.fit === "yes"), maybe = out.filter(o => o.fit === "maybe" || o.fit === "check"), no = out.filter(o => o.fit === "no");
    const head = M == null ? `<div class="ck-sum">${tile("info", "var(--link)")}<div><b>Add your monthly income to see what you likely qualify for</b><span>Or read every program below.</span></div></div>`
      : `<div class="ck-sum good">${tile("check", "var(--s0)")}<div><b>${yes.length ? `You likely qualify for ${yes.length} program${yes.length > 1 ? "s" : ""}` : "These programs may not fit, but 211 can find others"}</b><span>Based on ${n} ${n > 1 ? "people" : "person"} and $${Math.round(M).toLocaleString()} a month, about ${Math.round(pct)}% of the federal poverty line. This is a guide, not a decision: apply to find out for sure.</span></div></div>`;
    return head + (yes.length ? `<h3 class="ck-h">Likely yes</h3><div class="place-list">${yes.map(o => o.html).join("")}</div>` : "") +
      (maybe.length ? `<h3 class="ck-h">${M == null ? "Programs" : "Worth checking"}</h3><div class="place-list">${maybe.map(o => o.html).join("")}</div>` : "") +
      (no.length ? `<details class="more"><summary>${tile("info", "var(--ink-3)", 20).replace('class="tile"', 'class="tile sm"')}<span>Programs that may not fit your answers (${no.length})</span>${I("chev", 20)}</summary><div class="inner place-list">${no.map(o => o.html).join("")}</div></details>` : "") + checked();
  }
  function wireChecker() {
    const get = () => ({ n: U.$("#ckN").value, inc: U.$("#ckInc").value, s60: U.$("#ckS60").checked, kid5: U.$("#ckKid5").checked, kids: U.$("#ckKids").checked, work: U.$("#ckWork").checked, water: U.$("#ckWater").checked,
      home: U.$(".ck-home [aria-pressed=true]")?.dataset.home || "rent" });
    const run = () => { const v = get(); U.store.set("checker", v); U.$("#ckOut").innerHTML = results(v); };
    U.$$("#ckCard select, #ckCard input").forEach(e => e.addEventListener(e.type === "number" ? "input" : "change", U.debounce ? U.debounce(run, 250) : run));
    U.$$(".ck-home button").forEach(b => b.onclick = () => { U.$$(".ck-home button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); run(); });
    run();
  }
  function moneyShow() {
    const el = U.$("#moneyBody"); if (el.dataset.built) return; el.dataset.built = 1;
    el.innerHTML = S("sec-check", "What can I get?", "Answer a few questions to see which programs you likely qualify for. About 1 minute.") + checker() +
      S("sec-bills", "Help with bills right now", "Behind on a bill or about to be shut off? Call before the shut-off date.") + `<div class="place-list">
        ${prog("bolt", "var(--accent)", "BGE shut-off notice", "Call BGE and ask for a payment plan, then apply for energy assistance: a pending application can stop a shut-off. In winter there are extra protections before heat can be turned off.", `BGE 1-800-685-0123 · ${ext("https://dhs.maryland.gov/office-of-home-energy-programs/", "Energy assistance")}`, ["18006850123", "BGE"])}
        ${prog("droplet", "var(--link)", "Water bill too high", "Apply for Water4All to lower future bills, and ask about a payment plan for what you owe.", `${ext("https://cityservices.baltimorecity.gov/water4all/Initial-Eligibility-Check", "Water4All")} · 410-396-5555`, ["4103965555", "Water4All"])}
        ${prog("wallet", "#6b4c9a", "Behind on rent", "Rent help programs open and close during the year; 211 knows which are taking applications now. Facing eviction? You may get a free lawyer.", `${ext("https://211md.org", "211 Maryland")} · <a href="#help/sec-home">Eviction help</a>`, ["211", "211 Maryland"])}
        ${prog("hands", "var(--s0)", "Not sure where to start", "211 Maryland answers any time, in any language, and can check you for many programs at once.", ext("https://211md.org", "211md.org"), ["211", "211 Maryland"])}
      </div>` +
      S("sec-taxes", "Taxes and money back", "Free filing and credits many people miss.") + `<div class="place-list">
        ${prog("doc", "var(--s0)", "Free tax filing (VITA)", "Volunteers file your federal and Maryland taxes for free if your household made $69,000 or less. Bring ID, Social Security cards or ITINs, and your W-2s and 1099s.", "Call 211 for a site and appointment", ["211", "211 Maryland"])}
        ${prog("home", "#6b4c9a", "Renters' Tax Credit", "Up to $1,000 a year for renters with low income who are 60+, disabled, or have children under 18. Deadline October 1.", `${ext("https://dat.maryland.gov/renters", "How to apply")} · 410-767-5915`, ["4107675915", "the Renters' Tax Credit office"])}
        ${prog("home", "var(--s3)", "Homeowners' Tax Credit", "Maryland caps property taxes for homeowners with limited income, based on the home you live in.", ext("https://dat.maryland.gov", "Maryland Department of Assessments and Taxation"))}
      </div>${checked()}`;
    EASE.fold(el, ["sec-check", "sec-bills"]); wireChecker(); wire(el);
  }

  // =====================================================================================================
  // HEALTH
  const DAY2 = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  /** Is a place open now, from OpenStreetMap opening_hours like "Mo-Fr 08:00-21:00; Sa 09:00-18:00; Su off"? true / false / null */
  function osmOpen(h, now = new Date()) {
    if (!h) return null; if (/24\/7/.test(h)) return true;
    const d = now.getDay(), mins = now.getHours() * 60 + now.getMinutes(); let ans = null, matched = false;
    for (const rule of h.split(";").map(s => s.trim()).filter(Boolean)) {
      const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)\s+(.+)$/); if (!m) { if (/^PH/.test(rule)) continue; return null; }
      const days = new Set(); m[1].split(",").filter(Boolean).forEach(p => { const [a, b] = p.split("-").map(x => DAY2.indexOf(x)); if (b == null || b < 0) days.add(a); else for (let i = a; ; i = (i + 1) % 7) { days.add(i); if (i === b) break; } });
      if (!days.has(d)) continue; matched = true;
      if (/off|closed/i.test(m[2])) { ans = false; continue; }
      ans = m[2].split(",").some(r => { const t = r.match(/(\d\d):(\d\d)-(\d\d):(\d\d)/); if (!t) return false; const s = +t[1] * 60 + +t[2], e = (+t[3] * 60 + +t[4]) || 1440; return e > s ? mins >= s && mins < e : mins >= s || mins < e; });
    }
    return matched ? ans : /^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(h) ? false : null;
  }
  const openTag = o => o === true ? `<span class="openb on">${I("clock", 14)}Open now</span>` : o === false ? `<span class="openb off">${I("clock", 14)}Closed now</span>` : "";
  async function healthShow() {
    const el = U.$("#healthBody"); const [lat, lon] = here();
    el.innerHTML = S("sec-hnow", "Need care now?", "Free, any time.") + `<div class="callgrid">
        <div class="callrow urgent">${tile("alert", "var(--red)")}<div><b>Emergency</b><small>Chest pain, trouble breathing, serious injury, overdose</small><span class="numtxt tnum">911</span></div><a class="round call urgent" href="tel:911" aria-label="Call 911">${I("phone", 22)}</a></div>
        <div class="callrow">${tile("heart", "#6b4c9a")}<div><b>988 Suicide & Crisis Lifeline</b><small>Talk or text with someone now, about anything that feels like too much. 24/7, free.</small><span class="numtxt tnum">988</span></div><a class="round call" href="tel:988" aria-label="Call 988">${I("phone", 22)}</a></div>
        <div class="callrow">${tile("hands", "var(--s0)")}<div><b>No doctor or insurance?</b><small>Baltimore Health Care Access helps you find a doctor and sign up for coverage. English and Spanish.</small><span class="numtxt tnum">410-649-0500</span></div><a class="round call" href="tel:4106490500" aria-label="Call Health Care Access">${I("phone", 22)}</a></div>
      </div>` +
      S("sec-clinics", "Community health centers", "Doctors, dentists and mental health care on a sliding fee: you pay what you can, with or without insurance.") + `<div class="place-list" id="hcList"><div class="skeleton" style="height:70px"></div></div>` +
      S("sec-pharm", "Pharmacies", "Closest first, with posted hours. Call ahead to confirm.") + `<div class="place-list" id="phList"><div class="skeleton" style="height:70px"></div></div>` +
      S("sec-shots", "Free shots and checkups", "Flu, COVID and childhood vaccines.") + `<div class="place-list">
        ${prog("hospital", "var(--s4)", "City Health Department immunization clinic", "1200 E. Fayette St., 1st floor. Free vaccines for children with no insurance or Medicaid, and adults with no insurance or not enough coverage. Monday to Thursday by appointment; Friday walk-ins for adults. Nobody is turned away for not being able to pay.", "410-396-4454", ["4103964454", "the immunization clinic"])}
        ${prog("heart", "#c2417a", "Pharmacies give flu shots", "Most pharmacies give flu and COVID shots without an appointment, free with most insurance and Medicaid.", "")}
        ${prog("alert", "var(--s3)", "Lead test for young children", "Every child needs a blood lead test at 12 and 24 months. Ask your child's doctor.", `City lead program (443) 984-2470`, ["4439842470", "the lead program"])}
      </div>` +
      S("sec-safe", "Safe at home", "Free smoke alarms and air quality.") + `<div class="place-list">
        ${prog("flame", "var(--s4)", "Free smoke alarms, installed", "The Fire Department installs free long-life smoke alarms on every floor of your home. Call 311 and ask for a smoke alarm. Deaf or hard of hearing? Ask for a special alarm.", `Call 311 · Special alarms: Fire Marshal 410-396-5752 · ${ext("https://www.baltimorecity.gov/fire/request-a-smoke-alarm", "Fire Department")}`, ["311", "311"])}
        ${prog("wind", "var(--link)", "Air quality and pollen today", "Asthma? Check the air before you go out.", `<a href="#today/details">Today's air and heat</a> · ${ext("https://www.pollen.com/forecast/current/pollen/21202", "Pollen forecast")}`)}
        ${prog("hospital", "var(--accent)", "Health insurance", "Medicaid is free for adults up to about 138% of the poverty line, and children in families up to 322%. Check what you qualify for.", `<a href="#money">Benefits checker</a> · ${ext("https://www.marylandhealthconnection.gov", "Maryland Health Connection")} 1-855-642-8572`)}
      </div>${checked()}`;
    EASE.fold(el, ["sec-hnow", "sec-clinics"]);
    try {
      const L = await life();
      const hc = near(L.clinics, lat, lon).map(x => placeRow(x, "hospital", "var(--s4)", "", x.url ? `<small>${ext(x.url, "Website")}${x.hours_week ? ` · open about ${Math.round(x.hours_week)} hours a week` : ""}</small>` : ""));
      U.$("#hcList").innerHTML = hc.length ? `<p class="note" style="margin:0">${whereNote()}</p>` + more(hc, 5, "health centers") : `<p class="note">Couldn't load the health center list. Call 211 to find one.</p>`;
      const ph = near(L.pharmacies, lat, lon).map(x => ({ ...x, open: osmOpen(x.hours) }));
      U.$("#phList").innerHTML = ph.length ? more(ph.map(x => placeRow(x, "heart", "#c2417a", x.hours ? U.esc(x.hours.replace(/;/g, ", ")) : "", openTag(x.open))), 5, "pharmacies") + `<p class="note">Hours from OpenStreetMap. Holiday hours may differ.</p>`
        : `<p class="note">The pharmacy list is updating. ${ext("https://www.google.com/maps/search/pharmacy+open+now/@" + lat + "," + lon + ",14z", "Find a pharmacy open now")}.</p>`;
    } catch { U.$("#hcList").innerHTML = U.$("#phList").innerHTML = `<p class="note">Couldn't load this list right now. Call 211 for help.</p>`; }
    wire(el);
  }

  // =====================================================================================================
  // FAMILY AND KIDS
  async function familyShow() {
    const el = U.$("#familyBody"); const [lat, lon] = here(), sum = new Date().getMonth() >= 5 && new Date().getMonth() <= 7;
    el.innerHTML = S("sec-fkids", "Help for families", "Child care, food for kids and health coverage.") + `<div class="place-list">
        ${prog("users", "#1d6fb8", "Child Care Scholarship", "Help paying for child care while you work or go to school. Apply online with two documents; a decision comes in about 3 business days.", ext("https://money4childcare.com", "money4childcare.com"))}
        ${prog("book", "var(--s0)", "Head Start and Early Head Start", "Free preschool and family support for young children in families with low income. 211 can find the program closest to you.", "Call 211", ["211", "211 Maryland"])}
        ${prog("heart", "#c2417a", "WIC", "Healthy food and formula for pregnant people and children under 5.", `<a href="#money">See if you qualify</a> · ${ext("https://health.maryland.gov/phpa/wic/pages/wic-apply.aspx", "Maryland WIC")}`)}
        ${prog("hospital", "var(--s4)", "Free health insurance for kids (MCHP)", "Children in families with income up to 322% of the poverty line can get free or low-cost coverage.", ext("https://www.marylandhealthconnection.gov", "Maryland Health Connection") + " · 1-855-642-8572", ["18556428572", "Maryland Health Connection"])}
      </div>` +
      S("sec-schools", "Schools near you", "Baltimore City Public Schools buildings, closest first.", `<a href="https://www.baltimorecityschools.org" target="_blank" rel="noopener">City Schools</a>`) + `<div class="place-list" id="fSchools"><div class="skeleton" style="height:70px"></div></div>
      <div class="place-list" style="margin-top:10px">${prog("snow", "var(--link)", "Snow day or delay?", "City Schools posts closings and delays on its website and social media by early morning, and local TV and radio announce them.", ext("https://www.baltimorecityschools.org", "baltimorecityschools.org"))}</div>` +
      S("sec-meals", "Free meals for kids and teens", sum ? "Summer meal sites: free meals for anyone 18 and under, no sign-up." : "During the school year, City Schools serves free breakfast and lunch to students. Summer meal sites open in June.") + `<div class="place-list" id="fMeals"><div class="skeleton" style="height:70px"></div></div>` +
      S("sec-play", "Pools, rec centers and the library", "Free places for kids to play and learn.") + `<div class="place-list" id="fPlay"><div class="skeleton" style="height:70px"></div></div>${checked()}`;
    EASE.fold(el, ["sec-fkids", "sec-schools"]);
    try {
      const [L, rec, pools, S2] = await Promise.all([life(), MORE.file("rec_centers.geojson").catch(() => null), MORE.file("pools.geojson").catch(() => null), svc().catch(() => ({}))]);
      U.$("#fSchools").innerHTML = more(near(L.schools, lat, lon).map(x => placeRow({ ...x, address: (x.address || "").replace(/, Baltimore, MD \d+$/, "") }, "book", "#1d6fb8", x.grades ? "Grades " + U.esc(x.grades) : "")), 4, "schools");
      U.$("#fMeals").innerHTML = (sum ? more(near(L.meals, lat, lon).map(x => placeRow(x, "basket", "#b8382b", x.extra ? U.esc(x.extra) : "")), 4, "meal sites") : "") +
        prog("basket", "#b8382b", "Food for the whole family", "Free food sites and stores that take SNAP near you.", `<a href="#help/sec-food">Food help</a>`);
      const fpts = g => (g?.features || []).filter(f => f.geometry?.type === "Point").map(f => ({ ...f.properties, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
      const rc = near(fpts(rec), lat, lon).slice(0, 2), pl = near(fpts(pools), lat, lon).slice(0, sum ? 2 : 1), lib = near(S2.libraries, lat, lon).slice(0, 1);
      U.$("#fPlay").innerHTML = [...rc.map(x => placeRow(x, "ball", "var(--s0)", "Rec center")), ...lib.map(x => placeRow(x, "book", "var(--accent)", "Library: free books, homework help, Wi-Fi")), ...pl.map(x => placeRow(x, "pool", "var(--link)", U.esc(x.type || "Pool") + (sum ? "" : " (open in summer)")))].join("") +
        `<p class="note"><a href="#map">See every park, pool and playground on the map</a></p>`;
    } catch { U.$("#fSchools").innerHTML = `<p class="note">Couldn't load this list right now.</p>`; }
    wire(el);
  }

  // =====================================================================================================
  // SENIORS (and the buddy check)
  const buddies = () => U.store.get("buddies", []);
  function buddyKind() { return LIVE.cityAlert("blue") || LIVE.season() === "winter" ? "cold" : LIVE.cityAlert("red") || LIVE.season() === "summer" ? "heat" : "help"; }
  function buddyBox(el) {
    if (!el) return;
    const list = buddies(), body = MORE.neighborText(buddyKind()).replace(/^sms:\?/, "");
    const urgent = LIVE.cityAlert("blue") || LIVE.cityAlert("red");
    el.innerHTML = `<div class="card buddy">
      <div class="buddy-h">${tile("heart", "var(--s4)")}<div><b>${urgent ? (LIVE.cityAlert("blue") ? "Code Blue: check on your people tonight" : "Code Red: check on your people today") : "Neighbor buddy check"}</b><span>Save the older neighbors, friends and family you check on. In extreme heat or cold, one tap sends them a text with the help numbers. Saved on this phone only.</span></div></div>
      ${list.length ? `<div class="place-list">${list.map((b, i) => `<div class="place">${tile("users", "var(--link)", 20)}<div><b>${U.esc(b.name)}</b><small class="tnum">${U.esc(b.phone)}</small></div><div class="go"><a class="round" href="sms:${U.esc(b.phone.replace(/[^\d+]/g, ""))}?${body}" aria-label="Text ${U.esc(b.name)}" title="Text">${I("doc", 18)}</a>${callBtn(b.phone, b.name)}<button class="round" data-rm="${i}" aria-label="Remove ${U.esc(b.name)}" title="Remove">${I("x", 18)}</button></div></div>`).join("")}</div>` : ""}
      <form class="buddy-add" autocomplete="off"><input name="n" placeholder="Name" aria-label="Name" required maxlength="40"><input name="p" type="tel" inputmode="tel" placeholder="Phone number" aria-label="Phone number" required maxlength="20"><button class="btn small">Add</button></form>
      <p class="note" style="margin-bottom:0">No answer and you're worried? Call 911 for an emergency, or 311 to ask for a wellness check.</p></div>`;
    el.querySelector("form").onsubmit = e => { e.preventDefault(); const f = e.target, n = f.n.value.trim(), p = f.p.value.trim(); if (!n || p.replace(/\D/g, "").length < 7) return U.toast("Add a name and a phone number."); U.store.set("buddies", [...list, { name: n, phone: p }].slice(-12)); buddyBox(el); };
    el.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { U.store.set("buddies", list.filter((_, i) => i !== +b.dataset.rm)); buddyBox(el); });
  }
  async function seniorsShow() {
    const el = U.$("#seniorsBody"); const [lat, lon] = here(), easy = document.documentElement.classList.contains("easy");
    el.innerHTML = `<div class="easybar card">${tile("search", "var(--accent)")}<div><b>Bigger text and buttons</b><span>Turn on Easy reading to make the whole site easier to see and tap. Tap "Read aloud" to hear any page.</span></div><div class="go"><button class="btn small" data-easy aria-pressed="${easy}">${easy ? "Easy reading is on" : "Turn on Easy reading"}</button><button class="btn small alt" data-speak aria-pressed="false"><span>Read aloud</span></button></div></div>` +
      S("sec-sfood", "Meals and rides", "Food at your door and rides to appointments.") + `<div class="place-list">
        ${prog("basket", "#b8382b", "Meals on Wheels of Central Maryland", "Meals delivered to your home if it's hard to shop or cook. Apply online or by phone; they call you back within a day. The fee is based on what you can pay.", `${ext("https://mealsonwheelsmd.org/client-application/", "Apply online")} · 410-558-0923`, ["4105580923", "Meals on Wheels"])}
        ${prog("car", "#1d6fb8", "TaxiCard: cheaper taxi rides", "Baltimore City residents 60 and older, or 18 and older with a disability, get a monthly credit toward taxi rides. Monday to Friday, 8 a.m. to 5 p.m.", `${ext("https://www.caretaxicard.com/Home.aspx", "TaxiCard")} · (410) 664-1123`, ["4106641123", "TaxiCard"])}
        ${prog("hands", "var(--s0)", "Help finding services", "Maryland Access Point and 211 connect older adults and caregivers with in-home help, benefits and caregiver support.", "Call 211", ["211", "211 Maryland"])}
      </div>` +
      S("sec-scenters", "Senior centers near you", "Free activities, lunches and friends.") + `<div class="place-list" id="sCenters"><div class="skeleton" style="height:70px"></div></div>` +
      S("sec-shome", "Staying in your home", "Repairs, taxes and your rights.") + `<div class="place-list">
        ${prog("home", "var(--s3)", "Home repairs (LIGHT)", "Loans, some forgiven, and grants for roofs, heat, plumbing, electric, lead and accessibility for homeowners who live in their home. Income limit for 2 people: $85,450 a year.", `${ext("https://www.baltimorecity.gov/dhcd/housing-rehabilitation-and-repairs", "Apply")} · 410-396-3023`, ["4103963023", "home repair intake"])}
        ${prog("wallet", "#6b4c9a", "Renters' Tax Credit for 60+", "Up to $1,000 back a year for renters 60 and older with limited income. Apply by October 1.", "410-767-5915", ["4107675915", "the Renters' Tax Credit office"])}
        ${prog("hands", "var(--s4)", "Facing eviction? Free lawyer at 60+", "Everyone 60 or older facing eviction in Maryland can get a free lawyer.", "Maryland Legal Aid 1-888-465-2468", ["18884652468", "Maryland Legal Aid"])}
        ${prog("flame", "var(--s4)", "Free smoke alarms", "Call 311. The Fire Department installs them on every floor.", "", ["311", "311"])}
      </div>` +
      S("sec-buddy", "Check on each other", "Older neighbors living alone are most at risk in heat and cold.") + `<div id="sBuddy"></div>${checked()}`;
    EASE.fold(el, ["sec-sfood", "sec-scenters", "sec-buddy"]); buddyBox(U.$("#sBuddy")); MORE.easy();
    try { const S2 = await svc(); U.$("#sCenters").innerHTML = more(near(S2.seniors, lat, lon).map(x => placeRow(x, "users", "#6b4c9a", "")), 4, "senior centers") || `<p class="note">Call 211 for the closest senior center.</p>`; }
    catch { U.$("#sCenters").innerHTML = `<p class="note">Call 211 for the closest senior center.</p>`; }
    wire(el);
  }

  // =====================================================================================================
  // JOBS AND LEARNING
  const JOBS = [
    ["MOED Career Hub at Reservoir Square", "850 W. North Ave.", "410-396-3009", "Mon–Fri 8:30 am–4:30 pm, no appointment", "Job search help, free training, resumes and hiring events."],
    ["South Baltimore Employment Connection Center", "1410 Bush St.", "410-396-1052", "Mon–Fri 8:30 am–4:30 pm, no appointment", "Job search help and free training."],
    ["Westside YO Center (ages 18–24)", "1510 W. Lafayette Ave. (Gilmor St. entrance)", "410-545-6953", "Mon–Fri 8:30 am–4:30 pm", "GED, job training and jobs for young adults."],
    ["Neighborhood Job Hub: Bon Secours Community Works", "31 S. Payson St.", "443-826-9208", "Mon–Thu 9 am–3 pm; Fri virtual", "Meet a MOED job counselor in the neighborhood."],
    ["Neighborhood Job Hub: My Brother's Keeper", "4207 Frederick Ave.", "667-600-2950", "Mon, Wed, Thu 9 am–3 pm; Tue, Fri virtual", "Meet a MOED job counselor in the neighborhood."],
    ["Neighborhood Job Hub: GEDCO", "401 Woodbourne Ave.", "410-532-7117", "Tue, Wed, Fri 9 am–3 pm; Mon, Thu virtual", "Meet a MOED job counselor in the neighborhood."],
  ];
  const addrDir = (a, name) => `<a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.replace(/\s*\(.*\)/, "") + ", Baltimore, MD")}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(name)}" title="Directions">${I("nav", 18)}</a>`;
  async function jobsShow() {
    const el = U.$("#jobsBody"); const [lat, lon] = here();
    el.innerHTML = S("sec-jcenters", "Free job centers", "Walk in for help finding work, free training and resumes. Run by the Mayor's Office of Employment Development (MOED).", `<a href="https://www.baltimorecity.gov/moed" target="_blank" rel="noopener">MOED</a>`) +
      `<div class="place-list">${JOBS.map(([name, address, phone, hours, what]) => `<div class="place">${tile("building", "var(--accent)")}<div><b>${U.esc(name)}</b><small>${U.esc(address)} · ${U.esc(hours)}</small><small>${U.esc(what)}</small></div><div class="go">${callBtn(phone, name)}${addrDir(address, name)}</div></div>`).join("")}</div>` +
      S("sec-jyouth", "For young people", "Summer jobs and second chances.") + `<div class="place-list">
        ${prog("sun", "var(--accent)", "YouthWorks summer jobs", "Paid summer jobs for Baltimore City young people. Applications open each year before summer.", ext("https://www.baltimorecity.gov/moed", "YouthWorks at MOED"))}
        ${prog("book", "var(--s0)", "YO Baltimore (ages 18–24)", "Finish your GED or diploma, get job training and find work. Walk in at the Westside YO Center.", "410-545-6953", ["4105456953", "the YO Center"])}
      </div>` +
      S("sec-jnet", "Internet, computers and classes", "Free at the library.") + `<div class="place-list">
        ${prog("wifi", "var(--link)", "Borrow a hotspot", "Free mobile Wi-Fi hotspots from the Pratt Library for 12 weeks (renew up to 3 times), for anyone 13 and older with a library card. Reserve online and pick up at any branch.", `${ext("https://www.prattlibrary.org/books-and-more/computer-internet-devices/mobile-hotspots", "Hotspots")} · Free one-on-one tech help (443) 984-4944`, ["4439844944", "Pratt tech help"])}
        ${prog("book", "var(--accent)", "Borrow a Chromebook", "Pratt lends Chromebooks with a charger and case to anyone 13 and older.", ext("https://www.prattlibrary.org/books-and-more/computer-internet-devices/chromebooks", "Chromebooks"))}
      </div><div class="place-list" id="jNear" style="margin-top:10px"></div>${checked()}`;
    EASE.fold(el, ["sec-jcenters", "sec-jnet"]);
    try { const S2 = await svc(); U.$("#jNear").innerHTML = [...near(S2.libraries, lat, lon).slice(0, 2).map(x => placeRow(x, "book", "var(--accent)", "Library: free computers and Wi-Fi")), ...near(S2.wifi, lat, lon).slice(0, 1).map(x => placeRow(x, "wifi", "var(--link)", "Free public Wi-Fi"))].join(""); } catch {}
    wire(el);
  }

  // =====================================================================================================
  // COMMUNITY
  async function communityShow() {
    const el = U.$("#communityBody");
    el.innerHTML = S("sec-cmeet", "City Council meetings", "Coming up at City Hall. Most are open to the public, in person or online.", `<a href="https://baltimore.legistar.com/Calendar.aspx" target="_blank" rel="noopener">Full calendar</a>`) + `<div class="place-list" id="cMeet"><div class="skeleton" style="height:70px"></div></div>
      <div class="place-list" style="margin-top:10px">${prog("users", "#6b4c9a", "How to speak at a hearing", "Committee hearings on bills take public comment. Open the agenda, find the bill, and follow the sign-up steps on the meeting page, or send written comments to the committee before the hearing. Your council member's office can help.", `<a href="#place/sec-services">Find your council member</a> · ${ext("https://www.baltimorecitycouncil.com", "City Council")}`)}</div>` +
      S("sec-chomes", "Homes and lots", "Buy a city-owned house or care for an empty lot.") + `<div class="place-list" id="cHomes"><div class="skeleton" style="height:70px"></div></div>` +
      S("sec-cgreen", "Green your block", "Trees, gardens and clean streets.") + `<div class="place-list">
        ${prog("tree", "var(--s0)", "A free street tree", "TreeBaltimore plants a street tree for free and waters it for you. Shade keeps a block cooler in summer.", ext("https://www.treebaltimore.org", "Request a tree"))}
        ${prog("sprout", "#5e9e2f", "Community gardens and city farms", "Grow food with your neighbors. Many gardens rent plots and welcome volunteers.", `<a href="#map">Gardens on the map</a>`)}
        ${prog("trash", "var(--ink-2)", "Block cleanups", "Report dumping, dirty alleys and overgrown lots to 311, and see what's already reported near you on My block.", "Call 311", ["311", "311"])}
      </div>${checked()}`;
    EASE.fold(el, ["sec-cmeet", "sec-chomes"]);
    try {
      const L = await life(), today = new Date().toISOString().slice(0, 10);
      const mt = (L.meetings || []).filter(m => m.date >= today).slice(0, 12).map(m => {
        const d = new Date(m.date + "T12:00").toLocaleDateString(LOC(), { weekday: "short", month: "short", day: "numeric" });
        return `<div class="place">${tile("calendar", "#6b4c9a")}<div><b>${U.esc(m.body)}</b><small>${d}${m.time ? " · " + U.esc(m.time) : ""}${m.where ? " · " + U.esc(m.where) : ""}</small><small>${[m.agenda ? ext(m.agenda, "Agenda") : "", m.join ? ext(m.join, "Join online") : "", m.phone ? "By phone: " + U.esc(m.phone) : "", m.page ? ext(m.page, "Details") : ""].filter(Boolean).join(" · ")}</small></div></div>`; });
      U.$("#cMeet").innerHTML = mt.length ? more(mt, 4, "meetings") : `<p class="note">No meetings posted for the next few weeks. ${ext("https://baltimore.legistar.com/Calendar.aspx", "Check the calendar")}.</p>`;
      const H = L.homes || {}, top = (H.v2v_by_nb || []).slice(0, 4).map(x => `${U.esc(x[0])} (${x[1]})`).join(", ");
      U.$("#cHomes").innerHTML = [
        prog("home", "var(--accent)", `${(H.v2v || 0).toLocaleString()} city-owned homes for sale`, "Baltimore sells vacant city-owned houses through Vacants to Value, often at low prices, to buyers who will fix them up." + (top ? `</small><small><span>Most are in:</span> ${top}` : ""), ext("https://www.baltimorecity.gov/dhcd", "Housing & Community Development")),
        prog("sprout", "#5e9e2f", `${(H.lots || 0).toLocaleString()} empty lots you can adopt`, "Adopt-A-Lot lets residents and groups turn a city-owned empty lot into a garden, play space or green space, for free.", ext("https://www.baltimorecity.gov/dhcd", "Adopt-A-Lot")),
        prog("building", "var(--ink-2)", "Vacant house on your block?", "See the vacant building notices near your address on My block, and report open or unsafe vacants to 311.", `<a href="#place/sec-street">Your street</a>`),
      ].join("");
    } catch { U.$("#cMeet").innerHTML = `<p class="note">Couldn't load meetings right now. ${ext("https://baltimore.legistar.com/Calendar.aspx", "See the calendar")}.</p>`; U.$("#cHomes").innerHTML = ""; }
    wire(el);
  }

  // =====================================================================================================
  // ALL SERVICES hub: big photo doors plus a search box over every service on the site
  const DOORS = [
    ["now", "help", "Get help now", "Shelter tonight, food, 911, someone to talk to"],
    ["money", "money", "Money help", "What you qualify for: food, bills, taxes, rent"],
    ["health", "health", "Health", "Clinics, pharmacies, free shots, 988"],
    ["family", "family", "Family and kids", "Child care, schools, free meals, play"],
    ["seniors", "seniors", "Seniors", "Meals at home, rides, repairs, buddy check"],
    ["jobs", "jobs", "Jobs and learning", "Job centers, youth jobs, free internet"],
    ["community", "community", "Community", "Council meetings, homes, trees, gardens"],
    ["place", "block", "My block", "Trash day, 311 nearby, parking, flood risk"],
    ["help", "help", "Get help", "Warm and cool places, food, renters' rights"],
    ["map", "places", "Map", "Everything near you on one map"],
    ["plan", "plan", "Plan my day", "Best hours for walks, kids and chores"],
    ["today", "hero_day", "Today", "Weather, air and alerts right now"],
  ];
  const FIND = [
    ["SNAP food stamps EBT groceries", "Food: SNAP", "#money/sec-check"], ["food pantry free food hungry meal", "Free food near you", "#help/sec-food"], ["BGE gas electric bill heat shut off energy OHEP", "Gas and electric bill help", "#money/sec-bills"],
    ["water bill Water4All", "Water bill help", "#money/sec-bills"], ["rent eviction lawyer landlord court", "Rent and eviction help", "#help/sec-home"], ["taxes tax filing refund credit VITA", "Free tax filing", "#money/sec-taxes"],
    ["doctor clinic health center insurance dentist", "Community health centers", "#health/sec-clinics"], ["pharmacy medicine prescription drugstore", "Pharmacies", "#health/sec-pharm"], ["flu shot vaccine covid immunization", "Free shots", "#health/sec-shots"],
    ["mental health crisis suicide talk depressed 988", "988 Crisis Lifeline", "#health/sec-hnow"], ["smoke alarm detector fire", "Free smoke alarms", "#health/sec-safe"], ["medicaid insurance MCHP", "Health insurance", "#money/sec-check"],
    ["child care daycare scholarship", "Child Care Scholarship", "#family/sec-fkids"], ["head start preschool", "Head Start", "#family/sec-fkids"], ["WIC baby formula pregnant", "WIC", "#family/sec-fkids"],
    ["school schools closing snow day delay", "Schools and closings", "#family/sec-schools"], ["kids meals summer meals lunch", "Free meals for kids", "#family/sec-meals"], ["pool rec center playground park", "Pools, rec centers, parks", "#family/sec-play"],
    ["meals on wheels senior food delivery", "Meals on Wheels", "#seniors/sec-sfood"], ["taxi ride taxicard transportation appointment", "TaxiCard rides", "#seniors/sec-sfood"], ["senior center older adults", "Senior centers", "#seniors/sec-scenters"],
    ["home repair roof furnace LIGHT", "Home repairs", "#seniors/sec-shome"], ["neighbor buddy check wellness", "Neighbor buddy check", "#seniors/sec-buddy"], ["job work employment career resume", "Free job centers", "#jobs/sec-jcenters"],
    ["youthworks summer job teen young", "Summer jobs for young people", "#jobs/sec-jyouth"], ["internet wifi hotspot computer laptop chromebook", "Free internet and computers", "#jobs/sec-jnet"], ["council meeting hearing testify city hall", "City Council meetings", "#community/sec-cmeet"],
    ["vacant house buy home lot adopt", "Homes and lots", "#community/sec-chomes"], ["tree garden green", "Trees and gardens", "#community/sec-cgreen"], ["trash recycling pickup day bulk", "Trash and recycling day", "#place/sec-services"],
    ["311 pothole streetlight request report", "311 requests near you", "#place/sec-street"], ["parking permit zone sweeping tow", "Parking and sweeping", "#place/sec-street"], ["snow emergency route tow", "Snow emergency routes", "#map"],
    ["warming center cold shelter bed code blue", "Warm places and shelters", "#help/sec-places"], ["cooling center heat code red", "Cool places", "#help/sec-places"], ["bus train transit stop", "Buses and trains near you", "#place/sec-transit"],
    ["weather air quality pollen", "Weather and air today", "#today"], ["flood risk basement", "Flood risk at your address", "#place"],
  ];
  function servicesShow() {
    const el = U.$("#servicesBody"); if (el.dataset.built) return; el.dataset.built = 1;
    el.innerHTML = `<label class="findbox">${I("search", 20)}<input id="svcFind" type="search" placeholder="Search: rent, doctor, food, jobs" aria-label="Search all services"></label><div class="place-list" id="svcHits" hidden></div>
      <div class="doors">${DOORS.map(([v, img, t, d]) => `<a class="door" href="#${v}"><img data-img="${img}" alt="" loading="lazy"><span class="door-in"><b>${t}</b><small>${d}</small></span></a>`).join("")}</div>`;
    const inp = U.$("#svcFind"), hits = U.$("#svcHits");
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase(); if (q.length < 2) { hits.hidden = true; return; }
      const words = q.split(/\s+/), es = typeof ES_DICT !== "undefined" ? ES_DICT : {};
      const m = FIND.filter(([k, t]) => { const hay = (k + " " + t + " " + (es[t] || "")).toLowerCase(); return words.every(w => hay.includes(w) || hay.split(/\s+/).some(x => x.startsWith(w))); }).slice(0, 8);
      hits.hidden = false;
      hits.innerHTML = m.length ? m.map(([, t, h]) => `<a class="place hit" href="${h}">${tile("chev", "var(--link)", 18)}<div><b>${t}</b></div></a>`).join("") : `<div class="place">${tile("hands", "var(--s0)")}<div><b>Not sure? Call 211</b><small>211 Maryland can help with almost anything, any time, in any language.</small></div><div class="go">${callBtn("211", "211")}</div></div>`;
    };
    wire(el);
  }

  // =====================================================================================================
  // MY BLOCK: "Your street": live 311 requests, streetlights out, vacant building notices, residential permit parking
  const AG = "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services";
  const DH = "https://baltegis.baltimorecity.gov/mapping/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer";
  const NAMES = { "BGE-StLight(s) Out": "Streetlight out", "TRM-Potholes": "Pothole", "TRM-Pickup Pothole": "Pothole", "SW-Dirty Alley": "Dirty alley", "SW-Dirty Street": "Dirty street", "SW-Mixed Refuse": "Trash pickup problem",
    "SW-Recycling": "Recycling pickup problem", "SW-Bulk Scheduled-Weekday": "Bulk trash pickup", "SW-Bulk Scheduled-Saturday": "Bulk trash pickup", "SW-Rat Rubout": "Rats", "HCD-Rodents": "Rats on a property",
    "HCD-Sanitation Property": "Trash on a property", "HCD-Illegal Dumping": "Illegal dumping", "HCD-Vacant Building": "Vacant building", "SW-Boarding": "Board up an open vacant", "WW-Water Leak (Exterior)": "Water leak outside",
    "WW-Sewer Water In Basement": "Sewer water in a basement", "WW-Water No Water": "No water", "WW-Water Low Pressure": "Low water pressure", "WW-Water Meter Leak": "Water meter leak", "TRT-Traffic Signal Repairs": "Traffic signal repair",
    "FOR-Tree Maintenance": "Tree care", "HCD-Trees and Shrubs": "Overgrown trees or bushes", "SW-City Trash Can or Recycling Can Issue": "City trash or recycling can", "SW-City Trash Can Issue": "City trash can",
    "TRS-Parking Complaint": "Parking complaint", "TRS-48 Hour Parking/Abandoned Vehicle (DOT SAFETY USE ONLY)": "Abandoned car", "HCD-Abandoned Vehicle": "Abandoned car", "SW-Leaf Collection Scheduling": "Leaf pickup",
    "HLTH-Animal Dead Animal Pickup-Wildlife or Stray": "Dead animal pickup", "FIR-Fire Smoke Alarm Installation Request": "Free smoke alarm", "HCD-Maintenance Structure": "Building in poor repair", "SW-Appliance (White Goods)": "Appliance pickup",
    "SW-Mechanical Street Sweeping": "Street sweeping", "SW-Public (Corner) Trash Can Issue": "Corner trash can", "SW-Cleaning": "Lot or property cleaning", "SW-HGW": "High grass and weeds", "SW-Graffiti Removal": "Graffiti", "TTR-Vehicle Removal": "Car towed or removed", "HCD-Systems": "Heat, water or power problem in a home" };
  const friendly = t => NAMES[t] || (/^(ECC|FCPF)-|Proactive|Information|Customer Support|Look Up|Escalation/i.test(t || "") ? null : (t || "").replace(/^[A-Z]{2,5}-/, "").replace(/\s*\(.*?\)\s*/g, " ").trim());
  const q = (u, p) => U.getJSON(u + "/query?" + new URLSearchParams({ f: "json", ...p }), {}, 12000);
  const ptQ = (lat, lon, m) => ({ geometry: `${lon},${lat}`, geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", ...(m ? { distance: m, units: "esriSRUnit_Meter" } : {}) });
  async function street(el, lat, lon) {
    if (!el) return;
    el.innerHTML = `<div class="skeleton" style="height:90px"></div>`;
    const [r311, vac, park, L] = await Promise.allSettled([
      q(AG + "/311_Customer_Service_Requests_current/FeatureServer/0", { where: "CreatedDate > CURRENT_TIMESTAMP - 60", outFields: "SRType,SRStatus,CreatedDate,CloseDate,Address", returnGeometry: false, orderByFields: "CreatedDate DESC", resultRecordCount: 500, ...ptQ(lat, lon, 250) }),
      q(DH + "/1", { where: "1=1", outFields: "Address,DateNotice", returnGeometry: false, resultRecordCount: 200, ...ptQ(lat, lon, 200) }),
      q(AG + "/Residential_Parking_Permits/FeatureServer/0", { where: "1=1", outFields: "*", returnGeometry: false, ...ptQ(lat, lon) }),
      life()]);
    const rows = [], fix = L.status === "fulfilled" ? L.value.fix?.types || {} : {};
    const typical = t => { const f = fix[t]; return f && f.n >= 15 ? (f.median < 1 ? "usually within a day" : `usually ${Math.round(f.median)} day${Math.round(f.median) === 1 ? "" : "s"}`) : null; };
    if (r311.status === "fulfilled" && !r311.value.error) {
      const fs = (r311.value.features || []).map(f => f.attributes).filter(a => friendly(a.SRType));
      const open = fs.filter(a => !/closed/i.test(a.SRStatus || "")), lights = open.filter(a => a.SRType === "BGE-StLight(s) Out");
      const by = {}; fs.forEach(a => { const n = friendly(a.SRType); (by[n] = by[n] || { n: 0, open: 0, type: a.SRType }).n++; if (!/closed/i.test(a.SRStatus || "")) by[n].open++; });
      const top = Object.entries(by).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
      rows.push(`<div class="place">${tile("doc", "var(--link)")}<div><b>${fs.length ? `${fs.length} requests to 311 within 2 blocks in the last 60 days` : "No 311 requests within 2 blocks in the last 60 days"}</b><small>${fs.length ? `${open.length} still open.` : "A quiet block."} Something wrong? Report it: the more reports, the sooner it's fixed.</small>
        ${top.length ? `<ul class="srlist">${top.map(([n, v]) => { const ty = typical(v.type); return `<li><b>${U.esc(n)}</b><span class="tnum">${v.n}${v.open ? `, ${v.open} open` : ""}</span>${ty ? `<small>Fixed ${ty} citywide</small>` : ""}</li>`; }).join("")}</ul>` : ""}
        <small><a href="https://balt311.baltimorecity.gov/citizen/s/" target="_blank" rel="noopener">Report or track a request on 311</a> · or call 311</small></div></div>`);
      rows.push(`<div class="place ${lights.length ? "warnrow" : ""}">${tile("bolt", lights.length ? "var(--s3)" : "var(--s0)")}<div><b>${lights.length ? `${lights.length} streetlight${lights.length > 1 ? "s" : ""} reported out nearby` : "No streetlights reported out nearby"}</b><small>${lights.length ? "Reported and waiting for BGE. Walk on well-lit streets after dark." : "See a light out? Report it to 311."} BGE usually fixes streetlights in about ${Math.max(2, Math.round(fix["BGE-StLight(s) Out"]?.median || 2))} days.</small></div></div>`);
    } else rows.push(`<p class="note">311 requests near you couldn't load right now. ${ext("https://balt311.baltimorecity.gov/citizen/s/", "Open 311")}.</p>`);
    if (vac.status === "fulfilled" && !vac.value.error) {
      const v = (vac.value.features || []).map(f => f.attributes), adds = [...new Set(v.map(a => (a.Address || "").trim()).filter(Boolean))].slice(0, 6);
      rows.push(`<div class="place">${tile("building", v.length ? "var(--s3)" : "var(--s0)")}<div><b>${v.length ? `${v.length} vacant building notice${v.length > 1 ? "s" : ""} within 2 blocks` : "No vacant building notices within 2 blocks"}</b><small>${v.length ? "Open, unsafe or trash-filled? Report it to 311 so the city can board it up or clean it." : "Notices are issued by Housing & Community Development."}</small>${adds.length ? `<small>${adds.map(a => U.esc(a)).join(" · ")}</small>` : ""}<small><a href="#community/sec-chomes">City homes for sale</a></small></div></div>`);
    }
    if (park.status === "fulfilled" && !park.value.error) {
      const z = (park.value.features || [])[0]?.attributes;
      rows.push(z ? `<div class="place">${tile("car", "#1d6fb8")}<div><b>Residential permit parking: ${U.esc(z.Name_1 || "Area " + (z.AREA || ""))}</b><small>${U.esc(z.ReStrictio || "Permit needed to park longer than posted")}. Residents can buy a parking permit and visitor passes.</small><small>Parking Authority ${tel("4435732800", "(443) 573-2800")} · ${ext("https://parking.baltimorecity.gov/residential-parking", "Permits")}</small></div></div>`
        : `<div class="place">${tile("car", "var(--ink-3)")}<div><b>Not in a residential permit parking area</b><small>Watch posted signs for street sweeping and snow emergency routes.</small></div></div>`);
    }
    el.innerHTML = `<div class="place-list">${rows.join("")}</div><p class="note">Live from Baltimore 311, Housing & Community Development and the Parking Authority.</p>`;
  }

  return { street, buddyBox, osmOpen, results, views: {
    money: { show: moneyShow }, health: { show: healthShow }, family: { show: familyShow }, seniors: { show: seniorsShow },
    jobs: { show: jobsShow }, community: { show: communityShow }, services: { show: servicesShow } } };
})();
