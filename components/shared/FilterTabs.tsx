import { ScrollView, TouchableOpacity, Text } from 'react-native';

type Tab<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
};

export function FilterTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: isActive ? '#2F4A7D' : '#F1EFEC',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: isActive ? '#FFFFFF' : '#374151',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
