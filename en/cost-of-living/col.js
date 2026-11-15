/* Taiwan cost of living calculator — 2026 estimates (NT$ per month).
 * Rent baseline: Ministry of the Interior H1 2026 rent statistics (Taipei medians:
 * studio NT$15,000, shared room NT$9,800); other cities and unit types estimated
 * from MOI data and 2026 listings. Depends on ../../calc.js for the salary-needed figure. */
(function (root) {
  'use strict';
  var TW = root.TWSalary || (typeof require !== 'undefined' ? require('../../calc.js') : null);

  var CITIES = {
    taipei:   { name: 'Taipei',     rent: { room: 9800, studio: 15000, apt1: 25000, apt2: 33000 }, food: 1.10, pass: 1200 },
    newtaipei:{ name: 'New Taipei', rent: { room: 8000, studio: 12000, apt1: 18000, apt2: 23000 }, food: 1.00, pass: 1200 },
    taichung: { name: 'Taichung',   rent: { room: 6500, studio: 9500,  apt1: 15000, apt2: 18000 }, food: 0.95, pass: 699 },
    kaohsiung:{ name: 'Kaohsiung',  rent: { room: 6000, studio: 8500,  apt1: 13000, apt2: 16000 }, food: 0.92, pass: 399 }
  };
  var STYLE = {          // rent factor, food/person, leisure & personal/person
    budget:      { rent: 0.85, food: 7500,  misc: 3000 },
    moderate:    { rent: 1.00, food: 11000, misc: 6000 },
    comfortable: { rent: 1.35, food: 18000, misc: 12000 }
  };
  var UTIL = { room: 800, studio: 1500, apt1: 2500, apt2: 3200 }; // electricity, water, gas (avg incl. summer A/C)
  var NET = { room: 0, studio: 0, apt1: 700, apt2: 700 };          // home fiber; rooms/studios usually include it
  var PHONE = 499;
  var NHI_SELF = 826;   // Category 6 self-paid premium per person (2026)
  var PRIVATE_INS = 1500;
  var SCOOTER = 1800;   // fuel, insurance, parking, maintenance

  function estimate(o) {
    var c = CITIES[o.city] || CITIES.taipei;
    var st = STYLE[o.style] || STYLE.moderate;
    var people = o.couple ? 2 : 1;
    var housing = o.housing || 'studio';
    var rent = Math.round(c.rent[housing] * st.rent / 100) * 100;
    var utilities = UTIL[housing] * (o.couple ? 1.3 : 1);
    var food = Math.round(st.food * c.food / 100) * 100 * people;
    var transport = o.transport === 'scooter' ? SCOOTER * people
      : o.transport === 'none' ? 0 : c.pass * people;
    if (o.style === 'comfortable') transport += 1500 * people; // taxis / Uber
    var phone = NET[housing] + PHONE * people;
    var nhi = o.nhi === 'self' ? NHI_SELF * people : o.nhi === 'private' ? PRIVATE_INS * people : 0;
    var misc = Math.round(st.misc * (o.couple ? 1.8 : 1));
    var total = rent + utilities + food + transport + phone + nhi + misc;
    var moveIn = rent * 3 + Math.round(rent / 2); // 2-month deposit + first month + ~half-month agent fee
    return {
      city: c.name, rent: rent, utilities: Math.round(utilities), food: food, transport: transport,
      phone: phone, nhi: nhi, misc: misc, total: Math.round(total / 100) * 100, moveIn: moveIn,
      salaryNeeded: salaryFor(total)
    };
  }

  // Smallest monthly salary (in NT$500 steps) whose take-home covers `need`.
  function salaryFor(need) {
    if (!TW) return null;
    for (var s = 29500; s <= 400000; s += 500) {
      if (TW.calculate({ salary: s, employmentIns: false }).monthlyTakeHome >= need) return s;
    }
    return null;
  }

  var api = { estimate: estimate, CITIES: CITIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TWCost = api;

  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('col');
    if (!form) return;
    var fmt = new Intl.NumberFormat('en');
    function $(id) { return document.getElementById(id); }
    function money(n) { return 'NT$ ' + fmt.format(Math.round(n)); }
    function val(name) { var el = form.querySelector('[name="' + name + '"]:checked'); return el ? el.value : null; }
    function update() {
      var r = estimate({
        city: $('city').value, housing: $('housing').value, style: val('style'),
        couple: $('couple').value === '2', transport: $('transport').value, nhi: $('nhi').value
      });
      $('out-total').textContent = money(r.total);
      $('out-usd').textContent = '≈ US$' + fmt.format(Math.round(r.total / 32 / 10) * 10) + ' a month in ' + r.city;
      ['rent', 'utilities', 'food', 'transport', 'phone', 'nhi', 'misc'].forEach(function (k) {
        $('out-' + k).textContent = money(r[k]);
      });
      $('out-year').textContent = money(r.total * 12);
      $('out-movein').textContent = money(r.moveIn);
      $('out-salary').textContent = r.salaryNeeded ? money(r.salaryNeeded) : 'over NT$ 400,000';
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
    update();
  });
})(this);
