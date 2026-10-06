import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { WebShell, type NavItem } from '@/components/ui/WebShell';
import { TabBarProvider } from '@/contexts/TabBarContext';

const ITEMS: NavItem[] = [
  {
    label: 'Fila',
    href: '/queue',
    icon: {
      sf: 'list.bullet.clipboard',
      ion: 'list-outline',
    },
  },
  {
    label: 'Explorar',
    href: '/library',
    icon: { sf: 'safari', ion: 'compass-outline' },
  },
  {
    label: 'Perfil',
    href: '/profile',
    icon: { sf: 'person', ion: 'person-outline' },
  },
];

export default function ProfessionalLayoutWeb() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'patient') return <Redirect href="/(patient)/" />;
  if (role === 'admin') return <Redirect href="/(admin)/" />;
  return (
    <TabBarProvider>
      <WebShell items={ITEMS} />
    </TabBarProvider>
  );
}
