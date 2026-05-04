import { View, Text } from 'react-native';

const CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  paid:       { bg: '#F0FDF4', text: '#15803D', label: 'Paid' },
  confirmed:  { bg: '#F0FDF4', text: '#15803D', label: 'Confirmed' },
  active:     { bg: '#F0FDF4', text: '#15803D', label: 'Active' },
  pending:    { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
  partial:    { bg: '#FFFBEB', text: '#B45309', label: 'Partial' },
  overdue:    { bg: '#FEF2F2', text: '#DC2626', label: 'Overdue' },
  unpaid:     { bg: '#F9FAFB', text: '#6B7280', label: 'Unpaid' },
  waived:     { bg: '#F9FAFB', text: '#6B7280', label: 'Waived' },
  expired:    { bg: '#F9FAFB', text: '#6B7280', label: 'Expired' },
  terminated: { bg: '#F9FAFB', text: '#6B7280', label: 'Terminated' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status] ?? { bg: '#F9FAFB', text: '#6B7280', label: status };
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: cfg.text, fontSize: 12, fontWeight: '600' }}>{cfg.label}</Text>
    </View>
  );
}
