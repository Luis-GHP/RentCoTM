import { View, Text, TextInput, TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function FormInput({ label, error, ...props }: Props) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        {...props}
        style={{
          height: 52,
          borderWidth: error ? 1.5 : 1,
          borderColor: error ? '#DC2626' : '#E4E0DC',
          borderRadius: 10,
          paddingHorizontal: 16,
          fontSize: 15,
          color: '#111827',
          backgroundColor: '#FFFFFF',
        }}
        placeholderTextColor="#9CA3AF"
      />
      {error ? (
        <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}
