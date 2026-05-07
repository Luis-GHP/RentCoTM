import { View, Text } from 'react-native';

const CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  // Payment statuses
  paid:        { bg: '#EAF7EF', text: '#14804A', label: 'Paid' },
  confirmed:   { bg: '#EAF7EF', text: '#14804A', label: 'Confirmed' },
  active:      { bg: '#EAF7EF', text: '#14804A', label: 'Active' },
  pending:     { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
  payment_submitted: { bg: '#FFFBEB', text: '#B45309', label: 'Pending Verification' },
  partial:     { bg: '#FFFBEB', text: '#B45309', label: 'Partial' },
  overdue:     { bg: '#FEF2F2', text: '#DC2626', label: 'Overdue' },
  unpaid:      { bg: '#F7F6F3', text: '#6B7280', label: 'Unpaid' },
  waived:      { bg: '#F7F6F3', text: '#6B7280', label: 'Waived' },
  expired:     { bg: '#F7F6F3', text: '#6B7280', label: 'Expired' },
  terminated:  { bg: '#F7F6F3', text: '#6B7280', label: 'Terminated' },
  advance:     { bg: '#EDF3FF', text: '#2F4A7D', label: 'Advance' },
  // Maintenance statuses
  open:        { bg: '#EDF3FF', text: '#2F4A7D', label: 'Open' },
  assigned:    { bg: '#EDF3FF', text: '#2F4A7D', label: 'Assigned' },
  in_progress: { bg: '#FFFBEB', text: '#B45309', label: 'In Progress' },
  resolved:    { bg: '#EAF7EF', text: '#14804A', label: 'Fixed' },
  closed:      { bg: '#F7F6F3', text: '#6B7280', label: 'Closed' },
  landlord:    { bg: '#EDF3FF', text: '#2F4A7D', label: 'Landlord' },
  tenant:      { bg: '#EDF3FF', text: '#2F4A7D', label: 'Tenant' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status] ?? { bg: '#F7F6F3', text: '#6B7280', label: status };
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: cfg.text, fontSize: 12, fontWeight: '600' }}>{cfg.label}</Text>
    </View>
  );
}
