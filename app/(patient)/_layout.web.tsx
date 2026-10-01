import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { WebShell, type NavItem } from '@/components/ui/WebShell';
import { TabBarProvider } from '@/contexts/TabBarContext';

const ITEMS: NavItem[] = [
  {
    label: 'Início',
    href: '/',
    icon: { sf: 'house', ion: 'home-outline' },
    match: (p) => p === '/',
  },
  {
    label: 'Saúde',
    href: '/education',
    icon: { sf: 'book', ion: 'book-outline' },
  },
  {
    label: 'Perfil',
    href: '/profile',
    icon: { sf: 'person', ion: 'person-outline' },
  },
];

export default function PatientLayoutWeb() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'professional') return <Redirect href="/(professional)/queue" />;
  if (role === 'admin') return <Redirect href="/(admin)/" />;
  return (
    <TabBarProvider>
      <WebShell items={ITEMS} />
    </TabBarProvider>
  );
}
