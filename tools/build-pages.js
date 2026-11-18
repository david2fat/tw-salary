#!/usr/bin/env node
/* Generates the long-tail pages (月薪實領、年終金額、加班費、最低工資、綜所稅、Gold Card).
 * Run from the repo root: node tools/build-pages.js   then: python3 tools/seo.py
 * Numbers come from calc.js / labor.js / tax.js so a yearly RATES update flows through. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TW = require(path.join(ROOT, 'calc.js'));
global.TWSalary = TW;
const L = require(path.join(ROOT, 'labor.js'));
const T = require(path.join(ROOT, 'tax.js'));
const BASE = 'https://david2fat.github.io/tw-salary/';
const f = (x) => Math.round(x).toLocaleString('en-US');
const wan = (x) => (x / 10000) + ' 萬';

const ZH_NAV = [['', '實領薪資'], ['insurance/', '勞健保級距'], ['overtime/', '加班費'], ['year-end-bonus/', '年終獎金'],
  ['income-tax/', '綜所稅'], ['severance/', '資遣費'], ['annual-leave/', '特休天數'], ['minimum-wage/', '最低工資']];
const EN_NAV = [['', 'Take-home pay'], ['insurance/', 'Labor &amp; NHI'], ['overtime/', 'Overtime'], ['year-end-bonus/', 'Year-end bonus'],
  ['income-tax/', 'Income tax'], ['severance/', 'Severance'], ['annual-leave/', 'Annual leave'], ['minimum-wage/', 'Minimum wage']];

function page(o) {
  // o: { rel, lang:'zh'|'en', title, desc, alt (other-language rel or null), navKey, badge, h1, lede, body, footer, scripts:[], faq:[[q,a]] }
  const zh = o.lang === 'zh';
  const depth = o.rel.split('/').filter(Boolean).length;
  const up = '../'.repeat(depth);
  const home = zh ? up : up + 'en/';
  const homeFromRoot = zh ? '' : 'en/';
  const nav = (zh ? ZH_NAV : EN_NAV).map(([h, t]) => {
    const target = homeFromRoot + h;
    return `  <a href="${up}${target}"${target === o.navKey ? ' aria-current="page"' : ''}>${t}</a>`;
  }).join('\n');
  const alts = o.alt ? (zh
    ? `<link rel="alternate" hreflang="zh-Hant-TW" href="${BASE}${o.rel}">\n<link rel="alternate" hreflang="en" href="${BASE}${o.alt}">\n`
    : `<link rel="alternate" hreflang="zh-Hant-TW" href="${BASE}${o.alt}">\n<link rel="alternate" hreflang="en" href="${BASE}${o.rel}">\n`) : '';
  const faq = o.faq && o.faq.length ? `<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: o.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) })}
</script>\n` : '';
  const faqHtml = o.faq && o.faq.length ? `\n  <h2>${zh ? '常見問題' : 'FAQ'}</h2>\n` + o.faq.map(([q, a]) => `  <details><summary>${q}</summary><p>${a}</p></details>`).join('\n') + '\n' : '';
  const langLink = o.alt ? `<a class="lang" href="${up}${o.alt}" hreflang="${zh ? 'en' : 'zh-Hant-TW'}">${zh ? 'English' : '中文'}</a>`
    : (zh ? `<a class="lang" href="${up}en/" hreflang="en">English</a>` : `<a class="lang" href="${up}" hreflang="zh-Hant-TW">中文</a>`);
  const ad = zh ? '<!-- AdSense：核准後把下面這行取消註解，換上自己的 ca-pub 編號' : '<!-- AdSense: uncomment after approval and insert your ca-pub ID';
  const html = `<!doctype html>
<html lang="${zh ? 'zh-Hant-TW' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.title}</title>
<meta name="description" content="${o.desc}">
<link rel="canonical" href="${BASE}${o.rel}">
${alts}<link rel="stylesheet" href="${up}style.css">
${ad}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
-->
${faq}${(o.scripts || []).map((s) => `<script src="${up}${s}" defer></script>`).join('\n')}
</head>
<body>
<div class="hero">
<header>
  <a class="brand" href="${home}">${zh ? '台灣薪資工具' : 'Taiwan Salary Tools'}</a>
  ${langLink}
</header>
<nav class="toolnav" aria-label="${zh ? '工具' : 'Tools'}">
${nav}
</nav>
<div class="hero-in">
  <span class="badge">${o.badge}</span>
  <h1>${o.h1}</h1>
  <p class="lede">${o.lede}</p>
</div>
</div>
<main>
${o.calc || ''}
  <article class="card prose">
  <div class="ad-slot" aria-hidden="true"><!-- AdSense ${zh ? '廣告單元' : 'unit'} #1 -->${zh ? '廣告' : 'Advertisement'}</div>
${o.body}${faqHtml}${o.related || ''}
  </article>
</main>
<footer>
  <p>${o.footer}</p>
</footer>
</body>
</html>
`;
  const file = path.join(ROOT, o.rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return o.rel;
}

const table = (head, rows) => `  <div class="table-wrap"><table>
    <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
${rows.map((r) => `      <tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table></div>`;
const ad2 = (zh) => `  <div class="ad-slot" aria-hidden="true"><!-- AdSense ${zh ? '廣告單元' : 'unit'} #2 -->${zh ? '廣告' : 'Advertisement'}</div>`;
const ZH_SRC = '本工具結果為估算，實際金額以官方及雇主計算為準。最後更新：2026 年 11 月。';
const EN_SRC = 'Results are estimates; official and employer calculations prevail. Last updated: November 2026.';
const out = [];

// ===================== 1. 月薪實領對照頁 =====================
const SALARIES = [30000, 35000, 40000, 50000, 60000, 80000, 100000];
const INS = require(path.join(ROOT, 'insurance/ins.js'));
const salaryLinks = (cur, up) => SALARIES.map((s) => s === cur ? `<strong>${wan(s)}</strong>` : `<a href="${up}salary/${s}/">${wan(s)}</a>`).join(' · ');

function salaryCalcForm(s, up) {
  return `  <form id="calc" class="card calc" autocomplete="off" data-salary="${s}">
    <label for="salary">月薪（新台幣）</label>
    <input id="salary" type="number" inputmode="numeric" min="0" step="100" value="${s}">
    <div class="result" aria-live="polite">
      <div>每月實領</div>
      <div class="big" id="out-takehome">—</div>
      <div class="bar"><i id="bar-take"></i></div>
      <div class="pct"><span id="out-pct"></span> 實領佔月薪</div>
      <dl>
        <dt>勞保</dt><dd id="out-labor"></dd>
        <dt>健保</dt><dd id="out-nhi"></dd>
        <dt>勞退自提</dt><dd id="out-pension"></dd>
      </dl>
      <div class="warn" id="warn-min" hidden>低於 2026 年最低工資 29,500 元，結果僅供參考。</div>
    </div>
    <details class="more">
      <summary>更多選項與全年估算</summary>
      <label for="dependents">健保眷屬人數</label>
      <select id="dependents"><option>0</option><option>1</option><option>2</option><option>3</option></select>
      <label for="pension">勞退自提</label>
      <select id="pension"><option value="0">不自提</option><option value="1">1%</option><option value="2">2%</option><option value="3">3%</option><option value="4">4%</option><option value="5">5%</option><option value="6">6%</option></select>
      <label for="bonus">全年獎金</label>
      <input id="bonus" type="number" inputmode="numeric" min="0" step="1000" value="0">
      <label for="taxdeps">報稅扶養人數</label>
      <select id="taxdeps"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select>
      <label class="check"><input id="married" type="checkbox"> 已婚合併申報</label>
      <label class="check"><input id="employment" type="checkbox" checked> 有就業保險（本國籍勞工）</label>
      <dl>
        <dt>獎金補充保費</dt><dd id="out-supp"></dd>
        <dt>綜所稅（隔年 5 月繳）</dt><dd id="out-tax"></dd>
        <dt><strong>全年實拿</strong></dt><dd><strong id="out-annual"></strong></dd>
        <dt>雇主提撥勞退 6%</dt><dd id="out-employer-pension"></dd>
        <dt>投保級距（<a href="${up}insurance/">查雇主負擔</a>）</dt><dd id="out-grades"></dd>
      </dl>
    </details>
  </form>`;
}

for (const s of SALARIES) {
  const up = '../../';
  const r = TW.calculate({ salary: s });
  const r6 = TW.calculate({ salary: s, pensionRate: 0.06 });
  const e = INS.calculate({ salary: s });
  const deps = [0, 1, 2, 3].map((d) => TW.calculate({ salary: s, dependents: d }));
  const bonus2 = TW.calculate({ salary: s, bonus: s * 2 });
  const taxSaved = TW.calculate({ salary: s, bonus: s * 2 }).annualTax - TW.calculate({ salary: s, bonus: s * 2, pensionRate: 0.06 }).annualTax;
  const pct = (r.monthlyTakeHome / s * 100).toFixed(1);
  const capNote = r.laborGrade < s ? `勞保投保薪資最高只到 ${f(TW.RATES.labor.max)} 元，所以月薪 ${wan(s)}的勞保費和月薪 4.58 萬的人一樣，只有健保和勞退會隨薪水增加。` : `勞保、健保、勞退都依同一個級距 ${f(r.laborGrade)} 元計算。`;
  const near = SALARIES.map((x) => { const c = TW.calculate({ salary: x }); return [x === s ? `<strong>${f(x)}</strong>` : `<a href="${up}salary/${x}/">${f(x)}</a>`, f(c.laborFee), f(c.nhiFee), f(c.monthlyTakeHome)]; });
  out.push(page({
    rel: `salary/${s}/`, lang: 'zh', navKey: '',
    title: `月薪 ${wan(s)}實領多少？2026 勞健保扣 ${f(r.laborFee + r.nhiFee)} 元、實拿 ${f(r.monthlyTakeHome)} 元`,
    desc: `2026 年（115 年）月薪 ${f(s)} 元，勞保自付 ${f(r.laborFee)} 元、健保自付 ${f(r.nhiFee)} 元，每月實領 ${f(r.monthlyTakeHome)} 元。附有眷屬、勞退自提 6%、雇主成本和全年綜所稅估算。`,
    badge: '2026 · 115年', h1: `月薪 ${wan(s)}實領多少？`,
    lede: `2026 年月薪 ${f(s)} 元，扣掉勞保、健保後每月實領 <strong>${f(r.monthlyTakeHome)} 元</strong>（無眷屬、不自提勞退）。可以在下面改眷屬人數或勞退自提重算。`,
    scripts: ['calc.js'],
    calc: salaryCalcForm(s, up),
    body: `
  <h2>月薪 ${wan(s)}每月扣多少？</h2>
  <p>投保級距：勞保 ${f(r.laborGrade)} 元、健保 ${f(r.nhiGrade)} 元、勞退 ${f(r.pensionGrade)} 元。${capNote}</p>
${table(['項目', '金額（元／月）'], [
    ['月薪', f(s)], ['勞保自付（含就保）', '−' + f(r.laborFee)], ['健保自付（本人）', '−' + f(r.nhiFee)],
    ['<strong>實領（不自提）</strong>', `<strong>${f(r.monthlyTakeHome)}</strong>`], ['勞退自提 6%', '−' + f(r6.pensionSelf)],
    ['<strong>實領（自提 6%）</strong>', `<strong>${f(r6.monthlyTakeHome)}</strong>`]])}
  <p>實領約佔月薪 ${pct}%。所得稅一般不按月大額預扣，而是隔年 5 月報稅時結算。</p>

  <h2>有健保眷屬時實領多少？</h2>
  <p>每多一位依附你投保健保的眷屬，每月多扣 ${f(r.nhiPerPerson)} 元，最多算 3 人。</p>
${table(['健保眷屬', '健保自付', '每月實領'], deps.map((d, i) => [i + ' 人', f(d.nhiFee), f(d.monthlyTakeHome)]))}
${ad2(true)}

  <h2>公司實際要付多少？</h2>
  <p>月薪 ${f(s)} 元，雇主每月還要負擔勞保 ${f(e.labor.employer)} 元、職災保險約 ${f(e.occupational)} 元、健保 ${f(e.nhi.employer)} 元、勞退 6% ${f(e.pension.employer)} 元和墊償基金 ${f(e.arrears)} 元，合計約 <strong>${f(e.employerTotal)} 元</strong>，所以公司每月的人事成本約 ${f(e.totalCost)} 元。<a href="${up}insurance/">用勞健保級距試算看細項</a>。</p>

  <h2>全年要繳多少所得稅？</h2>
  <p>以單身、無扶養、年終 2 個月（全年 ${f(s * 14)} 元）估算，115 年度綜所稅約 <strong>${f(bonus2.annualTax)} 元</strong>，2027 年 5 月申報。${taxSaved > 0 ? `如果勞退自提 6%，全年可少繳約 ${f(taxSaved)} 元稅。` : '這個所得淨額不多，勞退自提的節稅效果有限。'}<a href="${up}income-tax/">用綜所稅試算算你的情況</a>。</p>

  <h2>其他月薪實領對照</h2>
  <p>${salaryLinks(s, up)}</p>
${table(['月薪', '勞保', '健保', '實領'], near)}`,
    faq: [
      [`月薪 ${wan(s)}實領多少？`, `2026 年月薪 ${f(s)} 元、無眷屬、不自提勞退時，勞保自付 ${f(r.laborFee)} 元、健保自付 ${f(r.nhiFee)} 元，每月實領 ${f(r.monthlyTakeHome)} 元。`],
      [`月薪 ${wan(s)}勞退自提 6% 後實領多少？`, `自提 6% 每月再扣 ${f(r6.pensionSelf)} 元，實領 ${f(r6.monthlyTakeHome)} 元。這筆錢存在你的勞退個人專戶，60 歲可以領回，並可從當年度所得中扣除。`],
      [`月薪 ${wan(s)}公司的勞健保成本是多少？`, `雇主每月約負擔 ${f(e.employerTotal)} 元（勞保、職災、健保、勞退 6%、墊償基金），總人事成本約 ${f(e.totalCost)} 元。`],
    ],
    related: `
  <h2>相關工具</h2>
  <ul class="tools">
    <li><a href="${up}">實領薪資試算</a>：輸入任何月薪重算</li>
    <li><a href="${up}year-end-bonus/">年終獎金試算</a>：扣 5% 稅和補充保費後實拿多少</li>
    <li><a href="${up}overtime/">加班費試算</a>：平日、休息日、國定假日加班費</li>
  </ul>`,
    footer: '資料來源：勞動部勞工保險局、衛生福利部中央健康保險署 115 年分級表，財政部 115 年度綜合所得稅公告。' + ZH_SRC,
  }));
}

// ===================== 4. 年終獎金金額對照頁 =====================
const BONUSES = [50000, 100000, 150000, 200000, 300000];
const BSAL = [30000, 40000, 50000, 60000, 80000];
for (const b of BONUSES) {
  const up = '../../';
  const rows = BSAL.map((s) => { const r = L.calcBonus({ salary: s, bonus: b }); return [f(s), (b / s).toFixed(1).replace(/\.0$/, '') + ' 個月', f(r.withholding), f(r.supplementary), `<strong>${f(r.net)}</strong>`, (r.settle > 0 ? '補 ' : '退 ') + f(Math.abs(r.settle))]; });
  const r50 = L.calcBonus({ salary: 50000, bonus: b });
  const withheld = b > L.RULES.bonusWithholdThreshold;
  const anySupp = BSAL.some((s) => L.calcBonus({ salary: s, bonus: b }).supplementary > 0);
  const links = BONUSES.map((x) => x === b ? `<strong>${wan(x)}</strong>` : `<a href="${up}year-end-bonus/${x}/">${wan(x)}</a>`).join(' · ');
  out.push(page({
    rel: `year-end-bonus/${b}/`, lang: 'zh', navKey: 'year-end-bonus/',
    title: `年終 ${wan(b)}扣多少稅？2026 預扣 5%、補充保費、實拿對照表`,
    desc: `年終獎金 ${f(b)} 元${withheld ? `會被預扣 5% 所得稅 ${f(b * 0.05)} 元` : '不到 90,500 元，不會被預扣所得稅'}，補充保費要看月薪。依月薪 3 萬到 8 萬列出實際入帳金額，以及隔年 5 月報稅要補還是退。`,
    badge: '2026 · 115年', h1: `年終 ${wan(b)}實拿多少？`,
    lede: `年終獎金 ${f(b)} 元，${withheld ? `超過 90,500 元，發放時會先扣 5% 所得稅 ${f(b * 0.05)} 元` : '在 90,500 元以下，發放時不會預扣所得稅'}${anySupp ? '；月薪較低的人還會被扣補充保費' : '；月薪 3 萬以上的人不會被扣補充保費'}。下表依月薪列出實拿金額。`,
    body: `
  <h2>年終 ${wan(b)}，各月薪實拿對照</h2>
  <p>（單次發放、當年度沒有其他獎金、單身無扶養。「5 月報稅」是年終讓全年綜所稅增加的金額減掉已預扣的稅，正數要補、負數會退。）</p>
${table(['月薪', '相當於', '預扣 5%', '補充保費', '入帳', '5 月報稅'], rows)}

  <h2>為什麼會扣這些錢？</h2>
  <ul>
    <li><strong>預扣所得稅：</strong>115 年度單次給付超過 90,500 元的獎金要先扣 5%。${withheld ? `所以 ${f(b)} 元會扣 ${f(b * 0.05)} 元。` : `${f(b)} 元沒有超過，所以不扣。`}這只是預繳，隔年 5 月報稅時多退少補。</li>
    <li><strong>二代健保補充保費：</strong>同一家公司當年度累計獎金超過健保投保金額 4 倍的部分，扣 2.11%。例如月薪 ${f(30000)} 元（投保 ${f(TW.grade(30000, 1e9))}），門檻是 ${f(TW.grade(30000, 1e9) * 4)} 元${b > TW.grade(30000, 1e9) * 4 ? `，年終 ${f(b)} 元超過的部分要扣 ${f(L.calcBonus({ salary: 30000, bonus: b }).supplementary)} 元` : `，年終 ${f(b)} 元沒超過，不用扣`}。</li>
    <li><strong>勞健保：</strong>年終不會再扣勞保費和一般健保費。</li>
  </ul>
${ad2(true)}

  <h2>5 月報稅會補還是退？</h2>
  <p>以月薪 5 萬為例，年終 ${f(b)} 元讓全年綜所稅增加 ${f(r50.taxIncrease)} 元，${withheld ? `已預扣 ${f(r50.withholding)} 元，` : '發放時沒有預扣，'}${r50.settle > 0 ? `5 月還要補約 ${f(r50.settle)} 元` : r50.settle < 0 ? `5 月可以退回約 ${f(-r50.settle)} 元` : '剛好打平'}。全年所得淨額落在 5% 級距的人通常會退稅，落在 12% 以上級距的人要補稅。</p>

  <h2>其他年終金額</h2>
  <p>${links}</p>`,
    faq: [
      [`年終 ${wan(b)}要扣稅嗎？`, withheld ? `要。115 年度單次給付超過 90,500 元的獎金會預扣 5%，${f(b)} 元要扣 ${f(b * 0.05)} 元，隔年 5 月報稅多退少補。` : `發放時不用預扣，因為沒有超過 90,500 元；但它會計入全年所得，隔年 5 月報稅時一起計稅。`],
      [`年終 ${wan(b)}要扣補充保費嗎？`, `要看健保投保金額。累計獎金超過投保金額 4 倍的部分才扣 2.11%。${BSAL.map((s) => `月薪 ${wan(s)}扣 ${f(L.calcBonus({ salary: s, bonus: b }).supplementary)} 元`).join('、')}。`],
    ],
    related: `
  <h2>相關工具</h2>
  <ul class="tools">
    <li><a href="${up}year-end-bonus/">年終獎金試算</a>：輸入月薪和年終月數，連 5 月補退稅一起算</li>
    <li><a href="${up}income-tax/">綜所稅試算</a>：全年要繳多少稅</li>
    <li><a href="${up}salary/40000/">月薪 4 萬實領多少</a></li>
  </ul>`,
    footer: '資料來源：財政部 115 年度薪資所得扣繳辦法（非固定薪資超過 90,500 元扣繳 5%）、衛生福利部中央健康保險署（補充保費 2.11%）、財政部 115 年度綜合所得稅公告。' + ZH_SRC,
  }));
}

// ===================== 2. 加班費 =====================
function otForm(zh) {
  const t = zh ? { mode: '薪資型態', m: '月薪', h: '時薪', wage: '月薪或時薪（新台幣）', wd: '平日加班', rd: '休息日加班', hd: '國定假日出勤', hrs: '每次幾小時', days: '本月幾次', total: '本月加班費', hourly: '時薪基準', cnt: '計入加班上限的時數', cap: '超過每月 46 小時的加班上限（勞資會議同意可到 54 小時，每 3 個月合計 138 小時）。' }
    : { mode: 'Pay type', m: 'Monthly salary', h: 'Hourly wage', wage: 'Monthly salary or hourly wage (NT$)', wd: 'Weekday overtime', rd: 'Rest day work', hd: 'National holiday / leave day work', hrs: 'Hours each time', days: 'Times this month', total: 'Overtime pay this month', hourly: 'Hourly base', cnt: 'Hours counted toward the cap', cap: 'Over the 46-hour monthly overtime cap (54 with a labor-management meeting agreement, 138 per 3 months).' };
  const row = (id, label, hv, dv, max) => `    <div class="pair">
      <div><label for="o${id}h">${label}</label><input id="o${id}h" type="number" inputmode="decimal" min="0" max="${max}" step="0.5" value="${hv}" aria-describedby="o${id}x"><p class="hint" id="o${id}x">${t.hrs}</p></div>
      <div><label for="o${id}d">${t.days}</label><input id="o${id}d" type="number" inputmode="numeric" min="0" max="31" step="1" value="${dv}"></div>
    </div>`;
  return `  <form id="ot-calc" class="card calc" autocomplete="off">
    <label for="omode">${t.mode}</label>
    <select id="omode"><option value="monthly">${t.m}</option><option value="hourly">${t.h}</option></select>
    <label for="owage">${t.wage}</label>
    <input id="owage" type="number" inputmode="numeric" min="0" step="100" value="40000">
${row('w', t.wd, 2, 8, 4).replace('id="owh"', 'id="owh"').replace('ow' + 'h', 'owh')}
${row('r', t.rd, 0, 0, 12)}
${row('h', t.hd, 0, 0, 12)}
    <div class="result" aria-live="polite">
      <div>${t.total}</div>
      <div class="big" id="out-total">—</div>
      <dl>
        <dt>${t.hourly}</dt><dd id="out-hourly"></dd>
        <dt>${t.wd}</dt><dd id="out-weekday"></dd>
        <dt>${t.rd}</dt><dd id="out-rest"></dd>
        <dt>${t.hd}</dt><dd id="out-holiday"></dd>
        <dt>${t.cnt}</dt><dd id="out-hours"></dd>
      </dl>
      <div class="warn" id="warn-cap" hidden>${t.cap}</div>
    </div>
  </form>`;
}
// ids used by tax.js: owh/owd, orh/ord, ohh/ohd
const fixOtIds = (s) => s.replace(/id="owh"/g, 'id="owh"').replace(/for="owh"/g, 'for="owh"')
  .replace(/o(w|r|h)h"/g, 'o$1h"').replace(/o(w|r|h)d"/g, 'o$1d"');
const h40 = 40000 / 240;
const otEx = (opts) => T.overtime(Object.assign({ monthly: 40000 }, opts)).total;
out.push(page({
  rel: 'overtime/', lang: 'zh', alt: 'en/overtime/', navKey: 'overtime/',
  title: '加班費試算 2026｜平日、休息日、國定假日加班費怎麼算（勞基法第 24 條）',
  desc: '輸入月薪或時薪和加班時數，依勞基法第 24、39 條算出平日加班（1.34、1.67 倍）、休息日加班（1.34、1.67、2.67 倍）和國定假日出勤的加班費，並檢查有沒有超過每月 46 小時上限。',
  badge: '勞基法第 24 條', h1: '加班費試算', lede: '輸入月薪和這個月的加班時數，馬上算出公司應該付你多少加班費。月薪制的時薪＝月薪 ÷ 240。',
  scripts: ['calc.js', 'tax.js'], calc: fixOtIds(otForm(true)),
  body: `
  <h2>加班費倍率一覽</h2>
${table(['加班類型', '時段', '倍率', '月薪 4 萬每小時'], [
    ['平日延長工時', '前 2 小時', '1.34（1⅓）', f(h40 * 4 / 3)], ['', '第 3–4 小時', '1.67（1⅔）', f(h40 * 5 / 3)],
    ['休息日', '前 2 小時', '1.34', f(h40 * 4 / 3)], ['', '第 3–8 小時', '1.67', f(h40 * 5 / 3)], ['', '第 9–12 小時', '2.67（2⅔）', f(h40 * 8 / 3)],
    ['國定假日、特休日', '8 小時內', '加發 1 日工資', f(h40 * 8) + '（整天）'], ['', '第 9–10 小時', '1.34', f(h40 * 4 / 3)], ['', '第 11–12 小時', '1.67', f(h40 * 5 / 3)]])}
  <p>倍率是勞基法寫的 1⅓、1⅔、2⅔，實務上常寫成 1.34、1.67、2.67；本工具用分數精算。月薪制的時薪基準是「月薪 ÷ 30 ÷ 8」，月薪只算經常性給與（本薪、固定津貼），不含年終等非經常性獎金。</p>

  <h2>月薪 4 萬加班費範例</h2>
${table(['情況', '加班費'], [
    ['平日加班 2 小時', f(otEx({ weekdayHours: 2, weekdayDays: 1 })) + ' 元'], ['平日加班 3 小時', f(otEx({ weekdayHours: 3, weekdayDays: 1 })) + ' 元'],
    ['平日每天加班 2 小時 × 20 天', f(otEx({ weekdayHours: 2, weekdayDays: 20 })) + ' 元'], ['休息日上班 4 小時', f(otEx({ restHours: 4, restDays: 1 })) + ' 元'],
    ['休息日上班 8 小時', f(otEx({ restHours: 8, restDays: 1 })) + ' 元'], ['國定假日上班 8 小時', f(otEx({ holidayHours: 8, holidayDays: 1 })) + ' 元']])}
${ad2(true)}

  <h2>休息日和例假日差在哪？</h2>
  <p>一週兩天休假中，一天是<strong>例假日</strong>、一天是<strong>休息日</strong>。休息日公司可以請你加班，但要按上表倍率付加班費，時數計入每月 46 小時上限。例假日原則上不能叫你上班，只有天災、事變或突發事件才可以，而且要加發 1 日工資並在事後給補假。</p>

  <h2>加班時數上限</h2>
  <p>每天正常工時加加班不得超過 12 小時；每月加班不得超過 46 小時。經工會或勞資會議同意，可以改成每月 54 小時、每 3 個月不超過 138 小時。國定假日出勤 8 小時以內的部分不計入上限。</p>

  <h2>可以用補休代替加班費嗎？</h2>
  <p>可以，但要勞工自己選擇，公司不能強制。補休時數要按加班時數 1 比 1 換算，補休期限由勞資雙方約定；期限到了或契約終止還沒休完，公司要按加班當時的工資標準發加班費。</p>`,
  faq: [
    ['月薪制加班費的時薪怎麼算？', '月薪 ÷ 30 ÷ 8，也就是月薪 ÷ 240。月薪 40,000 元的時薪基準是 166.67 元。'],
    ['平日加班費怎麼算？', '前 2 小時按時薪的 1⅓ 倍，第 3、4 小時按 1⅔ 倍。月薪 4 萬平日加班 2 小時，加班費約 444 元。'],
    ['休息日加班費怎麼算？', '前 2 小時 1⅓ 倍、第 3 到 8 小時 1⅔ 倍、第 9 到 12 小時 2⅔ 倍，依實際工作時數計算。月薪 4 萬休息日上班 8 小時，加班費約 2,111 元。'],
    ['國定假日上班有幾倍薪？', '8 小時以內加發 1 日工資，也就是當天領雙倍；超過 8 小時的部分，第 9、10 小時 1⅓ 倍，第 11、12 小時 1⅔ 倍。'],
    ['加班費要繳稅嗎？', '每月 46 小時上限以內的加班費（含休息日加班）免稅，超過上限的部分要併入薪資所得。'],
  ],
  related: `
  <h2>相關工具</h2>
  <ul class="tools">
    <li><a href="../">實領薪資試算</a>：月薪扣勞健保後實領多少</li>
    <li><a href="../minimum-wage/">2027 最低工資</a>：月薪 30,900 元、時薪 205 元</li>
    <li><a href="../annual-leave/">特休天數試算</a>：特休日出勤也要加倍給薪</li>
  </ul>`,
  footer: '資料來源：勞動基準法第 24、32、36、39、40 條，勞動部函釋。' + ZH_SRC,
}));
out.push(page({
  rel: 'en/overtime/', lang: 'en', alt: 'overtime/', navKey: 'en/overtime/',
  title: 'Taiwan Overtime Pay Calculator 2026 — Weekday, Rest Day and Holiday Rates',
  desc: 'Calculate overtime pay in Taiwan under Labor Standards Act Article 24: weekday overtime at 1⅓ and 1⅔, rest-day work at 1⅓, 1⅔ and 2⅔, national holiday work at double pay, and the 46-hour monthly cap.',
  badge: 'Labor Standards Act Art. 24', h1: 'Taiwan Overtime Pay Calculator', lede: 'Enter your salary and this month\'s overtime hours to see what your employer owes you. For monthly salaries the hourly base is salary ÷ 240.',
  scripts: ['calc.js', 'tax.js'], calc: fixOtIds(otForm(false)),
  body: `
  <h2>Overtime rates in Taiwan</h2>
${table(['Type', 'Hours', 'Rate', 'Per hour at NT$40,000/month'], [
    ['Weekday overtime', 'First 2 hours', '1⅓ (1.34)', f(h40 * 4 / 3)], ['', 'Hours 3–4', '1⅔ (1.67)', f(h40 * 5 / 3)],
    ['Rest day', 'First 2 hours', '1⅓', f(h40 * 4 / 3)], ['', 'Hours 3–8', '1⅔', f(h40 * 5 / 3)], ['', 'Hours 9–12', '2⅔ (2.67)', f(h40 * 8 / 3)],
    ['National holiday / annual leave day', 'Up to 8 hours', 'One extra day\'s wage', f(h40 * 8) + ' (whole day)'], ['', 'Hours 9–10', '1⅓', f(h40 * 4 / 3)], ['', 'Hours 11–12', '1⅔', f(h40 * 5 / 3)]])}
  <p>For a monthly salary, the hourly base is salary ÷ 30 ÷ 8, using regular pay only (base salary and fixed allowances, not bonuses).</p>
${ad2(false)}

  <h2>Rest day vs regular day off</h2>
  <p>Of the two days off each week, one is a <strong>regular day off</strong> (例假日) and one is a <strong>rest day</strong> (休息日). Your employer may ask you to work on the rest day if they pay the rates above, and those hours count toward the monthly cap. Work on a regular day off is only allowed for natural disasters or emergencies, with an extra day's wage and a compensatory day off.</p>

  <h2>Overtime limits</h2>
  <p>Normal hours plus overtime may not exceed 12 hours a day, and overtime may not exceed 46 hours a month. With union or labor-management meeting consent the cap can be 54 hours a month and 138 hours per 3 months.</p>

  <h2>Comp time instead of pay</h2>
  <p>You can choose time off instead of overtime pay, one hour for each hour worked, but your employer cannot force it. If the comp time is not used by the agreed deadline or when you leave, it must be paid out.</p>`,
  faq: [
    ['How is hourly pay calculated for overtime in Taiwan?', 'For a monthly salary, divide by 240 (30 days × 8 hours). A NT$40,000 salary gives an hourly base of NT$166.67.'],
    ['What is the weekday overtime rate in Taiwan?', 'The first 2 overtime hours are paid at 1⅓ times the hourly wage, and hours 3 and 4 at 1⅔ times.'],
    ['How much do you get for working on a national holiday in Taiwan?', 'Within 8 hours you receive one extra day\'s wage, so the day is paid double. Hours 9–10 are paid at 1⅓ and hours 11–12 at 1⅔.'],
    ['Is overtime pay taxed in Taiwan?', 'Overtime pay within the 46-hour monthly cap, including rest-day work, is tax-free. Pay for hours above the cap is taxed as salary.'],
  ],
  related: `
  <h2>More Taiwan tools</h2>
  <ul class="tools">
    <li><a href="../">Take-home pay calculator</a></li>
    <li><a href="../minimum-wage/">Taiwan minimum wage 2027</a></li>
    <li><a href="../foreigner-tax/">Tax calculator for foreigners</a></li>
  </ul>`,
  footer: 'Sources: Labor Standards Act Articles 24, 32, 36, 39 and 40; Ministry of Labor interpretations. ' + EN_SRC,
}));

// ===================== 3. 最低工資 =====================
const MW = [[2027, 30900, 205], [2026, 29500, 196], [2025, 28590, 190], [2024, 27470, 183], [2023, 26400, 176], [2022, 25250, 168], [2021, 24000, 160], [2020, 23800, 158]];
const mw26 = TW.calculate({ salary: 29500 });
// 2027 take-home: grade 30,900 is not in the 2026 table; use 2026 rates on the next grade up for an estimate.
const mw27 = TW.calculate({ salary: 30900 });
const mwRowsZh = MW.map(([y, m, h], i) => [y + (y === 2027 ? '（116 年）' : ` （${y - 1911} 年）`), f(m), f(h), i < MW.length - 1 ? '+' + ((m / MW[i + 1][1] - 1) * 100).toFixed(2) + '%' : '—']);
out.push(page({
  rel: 'minimum-wage/', lang: 'zh', alt: 'en/minimum-wage/', navKey: 'minimum-wage/',
  title: '2027 最低工資 30,900 元、時薪 205 元｜116 年、115 年基本工資與實領對照',
  desc: '2027 年（116 年）1 月 1 日起最低工資月薪 30,900 元、時薪 205 元，調幅 4.745%。附 2026 年 29,500 元、時薪 196 元的實領金額、歷年最低工資表與時薪換算。',
  badge: '116 年 1 月 1 日起', h1: '2027 最低工資：月薪 30,900 元、時薪 205 元',
  lede: '2027 年 1 月 1 日起，最低工資月薪從 29,500 元調到 <strong>30,900 元</strong>，時薪從 196 元調到 <strong>205 元</strong>，月薪漲 4.745%。',
  scripts: [],
  body: `
  <h2>2026 和 2027 最低工資對照</h2>
${table(['', '2026（115 年）', '2027（116 年）'], [
    ['月薪', '29,500', '30,900'], ['時薪', '196', '205'], ['調幅（月薪）', '+3.18%', '+4.745%'],
    ['每月實領（約）', f(mw26.monthlyTakeHome), f(mw27.monthlyTakeHome) + '*']])}
  <p>實領以無眷屬、不自提勞退計算。*2027 年的勞健保級距會隨最低工資調整，正式分級表公告前以 2026 年費率估算，公告後會更新。</p>

  <h2>歷年最低工資</h2>
${table(['年度', '月薪', '時薪', '月薪調幅'], mwRowsZh)}
${ad2(true)}

  <h2>時薪人員一個月可以領多少？</h2>
  <p>以 2027 年時薪 205 元計算：每天 8 小時、每月 22 天約 ${f(205 * 8 * 22)} 元；每天 4 小時、每月 22 天約 ${f(205 * 4 * 22)} 元。時薪人員的國定假日如果放假，雇主仍要照給當天工資；加班費一樣要依<a href="../overtime/">加班費倍率</a>計算。</p>

  <h2>最低工資包含哪些？</h2>
  <p>最低工資指勞工在正常工作時間內的報酬，不含延長工時（加班）工資，以及休息日、例假日、國定假日出勤加給的工資。伙食津貼、全勤獎金這類經常性給與可以算進去，但不能用年終、三節獎金這類非經常性給與來湊。</p>

  <h2>雇主沒照最低工資給怎麼辦？</h2>
  <p>可以向地方政府勞工局申訴。雇主違反最低工資規定，依法會被處以罰鍰並公布名稱，勞工也可以請求補發差額。</p>`,
  faq: [
    ['2027 年最低工資是多少？', '2027 年（民國 116 年）1 月 1 日起，最低工資月薪 30,900 元、時薪 205 元，月薪調幅 4.745%。'],
    ['2026 年最低工資是多少？', '2026 年（民國 115 年）最低工資月薪 29,500 元、時薪 196 元。'],
    ['最低工資月薪實領多少？', `2026 年月薪 29,500 元扣掉勞保 ${f(mw26.laborFee)} 元、健保 ${f(mw26.nhiFee)} 元，每月實領約 ${f(mw26.monthlyTakeHome)} 元。`],
    ['基本工資和最低工資一樣嗎？', '一樣。最低工資法在 2025 年施行後，原本勞基法的「基本工資」改稱「最低工資」，由最低工資審議會每年第三季審議。'],
  ],
  related: `
  <h2>相關工具</h2>
  <ul class="tools">
    <li><a href="../salary/30000/">月薪 3 萬實領多少</a></li>
    <li><a href="../overtime/">加班費試算</a></li>
    <li><a href="../insurance/">勞健保級距試算</a></li>
  </ul>`,
  footer: '資料來源：勞動部最低工資審議會決議、行政院核定（2026 年 9 月），<a href="https://news.pts.org.tw/article/828540">公視新聞報導</a>，最低工資法。' + ZH_SRC,
}));
out.push(page({
  rel: 'en/minimum-wage/', lang: 'en', alt: 'minimum-wage/', navKey: 'en/minimum-wage/',
  title: 'Taiwan Minimum Wage 2027: NT$30,900 a Month, NT$205 an Hour',
  desc: 'Taiwan\'s minimum wage rises to NT$30,900 a month and NT$205 an hour from January 1, 2027, up 4.745%. See the 2026 rate, take-home pay at minimum wage and the history since 2020.',
  badge: 'From January 1, 2027', h1: 'Taiwan Minimum Wage 2027',
  lede: 'From January 1, 2027 the monthly minimum wage rises from NT$29,500 to <strong>NT$30,900</strong> and the hourly minimum wage from NT$196 to <strong>NT$205</strong>.',
  scripts: [],
  body: `
  <h2>2026 vs 2027</h2>
${table(['', '2026', '2027'], [['Monthly', 'NT$29,500', 'NT$30,900'], ['Hourly', 'NT$196', 'NT$205'], ['Increase (monthly)', '+3.18%', '+4.745%'],
    ['Take-home per month (approx.)', 'NT$' + f(mw26.monthlyTakeHome), 'NT$' + f(mw27.monthlyTakeHome) + '*']])}
  <p>Take-home assumes no dependents and no voluntary pension contribution. *Estimated with 2026 insurance rates until the 2027 grade tables are published.</p>

  <h2>Minimum wage history</h2>
${table(['Year', 'Monthly (NT$)', 'Hourly (NT$)', 'Change'], MW.map(([y, m, h], i) => [y, f(m), f(h), i < MW.length - 1 ? '+' + ((m / MW[i + 1][1] - 1) * 100).toFixed(2) + '%' : '—']))}
${ad2(false)}

  <h2>Does it apply to foreigners?</h2>
  <p>Yes for foreign employees covered by the Labor Standards Act, including white-collar foreign professionals. Live-in caregivers and domestic helpers are not covered by the Labor Standards Act and have a separate minimum set by the Ministry of Labor.</p>

  <h2>What counts toward the minimum wage?</h2>
  <p>Pay for normal working hours, including regular allowances such as meal or attendance allowances. Overtime pay and holiday work premiums do not count, and neither do one-off bonuses.</p>`,
  faq: [
    ['What is the minimum wage in Taiwan in 2027?', 'From January 1, 2027 it is NT$30,900 a month and NT$205 an hour, a 4.745% rise on the monthly rate.'],
    ['What was the minimum wage in Taiwan in 2026?', 'NT$29,500 a month and NT$196 an hour.'],
    ['How much is take-home pay on Taiwan\'s minimum wage?', `On the 2026 minimum wage of NT$29,500, take-home pay is about NT$${f(mw26.monthlyTakeHome)} after Labor Insurance and NHI.`],
  ],
  related: `
  <h2>More Taiwan tools</h2>
  <ul class="tools">
    <li><a href="../">Take-home pay calculator</a></li>
    <li><a href="../overtime/">Overtime pay calculator</a></li>
    <li><a href="../cost-of-living/">Cost of living calculator</a></li>
  </ul>`,
  footer: 'Sources: Ministry of Labor Minimum Wage Review Committee decision approved by the Executive Yuan (September 2026), <a href="https://news.pts.org.tw/article/828540">PTS News</a>, Minimum Wage Act. ' + EN_SRC,
}));

// ===================== 5. 綜所稅 =====================
function taxForm(zh, foreign) {
  const t = zh ? { sal: '本人全年薪資', mar: '已婚（與配偶合併申報）', sp: '配偶全年薪資', oth: '其他所得（利息、股利、租金等）', dep: '扶養親屬人數（不含本人、配偶）', eld: '其中 70 歲以上人數（含本人、配偶）', item: '列舉扣除額（沒有就填 0）', rent: '房屋租金支出（全年）', tax: '應納綜所稅', net: '所得淨額', ex: '免稅額', de: '一般扣除額', sd: '薪資所得特別扣除額', rd: '房屋租金特別扣除額', mg: '邊際稅率', ef: '有效稅率', me: '計稅方式', mo: '平均每月' }
    : { sal: 'Your annual salary', mar: 'Married (joint return)', sp: 'Spouse annual salary', oth: 'Other income (interest, dividends, rent)', dep: 'Dependents (besides you and spouse)', eld: 'People aged 70+ (including you and spouse)', item: 'Itemized deductions (0 if none)', rent: 'Annual rent paid', tax: 'Income tax due', net: 'Net taxable income', ex: 'Exemptions', de: 'Standard / itemized deduction', sd: 'Salary special deduction', rd: 'Rent special deduction', mg: 'Marginal rate', ef: 'Effective rate', me: 'Method', mo: 'Per month' };
  const fp = foreign ? `
    <label class="check"><input id="tforeign" type="checkbox" checked> Foreign professional 50% exclusion above NT$3M</label>` : '';
  return `  <form id="tax-calc" class="card calc" autocomplete="off">
    <label for="tsalary">${t.sal}</label>
    <input id="tsalary" type="number" inputmode="numeric" min="0" step="10000" value="${foreign ? 4000000 : 600000}">
    <label class="check"><input id="tmarried" type="checkbox"> ${t.mar}</label>
    <div id="spouse-row" hidden><label for="tspouse">${t.sp}</label><input id="tspouse" type="number" inputmode="numeric" min="0" step="10000" value="0"></div>${fp}
    <div class="result" aria-live="polite">
      <div>${t.tax}</div>
      <div class="big" id="out-tax">—</div>
      <dl>
        <dt>${t.mo}</dt><dd id="out-monthly"></dd>
        <dt>${t.net}</dt><dd id="out-net"></dd>
        <dt>${t.mg}</dt><dd id="out-marginal"></dd>
        <dt>${t.ef}</dt><dd id="out-effective"></dd>${foreign ? `
        <dt>Salary excluded (50%)</dt><dd id="out-excluded"></dd>` : ''}
      </dl>
    </div>
    <details class="more">
      <summary>${zh ? '更多選項與計算明細' : 'More options and breakdown'}</summary>
      <label for="tother">${t.oth}</label>
      <input id="tother" type="number" inputmode="numeric" min="0" step="1000" value="0">
      <label for="tdeps">${t.dep}</label>
      <select id="tdeps"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
      <label for="telderly">${t.eld}</label>
      <select id="telderly"><option>0</option><option>1</option><option>2</option><option>3</option></select>
      <label for="titemized">${t.item}</label>
      <input id="titemized" type="number" inputmode="numeric" min="0" step="1000" value="0">
      <label for="trent">${t.rent}</label>
      <input id="trent" type="number" inputmode="numeric" min="0" step="1000" value="0">
      <dl>
        <dt>${t.ex}</dt><dd id="out-exempt"></dd>
        <dt>${t.de}</dt><dd id="out-deduct"></dd>
        <dt>${t.sd}</dt><dd id="out-saldeduct"></dd>
        <dt>${t.rd}</dt><dd id="out-rent"></dd>
        <dt>${t.me}</dt><dd id="out-method"></dd>
      </dl>
    </details>
  </form>`;
}
const TAXSAL = [400000, 500000, 600000, 800000, 1000000, 1200000, 1500000, 2000000, 3000000];
const taxRowsZh = TAXSAL.map((s) => { const r = T.incomeTax({ salary: s }); return [f(s), f(r.net), f(r.tax), (r.effective * 100).toFixed(1) + '%']; });
const tb = TW.RATES.tax;
const bracketRows = (zh) => tb.brackets.map(([u, r, d], i) => [(i ? f(tb.brackets[i - 1][0] + 1) : '0') + ' – ' + (u === Infinity ? (zh ? '以上' : 'and above') : f(u)), (r * 100) + '%', f(d)]);
const exemptAt = f(tb.exemption + tb.standardSingle + tb.salaryDeduction);
out.push(page({
  rel: 'income-tax/', lang: 'zh', alt: 'en/income-tax/', navKey: 'income-tax/',
  title: '2026 綜所稅試算｜115 年度所得稅怎麼算、免稅額、扣除額、稅率級距（2027 年 5 月報稅）',
  desc: '輸入全年薪資，算出 115 年度（2027 年 5 月申報）綜合所得稅要繳多少。免稅額 101,000 元、標準扣除額 136,000 元、薪資特別扣除額 227,000 元、房屋租金扣除額 18 萬，含夫妻薪資分開計稅比較。',
  badge: '115 年度 · 2027 年 5 月申報', h1: '2026 綜所稅試算', lede: `輸入全年薪資，算出 2027 年 5 月報稅時要繳多少綜所稅。單身只有薪資所得的人，全年薪資 ${exemptAt} 元以下不用繳稅。`,
  scripts: ['calc.js', 'tax.js'], calc: taxForm(true, false),
  body: `
  <h2>綜所稅怎麼算？</h2>
  <p>應納稅額 ＝ 所得淨額 × 稅率 − 累進差額。所得淨額 ＝ 全年所得 − 免稅額 − 一般扣除額（標準或列舉擇一）− 特別扣除額。</p>
  <h2>115 年度免稅額與扣除額</h2>
${table(['項目', '金額'], [['免稅額（每人）', f(tb.exemption) + ' 元；70 歲以上 ' + f(tb.exemption70) + ' 元'], ['標準扣除額', '單身 ' + f(tb.standardSingle) + ' 元；有配偶 ' + f(tb.standardMarried) + ' 元'],
    ['薪資所得特別扣除額', '每人最高 ' + f(tb.salaryDeduction) + ' 元'], ['身心障礙特別扣除額', '每人 227,000 元'], ['房屋租金支出特別扣除額', '每戶最高 180,000 元'], ['儲蓄投資特別扣除額', '每戶最高 270,000 元（利息）']])}
  <h2>115 年度稅率級距</h2>
${table(['所得淨額（元）', '稅率', '累進差額'], bracketRows(true))}
${ad2(true)}
  <h2>年薪對照：要繳多少稅？</h2>
  <p>（單身、無扶養、只有薪資所得、標準扣除額）</p>
${table(['全年薪資', '所得淨額', '應納稅額', '有效稅率'], taxRowsZh)}

  <h2>夫妻要合併還是分開算？</h2>
  <p>夫妻一定要合併申報，但可以選擇「薪資所得分開計稅」：配偶的薪資扣掉自己的免稅額和薪資特別扣除額後單獨算稅，其他所得再合併計算。兩人都有不錯收入時，分開計稅通常比較省。本工具會自動比較兩種方式，取比較低的那個。</p>

  <h2>房租可以扣多少？</h2>
  <p>從 113 年度起，房屋租金支出改為特別扣除額，每戶最高 18 萬元，不用再和標準扣除額二選一。條件是租屋自住、在台沒有自有房屋，而且沒有申報購屋借款利息。</p>

  <p>本工具沒有計算基本生活費差額、股利可抵減稅額和幼兒學前、長照等特別扣除額；扶養人數多或有這些項目的家庭，實際稅額可能更低，請以財政部報稅軟體為準。</p>`,
  faq: [
    ['年薪多少以下不用繳所得稅？', `單身、只有薪資所得時，全年薪資 ${exemptAt} 元以下不用繳稅（免稅額 ${f(tb.exemption)} ＋ 標準扣除額 ${f(tb.standardSingle)} ＋ 薪資特別扣除額 ${f(tb.salaryDeduction)}）。`],
    ['年薪 60 萬要繳多少稅？', `單身無扶養、標準扣除額時，所得淨額 ${f(T.incomeTax({ salary: 600000 }).net)} 元，115 年度綜所稅約 ${f(T.incomeTax({ salary: 600000 }).tax)} 元。`],
    ['年薪 100 萬要繳多少稅？', `單身無扶養、標準扣除額時，所得淨額 ${f(T.incomeTax({ salary: 1000000 }).net)} 元，115 年度綜所稅約 ${f(T.incomeTax({ salary: 1000000 }).tax)} 元，有效稅率 ${(T.incomeTax({ salary: 1000000 }).effective * 100).toFixed(1)}%。`],
    ['115 年度所得什麼時候報稅？', '2026 年（115 年度）的所得，在 2027 年 5 月 1 日到 5 月 31 日申報。'],
  ],
  related: `
  <h2>相關工具</h2>
  <ul class="tools">
    <li><a href="../year-end-bonus/">年終獎金試算</a>：年終會讓 5 月補多少稅</li>
    <li><a href="../">實領薪資試算</a>：月薪扣勞健保後實領多少</li>
    <li><a href="../en/foreigner-tax/" hreflang="en">外國人薪資稅務試算（英文）</a></li>
  </ul>`,
  footer: '資料來源：財政部 115 年度綜合所得稅免稅額、扣除額及課稅級距公告，所得稅法第 17 條。' + ZH_SRC,
}));
const taxRowsEn = TAXSAL.map((s) => { const r = T.incomeTax({ salary: s }); return ['NT$' + f(s), f(r.net), f(r.tax), (r.effective * 100).toFixed(1) + '%']; });
out.push(page({
  rel: 'en/income-tax/', lang: 'en', alt: 'income-tax/', navKey: 'en/income-tax/',
  title: 'Taiwan Income Tax Calculator 2026 — Brackets, Exemptions and Deductions (Filed May 2027)',
  desc: 'Calculate your Taiwan individual income tax for 2026 income, filed in May 2027. Uses the NT$101,000 exemption, NT$136,000 standard deduction, NT$227,000 salary deduction, rent deduction and the 5%–40% brackets.',
  badge: '2026 income · filed May 2027', h1: 'Taiwan Income Tax Calculator 2026', lede: `Enter your annual salary to estimate the tax due when you file in May 2027. A single resident with only salary income pays no tax on up to NT$${exemptAt} a year.`,
  scripts: ['calc.js', 'tax.js'], calc: taxForm(false, false),
  body: `
  <h2>How Taiwan income tax is calculated</h2>
  <p>Tax = net taxable income × rate − progressive difference. Net taxable income = total income − exemptions − standard or itemized deduction − special deductions. This applies to tax residents; non-residents are taxed at a flat 18% (see the <a href="../foreigner-tax/">foreigner tax calculator</a>).</p>
  <h2>2026 exemptions and deductions</h2>
${table(['Item', 'Amount'], [['Personal exemption', 'NT$' + f(tb.exemption) + ' per person (NT$' + f(tb.exemption70) + ' aged 70+)'], ['Standard deduction', 'NT$' + f(tb.standardSingle) + ' single, NT$' + f(tb.standardMarried) + ' married'],
    ['Salary special deduction', 'Up to NT$' + f(tb.salaryDeduction) + ' per earner'], ['Rent special deduction', 'Up to NT$180,000 per household'], ['Savings and investment deduction', 'Up to NT$270,000 (interest)']])}
  <h2>2026 tax brackets</h2>
${table(['Net taxable income (NT$)', 'Rate', 'Progressive difference'], bracketRows(false))}
${ad2(false)}
  <h2>Tax by annual salary</h2>
  <p>(Single, no dependents, salary only, standard deduction.)</p>
${table(['Annual salary', 'Net taxable', 'Tax due', 'Effective rate'], taxRowsEn)}

  <h2>Married couples</h2>
  <p>Spouses must file one return, but either spouse's salary can be taxed separately. The calculator compares both methods and uses the lower one.</p>`,
  faq: [
    ['How much income is tax-free in Taiwan?', `A single resident with only salary income pays no tax on up to NT$${exemptAt} a year for 2026 (exemption + standard deduction + salary deduction).`],
    ['What are the Taiwan income tax brackets for 2026?', '5% up to NT$610,000 of net taxable income, 12% up to NT$1,380,000, 20% up to NT$2,770,000, 30% up to NT$5,190,000 and 40% above.'],
    ['When do I file my 2026 Taiwan tax return?', 'Between May 1 and May 31, 2027. Foreigners leaving Taiwan for good must file before departure.'],
  ],
  related: `
  <h2>More Taiwan tools</h2>
  <ul class="tools">
    <li><a href="../foreigner-tax/">Tax calculator for foreigners</a>: 18% non-resident vs resident</li>
    <li><a href="../gold-card-tax/">Gold Card tax break calculator</a></li>
    <li><a href="../year-end-bonus/">Year-end bonus tax</a></li>
  </ul>`,
  footer: 'Sources: Ministry of Finance 2026 (ROC 115) exemption, deduction and bracket announcement; Income Tax Act Art. 17. ' + EN_SRC,
}));

// ===================== 6. Gold Card tax =====================
const gc = [3000000, 4000000, 5000000, 6000000, 8000000].map((s) => { const a = T.incomeTax({ salary: s }), b = T.incomeTax({ salary: s, foreignPro: true }); return ['NT$' + f(s), f(a.tax), f(b.tax), '<strong>' + f(a.tax - b.tax) + '</strong>']; });
const gc5 = T.incomeTax({ salary: 5000000 }).tax - T.incomeTax({ salary: 5000000, foreignPro: true }).tax;
out.push(page({
  rel: 'en/gold-card-tax/', lang: 'en', alt: null, navKey: '',
  title: 'Taiwan Gold Card Tax Break Calculator 2026 — 50% Exclusion Above NT$3 Million',
  desc: 'Estimate how much the Taiwan foreign professional tax break saves you: Employment Gold Card and special professional holders can exclude 50% of salary above NT$3 million for five years. Check eligibility, the 183-day rule and how to apply.',
  badge: 'Gold Card · 2026', h1: 'Taiwan Gold Card Tax Break Calculator',
  lede: `Gold Card holders earning over NT$3 million can exclude half of the excess from taxable income for up to five years. On a NT$5 million salary that saves about <strong>NT$${f(gc5)}</strong> a year.`,
  scripts: ['calc.js', 'tax.js'], calc: taxForm(false, true),
  body: `
  <h2>How the tax break works</h2>
  <p>Under Article 9 of the Act for the Recruitment and Employment of Foreign Professionals, a qualifying foreign special professional can exclude <strong>50% of salary above NT$3,000,000</strong> from taxable income. It applies for up to five tax years, starting from the first year the conditions are met.</p>
${table(['Annual salary', 'Tax without', 'Tax with break', 'You save (NT$)'], gc)}
  <p>(Single resident, no dependents, standard deduction, 2026 brackets.)</p>
${ad2(false)}

  <h2>Who qualifies?</h2>
  <ul>
    <li>You hold an Employment Gold Card, or a work permit as a foreign special professional (特定專業人才), and work for a Taiwan employer.</li>
    <li>It is your first approved residence in Taiwan for professional work, and you do not have Taiwan household registration. People who were Taiwan residents before may not qualify, so check with the National Taxation Bureau.</li>
    <li>You stay in Taiwan for 183 days or more in the tax year, so you are taxed as a resident.</li>
    <li>Your annual salary from that work is over NT$3 million.</li>
  </ul>
  <p>Not sure whether you are a resident? The <a href="../foreigner-tax/">foreigner tax calculator</a> explains the 183-day rule and the 18% non-resident rate.</p>

  <h2>How to claim it</h2>
  <p>Apply to the National Taxation Bureau when you file your annual return in May, attaching your work permit or Gold Card, proof of residence days and salary documents. Check the current forms with the bureau before filing.</p>

  <h2>Other Gold Card tax points</h2>
  <ul>
    <li>Overseas income is generally outside Taiwan's individual income tax, but may count toward the Alternative Minimum Tax if it exceeds NT$1 million and total basic income is above the AMT threshold.</li>
    <li>If you leave Taiwan before 183 days, salary is taxed at a flat 18% and the exclusion does not apply.</li>
  </ul>`,
  faq: [
    ['Does the Taiwan Gold Card reduce income tax?', 'Yes, if you are a tax resident earning over NT$3 million from Taiwan work: 50% of the salary above NT$3 million is excluded from taxable income for up to five years.'],
    ['How much does the Gold Card tax break save?', `Using 2026 brackets for a single resident, about NT$${f(gc5)} a year on a NT$5 million salary. Savings grow with salary because the excluded part would be taxed at 30% or 40%.`],
    ['Can I get the Gold Card tax break as a non-resident?', 'No. You must be in Taiwan for at least 183 days in the tax year. Non-residents pay a flat 18% on Taiwan salary.'],
  ],
  related: `
  <h2>More tools for living in Taiwan</h2>
  <ul class="tools">
    <li><a href="../foreigner-tax/">Tax calculator for foreigners</a></li>
    <li><a href="../income-tax/">Taiwan income tax calculator</a></li>
    <li><a href="../cost-of-living/">Cost of living calculator</a></li>
  </ul>`,
  footer: 'Sources: Act for the Recruitment and Employment of Foreign Professionals Art. 9; Income Tax Act Art. 7 and 17; Ministry of Finance 2026 bracket announcement. Not tax advice. ' + EN_SRC,
}));

fs.writeFileSync(path.join(__dirname, 'generated.json'), JSON.stringify(out, null, 1));
console.log(out.length + ' pages:\n' + out.join('\n'));
