// app.js: loads the CSV files and puts the results on the page.
// All the math lives in ccc.js (window.CCC).

(function () {
  'use strict';

  var days2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var dollars0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtDays(x) { return days2.format(x); }
  function fmtDollars(x) {
    // Avoid showing "-$0" for tiny negative rounding.
    var r = Math.round(x);
    return dollars0.format(r === 0 ? 0 : r);
  }
  function fmtChange(x) {
    var s = days2.format(x);
    return x > 0 ? '+' + s : s;
  }

  function loadText(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path + ' (' + res.status + ')');
      return res.text();
    });
  }

  function cell(tag, text, cls) {
    var el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function row(cells) {
    var tr = document.createElement('tr');
    cells.forEach(function (c) { tr.appendChild(c); });
    return tr;
  }

  function renderDays(before, after) {
    var body = document.getElementById('days-body');
    body.innerHTML = '';
    var lines = [
      ['DIO', 'Days inventory outstanding', 'dio'],
      ['DSO', 'Days sales outstanding', 'dso'],
      ['DPO', 'Days payables outstanding', 'dpo'],
      ['CCC', 'Cash conversion cycle', 'ccc']
    ];
    lines.forEach(function (l) {
      var label = document.createElement('th');
      label.scope = 'row';
      label.appendChild(cell('abbr', l[0]));
      label.firstChild.title = l[1];
      label.appendChild(cell('span', l[1], 'sub'));
      var tr = row([
        label,
        cell('td', fmtDays(before[l[2]]), 'num'),
        cell('td', fmtDays(after[l[2]]), 'num'),
        cell('td', fmtChange(after[l[2]] - before[l[2]]), 'num')
      ]);
      if (l[2] === 'ccc') tr.className = 'total';
      body.appendChild(tr);
    });
  }

  function renderCash(st, freed) {
    var body = document.getElementById('cash-body');
    body.innerHTML = '';
    var lines = [
      ['Inventory', 'inventory', 'inventory'],
      ['Receivables', 'accounts_receivable', 'receivables'],
      ['Payables', 'accounts_payable', 'payables']
    ];
    lines.forEach(function (l) {
      var th = cell('th', l[0]);
      th.scope = 'row';
      // Shown under the label on narrow screens, where the Before and After
      // columns are hidden to avoid sideways scrolling.
      th.appendChild(cell('span',
        fmtDollars(st.before[l[1]]) + ' → ' + fmtDollars(st.after[l[1]]), 'sub narrow-only'));
      body.appendChild(row([
        th,
        cell('td', fmtDollars(st.before[l[1]]), 'num wide-only'),
        cell('td', fmtDollars(st.after[l[1]]), 'num wide-only'),
        cell('td', fmtDollars(freed[l[2]]), 'num')
      ]));
    });
    var th = cell('th', 'Total cash freed');
    th.scope = 'row';
    var tr = row([th, cell('td', '', 'wide-only'), cell('td', '', 'wide-only'),
      cell('td', fmtDollars(freed.total), 'num')]);
    tr.className = 'total';
    body.appendChild(tr);
  }

  var pct2 = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmtPct(x) { return pct2.format(x); }

  // ---------- Levers ----------

  var LEVERS = ['dio', 'dso', 'dpo'];

  function setText(id, text) { document.getElementById(id).textContent = text; }

  function renderLevers(days, st, as, beforeCycle) {
    var r = CCC.levers(days, st.before, as);

    setText('lever-ccc', fmtDays(r.ccc));
    setText('lever-ccc-change', fmtChange(r.ccc - beforeCycle.ccc) + ' days compared with Before (' +
      fmtDays(beforeCycle.ccc) + ')');

    var body = document.getElementById('lever-body');
    body.innerHTML = '';
    [
      ['Inventory', 'inventory', 'inventory'],
      ['Receivables', 'accounts_receivable', 'receivables'],
      ['Payables', 'accounts_payable', 'payables']
    ].forEach(function (l) {
      var th = cell('th', l[0]);
      th.scope = 'row';
      th.appendChild(cell('span',
        fmtDollars(st.before[l[1]]) + ' → ' + fmtDollars(r.balances[l[2]]), 'sub narrow-only'));
      body.appendChild(row([
        th,
        cell('td', fmtDollars(st.before[l[1]]), 'num wide-only'),
        cell('td', fmtDollars(r.balances[l[2]]), 'num wide-only'),
        cell('td', fmtDollars(r.freed[l[2]]), 'num')
      ]));
    });
    var th = cell('th', 'Total cash freed');
    th.scope = 'row';
    var tr = row([th, cell('td', '', 'wide-only'), cell('td', '', 'wide-only'),
      cell('td', fmtDollars(r.freed.total), 'num')]);
    tr.className = 'total';
    body.appendChild(tr);

    var interest = document.getElementById('lever-interest');
    interest.textContent = fmtDollars(r.interestSaved);
    interest.className = r.interestSaved < 0 ? 'neg' : '';
    if (r.interestSaved < 0) interest.textContent += ' (extra interest: more borrowing)';

    setText('lever-late', fmtDays(r.daysPastDue) + ' days');
    setText('lever-discount', r.discount.takesDiscount
      ? 'None: pays within ' + as.discount_days + ' days and takes the discount'
      : fmtPct(r.discount.rate));
  }

  function setupLevers(st, as, beforeCycle, afterCycle) {
    var days = { dio: beforeCycle.dio, dso: beforeCycle.dso, dpo: beforeCycle.dpo };

    // Static labels from assumptions.csv.
    setText('bank-before', fmtDollars(st.before.notes_payable));
    setText('bank-rate', fmtPct(as.bank_rate));
    setText('net-days', String(as.net_days));
    setText('disc-pct', fmtPct(as.supplier_discount).replace('.00', ''));
    setText('disc-year', String(as.days_in_year));
    setText('disc-days', String(as.discount_days));

    function sync(key, value, source) {
      days[key] = value;
      var range = document.getElementById(key + '-range');
      var num = document.getElementById(key + '-num');
      if (source !== range) {
        // Let the slider stretch if someone types a number past its end.
        if (value > Number(range.max)) range.max = String(Math.ceil(value));
        range.value = String(value);
      }
      if (source !== num) num.value = String(Math.round(value * 100) / 100);
      renderLevers(days, st, as, beforeCycle);
    }

    LEVERS.forEach(function (key) {
      var range = document.getElementById(key + '-range');
      var num = document.getElementById(key + '-num');
      // Slider runs from 0 to twice the larger of Before and After, rounded up to 10.
      range.max = String(Math.ceil(Math.max(beforeCycle[key], afterCycle[key]) * 2 / 10) * 10);
      range.addEventListener('input', function () { sync(key, Number(range.value), range); });
      num.addEventListener('input', function () {
        var v = Number(num.value);
        if (num.value !== '' && isFinite(v) && v >= 0) sync(key, v, num);
      });
    });

    function setAll(cycle) {
      // Set the exact values (not rounded) so the results match the table above.
      LEVERS.forEach(function (key) { sync(key, cycle[key], null); });
    }
    document.getElementById('set-before').addEventListener('click', function () { setAll(beforeCycle); });
    document.getElementById('set-after').addEventListener('click', function () { setAll(afterCycle); });

    setAll(beforeCycle);
  }

  function show(message) {
    var el = document.getElementById('status');
    el.textContent = message;
    el.hidden = !message;
  }

  Promise.all([loadText('data/electromart.csv'), loadText('data/assumptions.csv')])
    .then(function (texts) {
      var st = CCC.readStatements(CCC.parseCSV(texts[0]));
      var as = CCC.readAssumptions(CCC.parseCSV(texts[1]));
      var n = as.days_in_year;

      var before = CCC.cycle(st.before, n);
      var after = CCC.cycle(st.after, n);
      var freed = CCC.cashFreed(st.before, st.after);

      document.getElementById('year-note').textContent =
        'Using a ' + n + '-day year from data/assumptions.csv.';
      renderDays(before, after);
      renderCash(st, freed);
      setupLevers(st, as, before, after);
      show('');
    })
    .catch(function (err) {
      show('Could not load the data. ' + err.message +
        '. If you opened index.html straight from your computer, the browser blocks reading the CSV files; open it from GitHub Pages or a local web server instead.');
    });
})();
