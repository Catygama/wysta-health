import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { isWebPushSupported, subscribeToWebPush } from '@/lib/webPush';
import { fonts } from '@/lib/fonts';

type Status = 'off' | 'on' | 'denied' | 'error';

function initialStatus(): Status {
  if (!isWebPushSupported()) return 'off';
  if (Notification.permission === 'denied') return 'denied';
  return 'off';
}

export function WebPushCard() {
  const publicKey = useQuery(api.notifications.webPushPublicKey);
  const register = useMutation(api.notifications.registerWebPushSubscription);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);

  // Re-sync on every visit once permission is granted, so a rotated
  // endpoint replaces the stale one server-side.
  useEffect(() => {
    if (!publicKey || !isWebPushSupported()) return;
    if (Notification.permission !== 'granted') return;
    let cancelled = false;
    subscribeToWebPush(publicKey)
      .then((sub) => (sub ? register(sub) : null))
      .then(() => {
        if (!cancelled) setStatus('on');
      })
      .catch((err) => console.warn('[push] web re-sync failed', err));
    return () => {
      cancelled = true;
    };
  }, [publicKey, register]);

  if (!publicKey || !isWebPushSupported()) return null;

  async function enable() {
    if (!publicKey) return;
    setLoading(true);
    try {
      const sub = await subscribeToWebPush(publicKey);
      if (!sub) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'off');
        return;
      }
      await register(sub);
      setStatus('on');
    } catch (err) {
      console.warn('[push] web subscribe failed', err);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Notificações</Text>
      {status === 'on' ? (
        <Text style={styles.text}>
          Ativas neste browser. Avisamos-te quando um enfermeiro responder.
        </Text>
      ) : status === 'denied' ? (
        <Text style={styles.text}>
          As notificações estão bloqueadas neste browser. Podes ativá-las nas
          definições do site.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            Recebe um aviso neste browser quando um enfermeiro responder.
          </Text>
          {status === 'error' ? (
            <Text style={styles.error}>Não foi possível ativar. Tenta novamente.</Text>
          ) : null}
          <Button
            testID="profile-enable-web-push"
            label="Ativar notificações"
            variant="secondary"
            onPress={enable}
            loading={loading}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  text: { fontSize: 14, color: theme.colors.textSecondary },
  error: { fontSize: 12, color: theme.colors.danger },
}));
