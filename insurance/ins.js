/* 勞健保勞退級距試算 — 2026 (民國115年), employee and employer shares.
 * Depends on ../calc.js (TWSalary) for the grade table and base rates.
 * Sources: 勞動部勞工保險局 115 年勞保/職保/勞退分級表；健保署 115 年投保金額分級表
 * (平均眷口數 0.56)。 Rounding follows BLI: each premium item is rounded separately. */
(function (root) {
  'use strict';
  var TW = root.TWSalary || (typeof require !== 'undefined' ? require('../calc.js') : null);
  var R = TW.RATES;

  var EMP = {
    laborEmployer: 0.7,          // 勞保 雇主 70%（政府 10%）
    nhiEmployer: 0.6,            // 健保 雇主 60%
    nhiAvgDependents: 0.56,      // 115 年平均眷口數
    occupationalMax: 72800,      // 職災保險投保薪資上限
    occupationalDefault: 0.0021, // 職災 行業平均費率（含通勤 0.07%）
    wageArrears: 0.00025         // 積欠工資墊償基金 0.025%
  };

  function calculate(opts) {
    var salary = Math.max(0, Number(opts.salary) || 0);
    var deps = Math.min(Math.max(0, opts.dependents | 0), R.nhi.maxDependents);
    var pensionRate = Math.min(Math.max(0, Number(opts.pensionRate) || 0), 0.06);
    var occRate = opts.occupationalRate == null ? EMP.occupationalDefault : Math.max(0, Number(opts.occupationalRate) || 0);
    var hasEmployment = opts.employmentIns !== false;
    var hasPension = opts.pension !== false;

    var top = TW.GRADES[TW.GRADES.length - 1];
    var laborGrade = TW.grade(salary, R.labor.max);
    var occGrade = TW.grade(salary, EMP.occupationalMax);
    var nhiGrade = TW.grade(salary, top);
    var pensionGrade = TW.grade(salary, R.pensionMax);

    var ord = laborGrade * R.labor.ordinary, emp = hasEmployment ? laborGrade * R.labor.employment : 0;
    var labor = {
      employee: Math.round(ord * R.labor.employeeShare) + Math.round(emp * R.labor.employeeShare),
      employer: Math.round(ord * EMP.laborEmployer) + Math.round(emp * EMP.laborEmployer)
    };
    var occupational = Math.round(occGrade * occRate);
    var arrears = Math.round(laborGrade * EMP.wageArrears);
    var nhiPerPerson = Math.round(nhiGrade * R.nhi.rate * R.nhi.employeeShare);
    var nhi = {
      employee: nhiPerPerson * (1 + deps),
      employer: Math.round(nhiGrade * R.nhi.rate * EMP.nhiEmployer * (1 + EMP.nhiAvgDependents))
    };
    var pension = {
      employee: hasPension ? Math.round(pensionGrade * pensionRate) : 0,
      employer: hasPension ? Math.round(pensionGrade * 0.06) : 0
    };

    var employeeTotal = labor.employee + nhi.employee + pension.employee;
    var employerTotal = labor.employer + occupational + arrears + nhi.employer + pension.employer;
    return {
      salary: salary,
      laborGrade: laborGrade, occGrade: occGrade, nhiGrade: nhiGrade, pensionGrade: pensionGrade,
      labor: labor, occupational: occupational, arrears: arrears, nhi: nhi, nhiPerPerson: nhiPerPerson, pension: pension,
      employeeTotal: employeeTotal, employerTotal: employerTotal,
      takeHome: salary - employeeTotal,
      totalCost: salary + employerTotal,
      belowMinWage: salary > 0 && salary < R.minWage
    };
  }

  var api = { EMP: EMP, calculate: calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TWInsurance = api;

  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('ins');
    if (!form) return;
    var fmt = new Intl.NumberFormat(document.documentElement.lang || 'zh-TW');
    function $(id) { return document.getElementById(id); }
    function money(n) { return 'NT$ ' + fmt.format(n); }
    function set(id, v) { var el = $(id); if (el) el.textContent = v; }

    function update() {
      var res = calculate({
        salary: $('salary').value,
        dependents: $('dependents').value,
        pensionRate: Number($('pension').value) / 100,
        occupationalRate: Number($('occ').value) / 100,
        employmentIns: $('employment').checked,
        pension: $('haspension').checked
      });
      set('out-employee', money(res.employeeTotal));
      set('out-employer', money(res.employerTotal));
      set('out-takehome', money(res.takeHome));
      set('out-cost', money(res.totalCost));
      set('g-labor', fmt.format(res.laborGrade));
      set('g-nhi', fmt.format(res.nhiGrade));
      set('g-pension', fmt.format(res.pensionGrade));
      set('g-occ', fmt.format(res.occGrade));
      set('e-labor', fmt.format(res.labor.employee));
      set('r-labor', fmt.format(res.labor.employer));
      set('r-occ', fmt.format(res.occupational));
      set('r-arrears', fmt.format(res.arrears));
      set('e-nhi', fmt.format(res.nhi.employee));
      set('r-nhi', fmt.format(res.nhi.employer));
      set('e-pension', fmt.format(res.pension.employee));
      set('r-pension', fmt.format(res.pension.employer));
      set('e-total', fmt.format(res.employeeTotal));
      set('r-total', fmt.format(res.employerTotal));
      $('warn-min').hidden = !res.belowMinWage;
      var a = $('to-salary');
      if (a) a.href = a.getAttribute('data-base') + '#s=' + Math.round(res.salary);
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
