/* Taiwan income tax (綜合所得稅) and overtime pay calculators — 2026 income year (民國115年度, filed May 2027).
 * Depends on calc.js (TWSalary) for tax parameters.
 * Overtime: 勞動基準法第 24、39、40 條。 */
(function (root) {
  'use strict';
  var TW = root.TWSalary || (typeof require === 'function' ? require('./calc.js') : null);
  var T = TW.RATES.tax;
  var RULES = { rentMax: 180000, foreignProThreshold: 3000000, foreignProShare: 0.5 };

  function n(v) { return Math.max(0, Number(v) || 0); }

  function bracketOf(net) {
    if (net <= 0) return 0;
    for (var i = 0; i < T.brackets.length; i++) if (net <= T.brackets[i][0]) return T.brackets[i][1];
    return T.brackets[T.brackets.length - 1][1];
  }

  /**
   * opts: { salary (annual), spouseSalary, otherIncome, married, dependents (besides you and spouse),
   *         elderly (people aged 70+ among those counted), itemized (0 = use standard), rent,
   *         foreignPro (bool: 外國特定專業人才 50% exclusion of salary above NT$3M) }
   */
  function incomeTax(opts) {
    var married = !!opts.married;
    var salary = n(opts.salary), spouse = married ? n(opts.spouseSalary) : 0, other = n(opts.otherIncome);
    var excluded = 0;
    if (opts.foreignPro && salary > RULES.foreignProThreshold) {
      excluded = Math.round((salary - RULES.foreignProThreshold) * RULES.foreignProShare);
    }
    var taxSalary = salary - excluded;
    var people = 1 + (married ? 1 : 0) + (n(opts.dependents) | 0);
    var elderly = Math.min(n(opts.elderly) | 0, people);
    var exemptions = people * T.exemption + elderly * (T.exemption70 - T.exemption);
    var standard = married ? T.standardMarried : T.standardSingle;
    var itemized = n(opts.itemized);
    var deduction = Math.max(standard, itemized);
    var rent = Math.min(n(opts.rent), RULES.rentMax);
    var salDed = Math.min(taxSalary, T.salaryDeduction), spouseDed = Math.min(spouse, T.salaryDeduction);

    var gross = taxSalary + spouse + other;
    var jointNet = Math.max(0, gross - salDed - spouseDed - exemptions - deduction - rent);
    var jointTax = TW.annualTax(jointNet);
    var method = 'joint', tax = jointTax, net = jointNet;

    if (married && spouse > 0) {
      // 薪資所得分開計稅：配偶薪資扣除自己的免稅額與薪資特別扣除額後單獨計稅
      var spouseNet = Math.max(0, spouse - spouseDed - T.exemption);
      var restNet = Math.max(0, taxSalary + other - salDed - (exemptions - T.exemption) - deduction - rent);
      var sepTax = TW.annualTax(spouseNet) + TW.annualTax(restNet);
      if (sepTax < jointTax) { method = 'separate'; tax = sepTax; net = restNet + spouseNet; }
    }
    return {
      gross: gross, excluded: excluded, exemptions: exemptions, deduction: deduction, deductionType: itemized > standard ? 'itemized' : 'standard',
      salaryDeduction: salDed + spouseDed, rent: rent, net: net, tax: tax, method: method,
      marginal: bracketOf(jointNet), effective: gross > 0 ? tax / (salary + spouse + other) : 0
    };
  }

  // ---------- Overtime ----------
  var OT = { weekday: [[2, 4 / 3], [2, 5 / 3]], restDay: [[2, 4 / 3], [6, 5 / 3], [4, 8 / 3]], holidayExtra: [[2, 4 / 3], [2, 5 / 3]] };
  function tiered(h, tiers) {
    var pay = 0, left = Math.max(0, h);
    for (var i = 0; i < tiers.length && left > 0; i++) { var t = Math.min(left, tiers[i][0]); pay += t * tiers[i][1]; left -= t; }
    return pay;
  }
  /** opts: { monthly | hourly, weekdayHours, weekdayDays, restHours, restDays, holidayHours, holidayDays } */
  function overtime(opts) {
    var hourly = n(opts.hourly) || n(opts.monthly) / 240;
    var wd = Math.min(n(opts.weekdayHours), 4), rd = Math.min(n(opts.restHours), 12), hd = Math.min(n(opts.holidayHours), 12);
    var weekday = tiered(wd, OT.weekday) * hourly * n(opts.weekdayDays);
    var rest = tiered(rd, OT.restDay) * hourly * n(opts.restDays);
    var holiday = (hd > 0 ? hourly * 8 + tiered(hd - 8, OT.holidayExtra) * hourly : 0) * n(opts.holidayDays);
    var hours = wd * n(opts.weekdayDays) + rd * n(opts.restDays) + Math.max(0, hd - 8) * n(opts.holidayDays);
    return { hourly: hourly, weekday: Math.round(weekday), rest: Math.round(rest), holiday: Math.round(holiday),
      total: Math.round(weekday + rest + holiday), countedHours: hours, overCap: hours > 46 };
  }

  var api = { RULES: RULES, incomeTax: incomeTax, overtime: overtime, tiered: tiered, OT: OT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TWTax = api;

  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var fmt = new Intl.NumberFormat(document.documentElement.lang || 'zh-TW');
    function $(id) { return document.getElementById(id); }
    function money(v) { return 'NT$ ' + fmt.format(Math.round(v)); }
    function set(id, v) { var el = $(id); if (el) el.textContent = v; }
    function val(id) { var el = $(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : 0; }
    function wire(form, fn) {
      form.addEventListener('input', fn); form.addEventListener('change', fn);
      form.addEventListener('submit', function (e) { e.preventDefault(); fn(); }); fn();
    }
    var en = (document.documentElement.lang || '').indexOf('en') === 0;

    var tf = $('tax-calc');
    if (tf) wire(tf, function () {
      var married = val('tmarried');
      if ($('spouse-row')) $('spouse-row').hidden = !married;
      var r = incomeTax({ salary: val('tsalary'), spouseSalary: val('tspouse'), otherIncome: val('tother'), married: married,
        dependents: val('tdeps'), elderly: val('telderly'), itemized: val('titemized'), rent: val('trent'), foreignPro: val('tforeign') });
      set('out-tax', money(r.tax));
      set('out-net', money(r.net));
      set('out-exempt', money(r.exemptions));
      set('out-deduct', money(r.deduction) + (en ? (r.deductionType === 'itemized' ? ' (itemized)' : ' (standard)') : (r.deductionType === 'itemized' ? '（列舉）' : '（標準）')));
      set('out-saldeduct', money(r.salaryDeduction));
      set('out-rent', money(r.rent));
      set('out-marginal', Math.round(r.marginal * 100) + '%');
      set('out-effective', (r.effective * 100).toFixed(2) + '%');
      set('out-method', r.method === 'separate' ? (en ? 'Spouse salary taxed separately' : '配偶薪資分開計稅') : (en ? 'Joint calculation' : '合併計稅'));
      if ($('out-excluded')) set('out-excluded', money(r.excluded));
      if ($('out-monthly')) set('out-monthly', money(r.tax / 12));
    });

    var of = $('ot-calc');
    if (of) wire(of, function () {
      var mode = val('omode');
      var r = overtime({ monthly: mode === 'monthly' ? val('owage') : 0, hourly: mode === 'hourly' ? val('owage') : 0,
        weekdayHours: val('owh'), weekdayDays: val('owd'), restHours: val('orh'), restDays: val('ord'),
        holidayHours: val('ohh'), holidayDays: val('ohd') });
      set('out-total', money(r.total));
      set('out-hourly', 'NT$ ' + fmt.format(Math.round(r.hourly * 100) / 100));
      set('out-weekday', money(r.weekday));
      set('out-rest', money(r.rest));
      set('out-holiday', money(r.holiday));
      set('out-hours', fmt.format(r.countedHours));
      if ($('warn-cap')) $('warn-cap').hidden = !r.overCap;
    });
  });
})(this);
