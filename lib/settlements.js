function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toggleSettled(record, { today, createId }) {
  const isSettling = !record.settled;
  const ordinaryPayments = record.payments.filter(
    (payment) => payment.kind !== 'settlement',
  );

  if (!isSettling) {
    const paidAmount = round2(
      ordinaryPayments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    const fullyPaid = record.amount > 0 && paidAmount >= record.amount;

    return {
      ...record,
      payments: ordinaryPayments,
      paid_amount: paidAmount,
      settled: fullyPaid,
      settled_date: fullyPaid ? record.settled_date || today : '',
    };
  }

  const ordinaryPaid = round2(
    ordinaryPayments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  const adjustment = Math.max(0, round2(record.amount - ordinaryPaid));
  const payments =
    adjustment > 0
      ? [
          ...ordinaryPayments,
          {
            id: createId(),
            amount: adjustment,
            date: today,
            note: 'Manual settlement adjustment',
            kind: 'settlement',
          },
        ]
      : ordinaryPayments;

  return {
    ...record,
    payments,
    paid_amount: round2(
      payments.reduce((sum, payment) => sum + payment.amount, 0),
    ),
    settled: true,
    settled_date: today,
  };
}

function settleAllFor(records, name, options) {
  return records.map((record) => {
    if (
      record.name.toLowerCase() !== name.toLowerCase() ||
      record.settled
    ) {
      return record;
    }

    return {
      ...toggleSettled(record, options),
      updated: record.updated,
    };
  });
}

module.exports = { toggleSettled, settleAllFor };
