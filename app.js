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
      show('');
    })
    .catch(function (err) {
      show('Could not load the data. ' + err.message +
        '. If you opened index.html straight from your computer, the browser blocks reading the CSV files; open it from GitHub Pages or a local web server instead.');
    });
})();
