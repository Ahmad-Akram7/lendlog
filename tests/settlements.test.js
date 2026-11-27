const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toggleSettled, settleAllFor } = require('../lib/settlements');

function record(overrides = {}) {
  return {
    id: 'record-1',
    name: 'Sam',
    amount: 100,
    paid_amount: 30,
    settled: false,
    settled_date: '',
    updated: 'unchanged',
    payments: [
      { id: 'payment-1', amount: 30, date: '01/01/2026', note: 'Part payment' },
    ],
    ...overrides,
  };
}

function options() {
  let id = 0;
  return {
    today: '27/11/2026',
    createId: () => `settlement-${++id}`,
  };
}

test('manual settlement records only the unpaid balance as an adjustment', () => {
  const original = record();
  const settled = toggleSettled(original, options());

  assert.equal(settled.settled, true);
  assert.equal(settled.paid_amount, 100);
  assert.equal(settled.payments.length, 2);
  assert.deepEqual(settled.payments[1], {
    id: 'settlement-1',
    amount: 70,
    date: '27/11/2026',
    note: 'Manual settlement adjustment',
    kind: 'settlement',
  });
  assert.equal(original.payments.length, 1);
});

test('undoing manual settlement removes only the adjustment and preserves real payments', () => {
  const settled = toggleSettled(record(), options());
  const reopened = toggleSettled(settled, options());

  assert.equal(reopened.settled, false);
  assert.equal(reopened.paid_amount, 30);
  assert.deepEqual(reopened.payments, [
    { id: 'payment-1', amount: 30, date: '01/01/2026', note: 'Part payment' },
  ]);
});

test('a record fully paid by ordinary payments remains settled when toggled', () => {
  const fullyPaid = record({
    amount: 100,
    paid_amount: 100,
    settled: true,
    settled_date: '26/11/2026',
    payments: [
      { id: 'payment-1', amount: 100, date: '26/11/2026', note: 'Paid' },
    ],
  });

  const result = toggleSettled(fullyPaid, options());

  assert.equal(result.settled, true);
  assert.equal(result.paid_amount, 100);
  assert.equal(result.payments.length, 1);
});

test('settle all creates one adjustment per pending record for the selected person', () => {
  const records = [
    record({ id: 'one' }),
    record({ id: 'two', amount: 50, paid_amount: 0, payments: [] }),
    record({ id: 'other', name: 'Alex' }),
    record({ id: 'already-settled', settled: true }),
  ];

  const result = settleAllFor(records, 'sam', options());

  assert.deepEqual(result.map((item) => item.settled), [true, true, false, true]);
  assert.equal(result[0].payments.at(-1).amount, 70);
  assert.equal(result[1].payments.at(-1).amount, 50);
  assert.equal(result[2], records[2]);
  assert.equal(result[3], records[3]);
});
