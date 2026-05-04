import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { WebShell, type NavItem } from '@/components/ui/WebShell';

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
    label: 'Saúde',
    href: '/education',
    icon: { sf: 'book', ion: 'book-outline' },
  },
];

export default function ProfessionalLayoutWeb() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user || role !== 'professional') return <Redirect href="/" />;
  return <WebShell items={ITEMS} />;
}
