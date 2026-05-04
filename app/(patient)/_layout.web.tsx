import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { WebShell, type NavItem } from '@/components/ui/WebShell';

const ITEMS: NavItem[] = [
  {
    label: 'Início',
    href: '/',
    icon: { sf: 'house', ion: 'home-outline' },
    match: (p) => p === '/',
  },
  {
    label: 'Conversas',
    href: '/conversations',
    icon: {
      sf: 'bubble.left.and.bubble.right',
      ion: 'chatbubbles-outline',
    },
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
  if (!user || role !== 'patient') return <Redirect href="/" />;
  return <WebShell items={ITEMS} />;
}
