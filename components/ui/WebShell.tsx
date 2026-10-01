import { type ReactNode } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { fonts } from '@/lib/fonts';
import { useTabBar } from '@/contexts/TabBarContext';

export type NavItem = {
  label: string;
  href: string;
  icon?: IconName;
  match?: (pathname: string) => boolean;
};

type Props = {
  items: NavItem[];
  brandHref?: string;
  /** Constrains main content width on desktop. Defaults to 1040px. */
  maxWidth?: number;
};

const MOBILE_BREAKPOINT = 640;

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const MODE_ICON: Record<ThemeMode, IconName> = {
  system: { sf: 'circle.lefthalf.filled', ion: 'contrast-outline' },
  light: { sf: 'sun.max', ion: 'sunny-outline' },
  dark: { sf: 'moon', ion: 'moon-outline' },
};

const MODE_LABEL: Record<ThemeMode, string> = {
  system: 'Tema: sistema',
  light: 'Tema: claro',
  dark: 'Tema: escuro',
};

export function WebShell({ items, brandHref = '/', maxWidth = 1040 }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  // Screens like a conversation hide the bottom nav to give the composer room.
  const { isTabBarHidden } = useTabBar();
  const showBottomNav = isMobile && !isTabBarHidden;

  return (
    <View style={styles.root}>
      {isMobile ? (
        <MobileBrandBar brandHref={brandHref} />
      ) : (
        <Header items={items} brandHref={brandHref} maxWidth={maxWidth} />
      )}
      <ContentContainer
        maxWidth={isMobile ? Number.POSITIVE_INFINITY : maxWidth}
        bottomInset={showBottomNav ? 64 : 0}
        framed={!isMobile}
      >
        <Slot />
      </ContentContainer>
      {showBottomNav && <BottomNav items={items} />}
    </View>
  );
}

function Header({
  items,
  brandHref,
  maxWidth,
}: {
  items: NavItem[];
  brandHref: string;
  maxWidth: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const { mode, setMode } = useTheme();
  const { theme } = useUnistyles();

  return (
    <View style={styles.header}>
      <View style={[styles.headerInner, { maxWidth }]}>
        <Pressable onPress={() => router.push(brandHref as any)} style={styles.brand} accessibilityLabel="Wysta">
          <Brand />
        </Pressable>

        <View style={styles.navRight}>
          {items.map((item) => {
            const active = item.match ? item.match(pathname) : isActive(pathname, item.href);
            return (
              <NavPill
                key={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
                onPress={() => router.push(item.href as any)}
              />
            );
          })}
          <Pressable
            testID="theme-toggle"
            onPress={() => setMode(NEXT_MODE[mode])}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            accessibilityLabel={MODE_LABEL[mode]}
          >
            <Icon name={MODE_ICON[mode]} size={18} color={theme.colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => signOut()}
            hitSlop={8}
            style={({ pressed }) => [styles.signOut, pressed && styles.dim]}
            accessibilityLabel="Terminar sessão"
          >
            <Icon
              name={{ sf: 'rectangle.portrait.and.arrow.right', ion: 'log-out-outline' }}
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.signOutText}>Sair</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MobileBrandBar({ brandHref }: { brandHref: string }) {
  const router = useRouter();
  return (
    <View style={styles.mobileBar}>
      <Pressable onPress={() => router.push(brandHref as any)} style={styles.brand} accessibilityLabel="Wysta">
        <Brand />
      </Pressable>
    </View>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useUnistyles();
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const active = item.match ? item.match(pathname) : isActive(pathname, item.href);
        const color = active ? theme.colors.inkText : theme.colors.textSecondary;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as any)}
            style={styles.bottomTab}
            accessibilityLabel={item.label}
          >
            {item.icon && <Icon name={item.icon} size={22} color={color} />}
            <Text style={[styles.bottomLabel, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NavPill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  styles.useVariants({ active });
  return (
    <Pressable onPress={onPress} style={[styles.navPill, !active && styles.navPillIdle]}>
      {icon && (
        <Icon name={icon} size={14} color={active ? theme.colors.onInk : theme.colors.textSecondary} />
      )}
      <Text style={styles.navPillText}>{label}</Text>
    </Pressable>
  );
}

function Brand() {
  return (
    <>
      <View style={styles.logo}>
        <Text style={styles.logoText}>W</Text>
      </View>
      <Text style={styles.wordmark}>Wysta</Text>
    </>
  );
}

function ContentContainer({
  children,
  maxWidth,
  bottomInset,
  framed,
}: {
  children: ReactNode;
  maxWidth: number;
  bottomInset: number;
  framed: boolean;
}) {
  return (
    <View style={styles.contentOuter}>
      <View
        style={[
          styles.contentPanel,
          framed && styles.contentPanelFramed,
          {
            maxWidth: Number.isFinite(maxWidth) ? maxWidth : undefined,
            paddingBottom: bottomInset,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    minHeight: '100vh' as any,
  },
  header: { backgroundColor: theme.colors.background },
  headerInner: {
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  navRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBtnPressed: { backgroundColor: theme.colors.surfaceSunken },
  signOut: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dim: { opacity: 0.7 },
  signOutText: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
  mobileBar: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingBottom: 4,
  },
  bottomTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bottomLabel: { fontSize: 12, fontWeight: '500' },
  navPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    variants: {
      active: {
        true: { backgroundColor: theme.colors.ink },
        false: { backgroundColor: 'transparent' },
      },
    },
  },
  navPillIdle: {},
  navPillText: {
    fontSize: 14,
    variants: {
      active: {
        true: { color: theme.colors.onInk, fontWeight: '500' },
        false: { color: theme.colors.textPrimary, fontWeight: '500' },
      },
    },
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: theme.colors.onInk, fontFamily: fonts.displayExtraBold, fontSize: 15 },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: theme.colors.inkText,
    letterSpacing: -0.3,
  },
  contentOuter: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  contentPanel: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background,
  },
  contentPanelFramed: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderCurve: 'continuous',
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
}));
