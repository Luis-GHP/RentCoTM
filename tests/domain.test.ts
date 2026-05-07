import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currentPeriod,
  isFuturePeriod,
  monthName,
  periodLabel,
} from '../lib/domain/periods';
import {
  documentMatchesFilter,
  isDocumentImage,
  isIdentityDocumentType,
  isOfficialDocumentType,
  isUtilityBillDocumentType,
} from '../lib/domain/documents';
import {
  paymentCollectionBuckets,
  remainingBalance,
} from '../lib/domain/payments';

test('period helpers format and compare calendar periods', () => {
  const reference = new Date('2026-05-06T12:00:00+08:00');

  assert.deepEqual(currentPeriod(reference), { month: 5, year: 2026 });
  assert.equal(monthName(1), 'January');
  assert.equal(monthName(12), 'December');
  assert.equal(monthName(13), '');
  assert.equal(periodLabel(5, 2026), 'May 2026');
  assert.equal(isFuturePeriod(6, 2026, reference), true);
  assert.equal(isFuturePeriod(5, 2026, reference), false);
  assert.equal(isFuturePeriod(4, 2026, reference), false);
  assert.equal(isFuturePeriod(1, 2027, reference), true);
});

test('document helpers classify images and filters consistently', () => {
  const receipt = {
    doc_type: 'receipt',
    entity_type: 'rent_payment',
    file_url: 'https://example.test/receipt.jpg',
    file_name: 'receipt.jpg',
  };
  const maintenancePdf = {
    doc_type: 'other',
    entity_type: 'maintenance_request',
    file_url: 'https://example.test/work-order.pdf',
    file_name: 'work-order.pdf',
  };

  assert.equal(isDocumentImage(receipt), true);
  assert.equal(isDocumentImage(maintenancePdf), false);
  assert.equal(isUtilityBillDocumentType('utility_bill_pdf'), true);
  assert.equal(isUtilityBillDocumentType('receipt'), false);
  assert.equal(isIdentityDocumentType('gov_id_front'), true);
  assert.equal(isOfficialDocumentType('or_pdf'), true);
  assert.equal(documentMatchesFilter(receipt, 'receipts'), true);
  assert.equal(documentMatchesFilter(receipt, 'bills'), false);
  assert.equal(documentMatchesFilter(maintenancePdf, 'maintenance'), true);
  assert.equal(documentMatchesFilter({ ...receipt, doc_type: 'bill' }, 'bills'), true);
  assert.equal(documentMatchesFilter({ ...receipt, doc_type: 'gov_id_back' }, 'ids'), true);
  assert.equal(documentMatchesFilter({ ...receipt, doc_type: 'contract' }, 'official'), true);
  assert.equal(documentMatchesFilter({ ...maintenancePdf, entity_type: 'lease' }, 'other'), true);
});

test('payment helpers keep partial and overdue buckets stable', () => {
  assert.equal(remainingBalance(6000, 1500), 4500);
  assert.equal(remainingBalance(6000, 7000), 0);

  assert.deepEqual(paymentCollectionBuckets({ status: 'paid', amount_due: 6000, amount_paid: 6000 }), {
    collected: 6000,
    pending: 0,
    overdue: 0,
  });
  assert.deepEqual(paymentCollectionBuckets({ status: 'partial', amount_due: 6000, amount_paid: 1500 }), {
    collected: 1500,
    pending: 4500,
    overdue: 0,
  });
  assert.deepEqual(paymentCollectionBuckets({ status: 'pending', amount_due: 6000, amount_paid: 0 }), {
    collected: 0,
    pending: 6000,
    overdue: 0,
  });
  assert.deepEqual(paymentCollectionBuckets({ status: 'overdue', amount_due: 6000, amount_paid: 0 }), {
    collected: 0,
    pending: 0,
    overdue: 6000,
  });
});
