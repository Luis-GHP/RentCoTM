import * as Linking from 'expo-linking';

export function authRedirectUrl(path: string) {
  return Linking.createURL(path.startsWith('/') ? path : `/${path}`);
}
