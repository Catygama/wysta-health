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
  if (!user || role !== 'admin') return <Redirect href="/" />;
  return <WebShell items={ITEMS} maxWidth={1100} />;
}
