import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../shared/Button';

export type ProfileEditState = {
  name: string;
  email: string;
  phone: string;
};

type Props = {
  visible: boolean;
  title: string;
  value: ProfileEditState;
  error?: string;
  loading?: boolean;
  onChange: (value: ProfileEditState) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function ProfileEditModal({
  visible,
  title,
  value,
  error,
  loading,
  onChange,
  onCancel,
  onSave,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.44)', padding: 18, justifyContent: 'center' }}>
        <View style={{ maxHeight: '86%', backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' }}>
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: '#F1EFEC', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{title}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                Update the contact details shown inside RentCo.
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1EFEC', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700' }}>{error}</Text>
              </View>
            ) : null}

            <Field label="Name" value={value.name} placeholder="Full name" onChangeText={name => onChange({ ...value, name })} />
            <Field label="Contact Email" value={value.email} placeholder="your@email.com" keyboardType="email-address" onChangeText={email => onChange({ ...value, email })} />
            <Field label="Phone" value={value.phone} placeholder="Phone number" keyboardType="phone-pad" onChangeText={phone => onChange({ ...value, phone })} />

            <View style={{ backgroundColor: '#F7F6F3', borderRadius: 14, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: '#6B7280' }}>
                This edits your RentCo contact profile. Sign-in email changes can require separate email confirmation.
              </Text>
            </View>

            <Button label="Save Profile" loading={loading} onPress={onSave} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  placeholder,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        onChangeText={onChangeText}
        style={{
          height: 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E4E0DC',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          fontSize: 14,
          color: '#111827',
        }}
      />
    </View>
  );
}
