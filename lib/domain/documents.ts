export type DocumentFilterKey = 'all' | 'receipts' | 'bills' | 'maintenance' | 'ids' | 'official' | 'other';

export type DocumentLike = {
  doc_type: string;
  entity_type?: string | null;
  file_url: string;
  file_name?: string | null;
};

const IMAGE_FILE_RE = /\.(jpg|jpeg|png|webp|gif)$/i;

export function isUtilityBillDocumentType(docType: string): boolean {
  return docType === 'bill' || docType === 'utility_bill_pdf';
}

export function isIdentityDocumentType(docType: string): boolean {
  return docType === 'gov_id' || docType === 'gov_id_front' || docType === 'gov_id_back';
}

export function isOfficialDocumentType(docType: string): boolean {
  return docType === 'or_pdf' || docType === 'contract' || docType === 'inspection_report';
}

export function isDocumentImage(doc: DocumentLike): boolean {
  return doc.doc_type === 'photo' || IMAGE_FILE_RE.test(doc.file_url) || IMAGE_FILE_RE.test(doc.file_name ?? '');
}

export function documentMatchesFilter(doc: DocumentLike, filter: DocumentFilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'receipts') return doc.doc_type === 'receipt';
  if (filter === 'bills') return isUtilityBillDocumentType(doc.doc_type);
  if (filter === 'maintenance') return doc.entity_type === 'maintenance_request';
  if (filter === 'ids') return isIdentityDocumentType(doc.doc_type);
  if (filter === 'official') return isOfficialDocumentType(doc.doc_type);
  if (filter === 'other') {
    return (
      doc.doc_type === 'other' ||
      (!isDocumentImage(doc) &&
        doc.doc_type !== 'receipt' &&
        !isUtilityBillDocumentType(doc.doc_type) &&
        !isIdentityDocumentType(doc.doc_type) &&
        !isOfficialDocumentType(doc.doc_type) &&
        doc.entity_type !== 'maintenance_request')
    );
  }
  return false;
}
