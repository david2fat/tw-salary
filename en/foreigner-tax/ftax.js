/* Taiwan salary & income tax calculator for foreigners — 2026.
 * Depends on ../../calc.js (TWSalary) for insurance grades and resident brackets.
 * Non-resident rules: Income Tax Act art. 2 & 88, Withholding Rates Standards
 * (18% on salary; 6% when a payment is at or below 1.5x the minimum wage). */
(function (root) {
  'use strict';
  var TW = root.TWSalary || (typeof require !== 'undefined' ? require('../../calc.js') : null);
  var R = TW.RATES;
  var NONRES_LOW_LIMIT = Math.round(R.minWage * 1.5); // 44,250 in 2026
  var INCENTIVE_THRESHOLD = 3000000;

  function nonResRate(amount) { return amount <= NONRES_LOW_LIMIT ? 0.06 : 0.18; }

  /**
   * opts: { salary (monthly), months (1-12 paid in Taiwan this year), bonus (annual),
   *         resident (bool, 183+ days), married, taxDependents, nhiDependents, incentive (bool) }
   */
  function calculate(opts) {
    var salary = Math.max(0, Number(opts.salary) || 0);
    var months = Math.min(12, Math.max(1, opts.months | 0 || 12));
    var bonus = Math.max(0, Number(opts.bonus) || 0);

    var base = TW.calculate({ salary: salary, dependents: opts.nhiDependents | 0,
      pensionRate: 0, employmentIns: false, bonus: bonus });
    var insurance = base.laborFee + base.nhiFee; // monthly

    var gross = salary * months + bonus;

    // Non-resident: flat withholding, no exemptions or deductions, final tax.
    var nonResTax = Math.round(salary * nonResRate(salary)) * months
      + (bonus > 0 ? Math.round(bonus * nonResRate(bonus)) : 0);

    // Resident: progressive with exemptions and deductions.
    var taxable = gross;
    var incentiveSaving = 0;
    if (opts.incentive && taxable > INCENTIVE_THRESHOLD) {
      incentiveSaving = Math.round((taxable - INCENTIVE_THRESHOLD) * 0.5);
      taxable -= incentiveSaving;
    }
    var people = 1 + (opts.married ? 1 : 0) + Math.max(0, opts.taxDependents | 0);
    var net = taxable - Math.min(taxable, R.tax.salaryDeduction) - people * R.tax.exemption
      - (opts.married ? R.tax.standardMarried : R.tax.standardSingle);
    var resTax = TW.annualTax(net);

    var tax = opts.resident ? resTax : nonResTax;
    var annualInsurance = insurance * months + base.supplementary;
    return {
      salary: salary, months: months, bonus: bonus, gross: gross,
      laborFee: base.laborFee, nhiFee: base.nhiFee, insurance: insurance,
      supplementary: base.supplementary,
      nonResRate: nonResRate(salary),
      nonResMonthlyTax: Math.round(salary * nonResRate(salary)),
      nonResTax: nonResTax, resTax: resTax, netTaxable: Math.max(0, net),
      incentiveSaving: incentiveSaving,
      tax: tax,
      effectiveRate: gross > 0 ? tax / gross : 0,
      annualTakeHome: gross - annualInsurance - tax,
      monthlyTakeHome: opts.resident
        ? salary - insurance
        : salary - insurance - Math.round(salary * nonResRate(salary)),
      residencySaving: nonResTax - resTax
    };
  }

  var api = { calculate: calculate, NONRES_LOW_LIMIT: NONRES_LOW_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TWForeignTax = api;

  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('ftax');
    if (!form) return;
    var fmt = new Intl.NumberFormat('en');
    function $(id) { return document.getElementById(id); }
    function money(n) { return 'NT$ ' + fmt.format(Math.round(n)); }
    function update() {
      var resident = $('resident').value === 'yes';
      var r = calculate({
        salary: $('salary').value, months: $('months').value, bonus: $('bonus').value,
        resident: resident, married: $('married').checked,
        taxDependents: $('taxdeps').value, nhiDependents: $('nhideps').value,
        incentive: $('incentive').checked
      });
      $('out-monthly').textContent = money(r.monthlyTakeHome);
      $('out-monthly-note').textContent = resident
        ? 'after Labor Insurance & NHI (income tax settled yearly)'
        : 'after Labor Insurance, NHI and ' + (r.nonResRate * 100) + '% withholding';
      $('out-labor').textContent = money(r.laborFee);
      $('out-nhi').textContent = money(r.nhiFee);
      $('out-wh').textContent = resident ? 'Settled in May' : money(r.nonResMonthlyTax);
      $('out-gross').textContent = money(r.gross);
      $('out-tax').textContent = money(r.tax);
      $('out-eff').textContent = (r.effectiveRate * 100).toFixed(1) + '%';
      $('out-annual').textContent = money(r.annualTakeHome);
      $('cmp-nonres').textContent = money(r.nonResTax);
      $('cmp-res').textContent = money(r.resTax);
      var s = r.residencySaving;
      $('cmp-note').textContent = s > 0
        ? 'Reaching 183 days would cut your tax by ' + money(s) + ' this year.'
        : s < 0 ? 'At this income the flat non-resident rate is ' + money(-s) + ' lower than resident tax.'
          : 'Both methods give the same tax.';
      var hideInc = !(resident && r.incentiveSaving > 0);
      $('incentive-row').hidden = hideInc; $('out-incentive').hidden = hideInc;
      $('out-incentive').textContent = money(r.incentiveSaving);
    }
    form.addEventListener('input', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
    update();
  });
})(this);
