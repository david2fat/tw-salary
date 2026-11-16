/* Taiwan take-home salary calculator — 2026 (民國115年) parameters.
 * Sources: 勞動部勞工保險局、衛福部中央健康保險署、財政部 115 年度綜所稅公告.
 * Update RATES each year. */
(function (root) {
  'use strict';

  var RATES = {
    year: 2026,
    minWage: 29500,
    labor: { ordinary: 0.115, employment: 0.01, employeeShare: 0.2, max: 45800 },
    nhi: { rate: 0.0517, employeeShare: 0.3, maxDependents: 3, supplementary: 0.0211 },
    pensionMax: 150000,
    tax: {
      exemption: 101000,
      exemption70: 151500,
      standardSingle: 136000,
      standardMarried: 272000,
      salaryDeduction: 227000,
      // [upper bound of net taxable income, rate, progressive difference]
      brackets: [
        [610000, 0.05, 0],
        [1380000, 0.12, 42700],
        [2770000, 0.20, 153100],
        [5190000, 0.30, 430100],
        [Infinity, 0.40, 949100]
      ]
    }
  };

  // 健保投保金額分級表 (also used for 勞保 / 勞退 up to each table's cap)
  var GRADES = [29500, 30300, 31800, 33300, 34800, 36300, 38200, 40100, 42000, 43900, 45800,
    48200, 50600, 53000, 55400, 57800, 60800, 63800, 66800, 69800, 72800, 76500, 80200, 83900,
    87600, 92100, 96600, 101100, 105600, 110100, 115500, 120900, 126300, 131700, 137100, 142500,
    147900, 150000, 156400, 162800, 169200, 175600, 182000, 189500, 197000, 204500, 212000,
    219500, 228200, 236900, 245600, 254300, 263000, 273000, 283000, 293000, 303000, 313000];

  // Smallest grade >= salary, capped at `cap`.
  function grade(salary, cap) {
    for (var i = 0; i < GRADES.length; i++) {
      var g = GRADES[i];
      if (g > cap) return cap;
      if (salary <= g) return g;
    }
    return Math.min(GRADES[GRADES.length - 1], cap);
  }

  function annualTax(netIncome) {
    if (netIncome <= 0) return 0;
    var b = RATES.tax.brackets;
    for (var i = 0; i < b.length; i++) {
      if (netIncome <= b[i][0]) return Math.max(0, Math.round(netIncome * b[i][1] - b[i][2]));
    }
    return 0;
  }

  /**
   * opts: { salary, dependents (0-3+), pensionRate (0-0.06), employmentIns (bool),
   *         bonus (annual, NT$), married (bool), taxDependents (people besides you) }
   */
  function calculate(opts) {
    var r = RATES;
    var salary = Math.max(0, Number(opts.salary) || 0);
    var deps = Math.min(Math.max(0, opts.dependents | 0), r.nhi.maxDependents);
    var pensionRate = Math.min(Math.max(0, Number(opts.pensionRate) || 0), 0.06);
    var bonus = Math.max(0, Number(opts.bonus) || 0);

    var laborGrade = grade(salary, r.labor.max);
    var nhiGrade = grade(salary, GRADES[GRADES.length - 1]);
    var pensionGrade = grade(salary, r.pensionMax);

    var laborOrdinary = Math.round(laborGrade * r.labor.ordinary * r.labor.employeeShare);
    var laborEmployment = opts.employmentIns === false ? 0
      : Math.round(laborGrade * r.labor.employment * r.labor.employeeShare);
    var laborFee = laborOrdinary + laborEmployment;
    var nhiPerPerson = Math.round(nhiGrade * r.nhi.rate * r.nhi.employeeShare);
    var nhiFee = nhiPerPerson * (1 + deps);
    var pensionSelf = Math.round(pensionGrade * pensionRate);
    var pensionEmployer = Math.round(pensionGrade * 0.06);

    var monthlyTakeHome = salary - laborFee - nhiFee - pensionSelf;

    // 二代健保補充保費: bonus exceeding 4x insured amount (annual accumulation)
    var bonusThreshold = nhiGrade * 4;
    var supplementary = bonus > bonusThreshold
      ? Math.round((bonus - bonusThreshold) * r.nhi.supplementary) : 0;

    // Annual income tax estimate (filed the following May)
    var annualSalary = salary * 12 + bonus;
    var taxableSalary = Math.max(0, annualSalary - pensionSelf * 12);
    var salaryDed = Math.min(taxableSalary, r.tax.salaryDeduction);
    var people = 1 + (opts.married ? 1 : 0) + Math.max(0, opts.taxDependents | 0);
    var exemptions = people * r.tax.exemption;
    var standard = opts.married ? r.tax.standardMarried : r.tax.standardSingle;
    var netIncome = taxableSalary - salaryDed - exemptions - standard;
    var tax = annualTax(netIncome);

    return {
      salary: salary,
      laborGrade: laborGrade, nhiGrade: nhiGrade, pensionGrade: pensionGrade,
      laborFee: laborFee, laborEmployment: laborEmployment, nhiFee: nhiFee, nhiPerPerson: nhiPerPerson,
      pensionSelf: pensionSelf, pensionEmployer: pensionEmployer,
      monthlyTakeHome: monthlyTakeHome,
      supplementary: supplementary,
      annualSalary: annualSalary, netIncome: Math.max(0, netIncome), annualTax: tax,
      annualTakeHome: monthlyTakeHome * 12 + bonus - supplementary - tax,
      belowMinWage: salary > 0 && salary < r.minWage
    };
  }

  var api = { RATES: RATES, GRADES: GRADES, grade: grade, annualTax: annualTax, calculate: calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TWSalary = api;

  // ---- Browser UI wiring ----
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('calc');
    if (!form) return;
    var fmt = new Intl.NumberFormat(document.documentElement.lang || 'zh-TW');
    function $(id) { return document.getElementById(id); }
    function money(n) { return 'NT$ ' + fmt.format(n); }

    function update() {
      var res = calculate({
        salary: $('salary').value,
        dependents: $('dependents').value,
        pensionRate: Number($('pension').value) / 100,
        employmentIns: $('employment').checked,
        bonus: $('bonus').value,
        married: $('married').checked,
        taxDependents: $('taxdeps').value
      });
      $('out-takehome').textContent = money(res.monthlyTakeHome);
      $('out-labor').textContent = money(res.laborFee);
      $('out-nhi').textContent = money(res.nhiFee);
      $('out-pension').textContent = money(res.pensionSelf);
      $('out-employer-pension').textContent = money(res.pensionEmployer);
      $('out-grades').textContent = fmt.format(res.laborGrade) + ' / ' + fmt.format(res.nhiGrade) + ' / ' + fmt.format(res.pensionGrade);
      $('out-supp').textContent = money(res.supplementary);
      $('out-tax').textContent = money(res.annualTax);
      $('out-annual').textContent = money(res.annualTakeHome);
      $('warn-min').hidden = !res.belowMinWage;
      var pct = res.salary > 0 ? Math.max(0, Math.min(100, res.monthlyTakeHome / res.salary * 100)) : 0;
      if ($('bar-take')) $('bar-take').style.width = pct.toFixed(1) + '%';
      if ($('out-pct')) $('out-pct').textContent = pct.toFixed(1) + '%';
      try { localStorage.setItem('twsal', JSON.stringify({ s: $('salary').value })); } catch (e) {}
    }
    var hashSal = /(?:^|[#&])s=(\d+)/.exec(location.hash);
    if (hashSal) $('salary').value = hashSal[1];
    else try {
      var saved = JSON.parse(localStorage.getItem('twsal') || 'null');
      if (saved && saved.s) $('salary').value = saved.s;
    } catch (e) {}
    form.addEventListener('input', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
    update();
  });
})(this);
