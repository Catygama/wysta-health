import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { WebShell, type NavItem } from '@/components/ui/WebShell';

const ITEMS: NavItem[] = [
  {
    label: 'Utilizadores',
    href: '/',
    icon: { sf: 'person.2', ion: 'people-outline' },
    match: (p) => p === '/',
  },
];

export default function AdminLayoutWeb() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'patient') return <Redirect href="/(patient)/" />;
  if (role === 'professional') return <Redirect href="/(professional)/queue" />;
  return <WebShell items={ITEMS} maxWidth={1100} />;
}
