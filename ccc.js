// ccc.js: the finance math for the ElectroMart CCC app.
// These are plain functions. None of them touch the page, so they can be
// checked with Node, for example:
//   node -e "const c=require('./ccc.js'); console.log(c.dio(1200000, 6000000, 365))"

(function (root) {
  'use strict';

  // ---------- Reading the CSV files ----------

  // Turn CSV text into an array of row objects, using the first line as the
  // column names. The lab's files are simple (no quoted commas), but quotes
  // around a value are handled anyway.
  function parseCSV(text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(function (l) {
      return l.trim() !== '';
    });
    var header = splitLine(lines[0]);
    return lines.slice(1).map(function (line) {
      var cells = splitLine(line);
      var row = {};
      header.forEach(function (name, i) {
        row[name.trim()] = (cells[i] || '').trim();
      });
      return row;
    });
  }

  function splitLine(line) {
    var cells = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  }

  // Turn the statement rows into { before: {item: number}, after: {...},
  // sections: {item: section} }.
  function readStatements(rows) {
    var out = { before: {}, after: {}, sections: {} };
    rows.forEach(function (r) {
      out.before[r.item] = Number(r.before);
      out.after[r.item] = Number(r.after);
      out.sections[r.item] = r.section;
    });
    return out;
  }

  // Turn the assumption rows into { days_in_year: 365, bank_rate: 0.08, ... }.
  function readAssumptions(rows) {
    var out = {};
    rows.forEach(function (r) { out[r.assumption] = Number(r.value); });
    return out;
  }

  // ---------- The day counts ----------

  // Days inventory outstanding: how long goods sit on the shelf.
  function dio(inventory, cogs, daysInYear) {
    return inventory / cogs * daysInYear;
  }

  // Days sales outstanding: how long customers take to pay (all sales on credit).
  function dso(receivables, revenue, daysInYear) {
    return receivables / revenue * daysInYear;
  }

  // Days payables outstanding: how long ElectroMart takes to pay suppliers
  // (purchases equal COGS).
  function dpo(payables, cogs, daysInYear) {
    return payables / cogs * daysInYear;
  }

  // Cash conversion cycle: days a dollar is tied up in operations.
  function ccc(dioDays, dsoDays, dpoDays) {
    return dioDays + dsoDays - dpoDays;
  }

  // All four for one period's statements.
  function cycle(period, daysInYear) {
    var d1 = dio(period.inventory, period.cogs, daysInYear);
    var d2 = dso(period.accounts_receivable, period.revenue, daysInYear);
    var d3 = dpo(period.accounts_payable, period.cogs, daysInYear);
    return { dio: d1, dso: d2, dpo: d3, ccc: ccc(d1, d2, d3) };
  }

  // ---------- Cash freed by each lever ----------

  // From the balance sheet change: a drop in an asset frees cash, and a rise
  // in accounts payable frees cash.
  function cashFreed(before, after) {
    var inventory = before.inventory - after.inventory;
    var receivables = before.accounts_receivable - after.accounts_receivable;
    var payables = after.accounts_payable - before.accounts_payable;
    return {
      inventory: inventory,
      receivables: receivables,
      payables: payables,
      total: inventory + receivables + payables
    };
  }

  // The same thing worked out from the days: days changed × annual flow / days in year.
  // Used as a check that the two methods agree.
  function cashFreedFromDays(daysChanged, annualFlow, daysInYear) {
    return daysChanged * annualFlow / daysInYear;
  }

  // ---------- The levers ----------

  // The balance a number of days implies: days × annual flow / days in year.
  // Flow is COGS for inventory and payables, revenue for receivables.
  function impliedBalance(days, annualFlow, daysInYear) {
    return days * annualFlow / daysInYear;
  }

  // Interest saved each year if the cash freed pays down the bank line.
  // Only the bank line's Before balance can be paid down. If cash freed is
  // negative, ElectroMart borrows more, so the saving is negative.
  function interestSaved(cashFreedTotal, bankLineBefore, bankRate) {
    var paidDown = cashFreedTotal > 0 ? Math.min(cashFreedTotal, bankLineBefore) : cashFreedTotal;
    return paidDown * bankRate;
  }

  // Days paid past the net due date, never less than zero.
  function daysPastDue(dpoDays, netDays) {
    return Math.max(0, dpoDays - netDays);
  }

  // Nominal annual cost of skipping the supplier discount:
  // d / (1 − d) × days in year / (days paid − discount days).
  // If DPO is within the discount period, ElectroMart takes the discount,
  // so there is no cost and takesDiscount is true.
  function discountCost(dpoDays, discount, discountDays, daysInYear) {
    if (dpoDays <= discountDays) return { takesDiscount: true, rate: 0 };
    return {
      takesDiscount: false,
      rate: discount / (1 - discount) * daysInYear / (dpoDays - discountDays)
    };
  }

  // Everything the levers show, for chosen DIO, DSO and DPO days.
  // Revenue and COGS stay at their Before values.
  function levers(days, before, assumptions) {
    var n = assumptions.days_in_year;
    var inventory = impliedBalance(days.dio, before.cogs, n);
    var receivables = impliedBalance(days.dso, before.revenue, n);
    var payables = impliedBalance(days.dpo, before.cogs, n);
    var freed = {
      inventory: before.inventory - inventory,
      receivables: before.accounts_receivable - receivables,
      payables: payables - before.accounts_payable
    };
    freed.total = freed.inventory + freed.receivables + freed.payables;
    return {
      ccc: ccc(days.dio, days.dso, days.dpo),
      balances: { inventory: inventory, receivables: receivables, payables: payables },
      freed: freed,
      interestSaved: interestSaved(freed.total, before.notes_payable, assumptions.bank_rate),
      daysPastDue: daysPastDue(days.dpo, assumptions.net_days),
      discount: discountCost(days.dpo, assumptions.supplier_discount, assumptions.discount_days, n)
    };
  }

  var api = {
    impliedBalance: impliedBalance,
    interestSaved: interestSaved,
    daysPastDue: daysPastDue,
    discountCost: discountCost,
    levers: levers,
    parseCSV: parseCSV,
    readStatements: readStatements,
    readAssumptions: readAssumptions,
    dio: dio,
    dso: dso,
    dpo: dpo,
    ccc: ccc,
    cycle: cycle,
    cashFreed: cashFreed,
    cashFreedFromDays: cashFreedFromDays
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;   // Node
  } else {
    root.CCC = api;         // browser
  }
})(this);
