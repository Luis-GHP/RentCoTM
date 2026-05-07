export type PaymentCollectionRow = {
  status: string;
  amount_due: number | string | null;
  amount_paid: number | string | null;
};

export type PaymentCollectionBuckets = {
  collected: number;
  pending: number;
  overdue: number;
};

function amount(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

export function remainingBalance(amountDue: number | string | null, amountPaid: number | string | null): number {
  return Math.max(0, amount(amountDue) - amount(amountPaid));
}

export function paymentCollectionBuckets(payment: PaymentCollectionRow): PaymentCollectionBuckets {
  const due = amount(payment.amount_due);
  const paid = amount(payment.amount_paid);

  if (payment.status === 'paid') {
    return { collected: paid, pending: 0, overdue: 0 };
  }

  if (payment.status === 'partial') {
    return { collected: paid, pending: remainingBalance(due, paid), overdue: 0 };
  }

  if (payment.status === 'pending' || payment.status === 'unpaid') {
    return { collected: 0, pending: due, overdue: 0 };
  }

  if (payment.status === 'overdue') {
    return { collected: 0, pending: 0, overdue: due };
  }

  return { collected: 0, pending: 0, overdue: 0 };
}
