import { View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function DeactivatedScreen() {
  return (
    <View className="flex-1 bg-white px-6 justify-center items-center">
      <Text className="text-5xl mb-4">🔒</Text>
      <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">Account Deactivated</Text>
      <Text className="text-gray-500 text-center mb-10">
        Your account has been deactivated. Please contact your landlord to regain access.
      </Text>
      <TouchableOpacity
        className="border border-gray-200 rounded-xl py-3 px-6"
        onPress={() => supabase.auth.signOut()}
      >
        <Text className="text-gray-700 font-medium">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
