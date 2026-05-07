import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { HouseRuleCategory } from '../../lib/query/house-rules';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const HOUSE_RULE_CATEGORIES: { key: HouseRuleCategory; label: string; icon: IconName }[] = [
  { key: 'general', label: 'General', icon: 'list-outline' },
  { key: 'payment', label: 'Payments', icon: 'cash-outline' },
  { key: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { key: 'utilities', label: 'Utilities', icon: 'flash-outline' },
  { key: 'visitors', label: 'Visitors', icon: 'people-outline' },
  { key: 'parking', label: 'Parking', icon: 'car-outline' },
  { key: 'quiet_hours', label: 'Quiet Hours', icon: 'moon-outline' },
  { key: 'safety', label: 'Safety', icon: 'shield-checkmark-outline' },
  { key: 'move_out', label: 'Move Out', icon: 'exit-outline' },
  { key: 'other', label: 'Other', icon: 'document-text-outline' },
];

export function getHouseRuleCategoryMeta(category: HouseRuleCategory) {
  return HOUSE_RULE_CATEGORIES.find(item => item.key === category) ?? HOUSE_RULE_CATEGORIES[0];
}
