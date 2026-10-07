import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isVerifiedProfessional } from '@/convex/lib/professional';
import { ProfessionalVerificationStatus } from '@/screens/ProfessionalVerificationStatus';
import { WebShell, type NavItem } from '@/components/ui/WebShell';
import { TabBarProvider } from '@/contexts/TabBarContext';

const ITEMS: NavItem[] = [
  {
    label: 'Pedidos',
    href: '/queue',
    icon: {
      sf: 'list.bullet.clipboard',
      ion: 'list-outline',
    },
  },
  {
    label: 'Conversas',
    href: '/ongoing',
    icon: { sf: 'bubble.left.and.bubble.right', ion: 'chatbubbles-outline' },
  },
  {
    label: 'Explorar',
    href: '/library',
    icon: { sf: 'book', ion: 'book-outline' },
  },
  {
    label: 'Perfil',
    href: '/account',
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
  // Sign-up awaiting (or refused) admin verification: no queue, cases or chats.
  if (!isVerifiedProfessional(user.profile)) {
    const status = user.profile?.professionalVerificationStatus === 'rejected' ? 'rejected' : 'pending';
    return (
      <ProfessionalVerificationStatus
        status={status}
        rejectionReason={user.profile?.professionalVerificationRejectionReason}
      />
    );
  }
  return (
    <TabBarProvider>
      <WebShell items={ITEMS} />
    </TabBarProvider>
  );
}
