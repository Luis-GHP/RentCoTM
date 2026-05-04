import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';

export default function MoreScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-4 py-4">
        <Text className="text-2xl font-bold text-gray-900 mb-6">More</Text>
        <TouchableOpacity
          className="border border-red-200 rounded-xl py-3 px-4"
          onPress={signOut}
        >
          <Text className="text-red-600 font-medium">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
