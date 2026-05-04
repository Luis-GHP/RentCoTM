import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TenantPayments() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-4 py-4">
        <Text className="text-2xl font-bold text-gray-900">Payments</Text>
        <Text className="text-gray-500 text-sm mt-1">Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
