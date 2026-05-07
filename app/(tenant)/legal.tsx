import { LegalSupportScreen } from '../../components/account/LegalSupportScreen';

export default function TenantLegalScreen() {
  return <LegalSupportScreen audience="tenant" returnRoute="/(tenant)/more" />;
}
