/* Taiwan labor calculators — year-end bonus, severance pay, annual leave (2026 / 民國115年).
 * Depends on calc.js (TWSalary) for insurance grades and income tax.
 * Sources: 勞動基準法 §16, §17, §38；勞工退休金條例 §12；就業保險法 §16, §19-1；
 *          財政部 115 年度薪資扣繳（非固定薪資 > 90,500 元扣 5%）；健保補充保費 2.11%. */
(function (root) {
  'use strict';

  var TW = root.TWSalary || (typeof require === 'function' ? require('./calc.js') : null);

  var RULES = {
    bonusWithholdThreshold: 90500, // single non-regular payment above this → 5% withheld
    bonusWithholdRate: 0.05,
    pensionNewSystemStart: '2005-07-01',
    newSeveranceCap: 6,            // months of average wage (勞退條例 §12)
    employmentInsMax: 45800,
    unemploymentRate: 0.6,
    unemploymentDependentRate: 0.1,
    unemploymentMaxDependents: 2
  };

  // ---------- Date helpers (all UTC, YYYY-MM-DD) ----------
  function parseDate(s) {
    if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d) ? null : d;
  }
  function fmtDate(d) { return d.toISOString().slice(0, 10); }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function addMonths(d, n) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m))));
  }
  function dayDiff(a, b) { return Math.round((b - a) / 86400000); }

  // Elapsed years/months/days from a to b (b exclusive).
  function diffYMD(a, b) {
    if (b <= a) return { y: 0, m: 0, d: 0 };
    var y = b.getUTCFullYear() - a.getUTCFullYear();
    var m = b.getUTCMonth() - a.getUTCMonth();
    var d = b.getUTCDate() - a.getUTCDate();
    if (d < 0) {
      m--;
      var pm = b.getUTCMonth() - 1, py = b.getUTCFullYear();
      if (pm < 0) { pm = 11; py--; }
      d += daysInMonth(py, pm);
    }
    if (m < 0) { y--; m += 12; }
    return { y: y, m: m, d: d };
  }
  // Months for severance: a partial month counts as a full month (勞基法 §17).
  function severanceMonths(p) { return p.y * 12 + p.m + (p.d > 0 ? 1 : 0); }

  // ---------- Annual leave (勞基法 §38) ----------
  // Days for the year that starts when seniority reaches `months` completed months.
  function leaveDaysAt(months) {
    if (months < 6) return 0;
    if (months < 12) return 3;
    if (months < 24) return 7;
    if (months < 36) return 10;
    if (months < 60) return 14;
    if (months < 120) return 15;
    return Math.min(30, 15 + Math.floor(months / 12) - 9);
  }

  // Anniversary-based entitlement periods: [{start, end (exclusive), days, label}]
  function leavePeriods(hire, untilYear) {
    var out = [{ start: addMonths(hire, 6), end: addMonths(hire, 12), days: 3, years: 0.5 }];
    for (var n = 1; ; n++) {
      var s = addMonths(hire, 12 * n);
      if (s.getUTCFullYear() > untilYear) break;
      out.push({ start: s, end: addMonths(hire, 12 * (n + 1)), days: leaveDaysAt(12 * n), years: n });
    }
    return out;
  }

  /**
   * opts: { hire: 'YYYY-MM-DD', asOf: 'YYYY-MM-DD', year (calendar year for 曆年制),
   *         monthlyWage, unusedDays }
   */
  function calcLeave(opts) {
    var hire = parseDate(opts.hire), asOf = parseDate(opts.asOf) || parseDate(new Date());
    if (!hire) return null;
    var year = (opts.year | 0) || asOf.getUTCFullYear();
    var seniority = diffYMD(hire, asOf);
    var months = seniority.y * 12 + seniority.m;
    var periods = leavePeriods(hire, Math.max(year, asOf.getUTCFullYear()) + 1);

    // Anniversary system: the period containing asOf
    var current = null, next = null;
    for (var i = 0; i < periods.length; i++) {
      if (asOf >= periods[i].start && asOf < periods[i].end) { current = periods[i]; next = periods[i + 1] || null; break; }
      if (asOf < periods[i].start && !next) { next = periods[i]; }
    }

    // Calendar-year system: prorate each anniversary period by its overlap with the year
    var ys = new Date(Date.UTC(year, 0, 1)), ye = new Date(Date.UTC(year + 1, 0, 1));
    var calendarDays = 0, parts = [];
    periods.forEach(function (p) {
      var s = p.start > ys ? p.start : ys, e = p.end < ye ? p.end : ye;
      if (e <= s) return;
      var share = p.days * dayDiff(s, e) / dayDiff(p.start, p.end);
      calendarDays += share;
      parts.push({ from: fmtDate(s), to: fmtDate(addDays(e, -1)), days: p.days, share: share });
    });

    var wage = Math.max(0, Number(opts.monthlyWage) || 0);
    var unused = Math.max(0, Number(opts.unusedDays) || 0);
    var dailyWage = wage / 30;

    return {
      seniority: seniority, seniorityMonths: months,
      currentDays: current ? current.days : 0,
      currentStart: current ? fmtDate(current.start) : null,
      currentEnd: current ? fmtDate(addDays(current.end, -1)) : null,
      nextDays: next ? next.days : null,
      nextStart: next ? fmtDate(next.start) : null,
      calendarYear: year,
      calendarDays: Math.round(calendarDays * 100) / 100,
      calendarParts: parts,
      dailyWage: Math.round(dailyWage),
      unusedPay: Math.round(dailyWage * unused)
    };
  }

  // ---------- Severance (勞基法 §16, §17；勞退條例 §12) ----------
  function noticeDays(totalMonths) {
    if (totalMonths < 3) return 0;
    if (totalMonths < 12) return 10;
    if (totalMonths < 36) return 20;
    return 30;
  }

  /**
   * opts: { start, end (last day of work, inclusive), wage (average monthly wage),
   *         system: 'new' | 'old' (old = LSA Art. 17 for all service; new splits at 2005-07-01),
   *         noNotice (employer did not give advance notice), age, dependents }
   */
  function calcSeverance(opts) {
    var start = parseDate(opts.start), end = parseDate(opts.end);
    if (!start || !end || end < start) return null;
    var endEx = addDays(end, 1);
    var cut = parseDate(RULES.pensionNewSystemStart);
    var wage = Math.max(0, Number(opts.wage) || 0);

    var oldP = null, newP = null;
    if (opts.system === 'old') oldP = diffYMD(start, endEx);
    else if (start >= cut) newP = diffYMD(start, endEx);
    else {
      oldP = diffYMD(start, endEx < cut ? endEx : cut);
      if (endEx > cut) newP = diffYMD(cut, endEx);
    }

    var oldMonths = oldP ? severanceMonths(oldP) : 0;
    var newMonths = newP ? severanceMonths(newP) : 0;
    var oldBase = oldMonths / 12;                 // 1 month of wage per year
    var newRaw = newMonths / 12 * 0.5;            // 0.5 month per year
    var newBase = Math.min(RULES.newSeveranceCap, newRaw);
    var severance = Math.round(wage * (oldBase + newBase));

    var total = diffYMD(start, endEx);
    var totalMonths = total.y * 12 + total.m;
    var nDays = noticeDays(totalMonths);
    var noticePay = opts.noNotice ? Math.round(wage / 30 * nDays) : 0;

    // 失業給付 estimate (requires ≥1 year of employment insurance in the last 3 years)
    var insured = TW ? TW.grade(wage, RULES.employmentInsMax) : Math.min(wage, RULES.employmentInsMax);
    var deps = Math.min(Math.max(0, opts.dependents | 0), RULES.unemploymentMaxDependents);
    var uMonthly = Math.round(insured * (RULES.unemploymentRate + deps * RULES.unemploymentDependentRate));
    var uMonths = (Number(opts.age) || 0) >= 45 ? 9 : 6;

    return {
      seniority: total, oldPart: oldP, newPart: newP,
      oldMonths: oldMonths, newMonths: newMonths,
      oldBase: oldBase, newBase: newBase, capped: newRaw > RULES.newSeveranceCap,
      severanceMonthsOfWage: Math.round((oldBase + newBase) * 1000) / 1000,
      severance: severance,
      noticeDays: nDays, noticePay: noticePay,
      total: severance + noticePay,
      unemploymentInsured: insured, unemploymentMonthly: uMonthly, unemploymentMonths: uMonths,
      unemploymentTotal: uMonthly * uMonths,
      mixed: !!(oldP && newP)
    };
  }

  // ---------- Year-end bonus (扣繳 5% + 二代健保補充保費 + 年度綜所稅影響) ----------
  /**
   * opts: { salary, bonus, otherBonus (already received this year), married, taxDependents }
   */
  function calcBonus(opts) {
    var salary = Math.max(0, Number(opts.salary) || 0);
    var bonus = Math.max(0, Number(opts.bonus) || 0);
    var other = Math.max(0, Number(opts.otherBonus) || 0);

    var withholding = bonus > RULES.bonusWithholdThreshold ? Math.round(bonus * RULES.bonusWithholdRate) : 0;
    var nhiGrade = TW.grade(salary, TW.GRADES[TW.GRADES.length - 1]);
    var threshold = nhiGrade * 4;
    var suppBase = Math.max(0, other + bonus - Math.max(threshold, other));
    var supplementary = Math.round(suppBase * TW.RATES.nhi.supplementary);

    var base = { salary: salary, married: !!opts.married, taxDependents: opts.taxDependents | 0, employmentIns: true };
    var without = TW.calculate(Object.assign({}, base, { bonus: other }));
    var withB = TW.calculate(Object.assign({}, base, { bonus: other + bonus }));
    var taxIncrease = withB.annualTax - without.annualTax;

    return {
      bonus: bonus, months: salary > 0 ? bonus / salary : 0,
      withholding: withholding, supplementary: supplementary,
      suppThreshold: threshold, suppBase: suppBase, nhiGrade: nhiGrade,
      net: bonus - withholding - supplementary,
      taxIncrease: taxIncrease,
      settle: taxIncrease - withholding, // >0 pay more in May, <0 refund
      trueNet: bonus - supplementary - taxIncrease
    };
  }

  var api = { RULES: RULES, parseDate: parseDate, diffYMD: diffYMD, leaveDaysAt: leaveDaysAt,
    calcLeave: calcLeave, calcSeverance: calcSeverance, calcBonus: calcBonus, noticeDays: noticeDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TWLabor = api;

  // ---------- Browser UI ----------
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var zh = /^zh/i.test(document.documentElement.lang);
    var fmt = new Intl.NumberFormat(zh ? 'zh-TW' : 'en');
    function $(id) { return document.getElementById(id); }
    function money(n) { return (n < 0 ? '−' : '') + 'NT$ ' + fmt.format(Math.abs(Math.round(n))); }
    function set(id, v) { var el = $(id); if (el) el.textContent = v; }
    function ymd(p) {
      if (!p) return '—';
      return zh ? p.y + ' 年 ' + p.m + ' 個月 ' + p.d + ' 天'
        : p.y + ' yr ' + p.m + ' mo ' + p.d + ' d';
    }
    function today() { var d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10); }
    function remember(key, ids) {
      try {
        var saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved) ids.forEach(function (id) { if (saved[id] != null && $(id)) $(id).value = saved[id]; });
      } catch (e) {}
      return function () {
        try { var o = {}; ids.forEach(function (id) { o[id] = $(id).value; }); localStorage.setItem(key, JSON.stringify(o)); } catch (e) {}
      };
    }
    function wire(form, update) {
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
      update();
    }

    // Year-end bonus
    var bf = $('bonus-calc');
    if (bf) {
      var saveB = remember('twbonus', ['salary', 'bmonths']);
      var syncing = false;
      $('bmonths').addEventListener('input', function () {
        syncing = true; $('bamount').value = Math.round(($('salary').value || 0) * ($('bmonths').value || 0)); syncing = false;
      });
      $('salary').addEventListener('input', function () {
        $('bamount').value = Math.round(($('salary').value || 0) * ($('bmonths').value || 0));
      });
      $('bamount').addEventListener('input', function () {
        if (syncing) return;
        var s = Number($('salary').value) || 0;
        $('bmonths').value = s ? Math.round($('bamount').value / s * 100) / 100 : 0;
      });
      $('bamount').value = Math.round(($('salary').value || 0) * ($('bmonths').value || 0));
      wire(bf, function () {
        var r = calcBonus({ salary: $('salary').value, bonus: $('bamount').value, otherBonus: $('bother').value,
          married: $('married').checked, taxDependents: $('taxdeps').value });
        set('out-net', money(r.net));
        set('out-wh', money(r.withholding));
        set('out-supp', money(r.supplementary));
        set('out-supp-th', money(r.suppThreshold));
        set('out-taxinc', money(r.taxIncrease));
        set('out-settle', r.settle > 0 ? (zh ? '補繳 ' : 'Pay ') + money(r.settle)
          : r.settle < 0 ? (zh ? '退稅 ' : 'Refund ') + money(-r.settle) : money(0));
        set('out-truenet', money(r.trueNet));
        var pct = r.bonus > 0 ? Math.max(0, r.net / r.bonus * 100) : 0;
        $('bar-take').style.width = pct.toFixed(1) + '%';
        set('out-pct', pct.toFixed(1) + '%');
        saveB();
      });
    }

    // Severance
    var sf = $('sev-calc');
    if (sf) {
      if (!$('send').value) $('send').value = today();
      var saveS = remember('twsev', ['sstart', 'swage']);
      wire(sf, function () {
        var r = calcSeverance({ start: $('sstart').value, end: $('send').value, wage: $('swage').value,
          system: $('ssystem').value, noNotice: $('snotice').checked, age: $('sage').value, dependents: $('sdeps').value });
        $('sev-err').hidden = !!r;
        if (!r) { set('out-sev', '—'); return; }
        set('out-sev', money(r.severance));
        set('out-sev-months', (zh ? '相當於 ' : '= ') + r.severanceMonthsOfWage.toFixed(2) + (zh ? ' 個月平均工資' : ' months of average wage'));
        set('out-seniority', ymd(r.seniority));
        $('row-old').hidden = $('row-old-dd').hidden = !r.oldPart;
        $('row-new').hidden = $('row-new-dd').hidden = !r.newPart;
        set('out-old-sen', ymd(r.oldPart));
        set('out-new-sen', ymd(r.newPart));
        set('out-old', r.oldBase.toFixed(2) + (zh ? ' 個月' : ' mo'));
        set('out-new', r.newBase.toFixed(2) + (zh ? ' 個月' : ' mo') + (r.capped ? (zh ? '（上限）' : ' (cap)') : ''));
        set('out-notice-days', r.noticeDays + (zh ? ' 天' : ' days'));
        set('out-notice', money(r.noticePay));
        set('out-total', money(r.total));
        set('out-u-monthly', money(r.unemploymentMonthly));
        set('out-u-months', r.unemploymentMonths + (zh ? ' 個月' : ' months'));
        set('out-u-total', money(r.unemploymentTotal));
        saveS();
      });
    }

    // Annual leave
    var lf = $('leave-calc');
    if (lf) {
      if (!$('lasof').value) $('lasof').value = today();
      if (!$('lyear').value) $('lyear').value = new Date().getFullYear();
      var saveL = remember('twleave', ['lhire', 'lwage']);
      wire(lf, function () {
        var r = calcLeave({ hire: $('lhire').value, asOf: $('lasof').value, year: $('lyear').value,
          monthlyWage: $('lwage').value, unusedDays: $('lunused').value });
        if (!r) { set('out-days', '—'); return; }
        set('out-days', r.currentDays + (zh ? ' 天' : ' days'));
        set('out-period', r.currentStart ? (zh ? '適用期間 ' : 'For ') + r.currentStart + ' ~ ' + r.currentEnd
          : (zh ? '年資未滿 6 個月，尚無特休' : 'Less than 6 months of service: no annual leave yet'));
        set('out-lsen', ymd(r.seniority));
        set('out-next', r.nextStart ? r.nextStart + (zh ? ' 起 ' : ' → ') + r.nextDays + (zh ? ' 天' : ' days') : '—');
        set('out-cal-label', zh ? r.calendarYear + ' 年（曆年制）' : r.calendarYear + ' (calendar-year system)');
        set('out-cal', (Math.round(r.calendarDays * 10) / 10) + (zh ? ' 天' : ' days'));
        set('out-daily', money(r.dailyWage));
        set('out-unused', money(r.unusedPay));
        var tb = $('cal-parts');
        if (tb) {
          tb.innerHTML = '';
          r.calendarParts.forEach(function (p) {
            var tr = document.createElement('tr');
            [p.from + ' ~ ' + p.to, p.days, (Math.round(p.share * 100) / 100)].forEach(function (v) {
              var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
            });
            tb.appendChild(tr);
          });
        }
        saveL();
      });
    }
  });
})(this);
