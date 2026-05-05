import { type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { spacing, typography } from '@/constants/theme';
import { useTheme, type ThemeMode } from '@/lib/theme';

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
  const { colors } = useTheme();

  return (
    <View
      style={
        {
          flex: 1,
          backgroundColor: colors.background.secondary,
          minHeight: '100vh',
        } as any
      }
    >
      {isMobile ? (
        <MobileBrandBar brandHref={brandHref} />
      ) : (
        <Header items={items} brandHref={brandHref} maxWidth={maxWidth} />
      )}
      <ContentContainer
        maxWidth={isMobile ? Number.POSITIVE_INFINITY : maxWidth}
        bottomInset={isMobile ? 64 : 0}
      >
        <Slot />
      </ContentContainer>
      {isMobile && <BottomNav items={items} />}
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
  const { colors, mode, setMode } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth,
          marginHorizontal: 'auto',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
        }}
      >
        <Pressable
          onPress={() => router.push(brandHref as any)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
          accessibilityLabel="Wysta"
        >
          <Brand />
        </Pressable>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: spacing.xs,
            flexWrap: 'wrap',
          }}
        >
          {items.map((item) => {
            const active = item.match
              ? item.match(pathname)
              : isActive(pathname, item.href);
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
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed
                ? colors.background.tertiary
                : 'transparent',
            })}
            accessibilityLabel={MODE_LABEL[mode]}
          >
            <Icon name={MODE_ICON[mode]} size={18} color={colors.text.secondary} />
          </Pressable>
          <Pressable
            onPress={() => signOut()}
            hitSlop={8}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: 999,
              opacity: pressed ? 0.7 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
            })}
            accessibilityLabel="Terminar sessão"
          >
            <Icon
              name={{
                sf: 'rectangle.portrait.and.arrow.right',
                ion: 'log-out-outline',
              }}
              size={16}
              color={colors.text.secondary}
            />
            <Text
              style={{
                ...typography.sm,
                color: colors.text.secondary,
                fontWeight: '500',
              }}
            >
              Sair
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MobileBrandBar({ brandHref }: { brandHref: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Pressable
        onPress={() => router.push(brandHref as any)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
        accessibilityLabel="Wysta"
      >
        <Brand />
      </Pressable>
    </View>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.background.primary,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: 4,
      }}
    >
      {items.map((item) => {
        const active = item.match
          ? item.match(pathname)
          : isActive(pathname, item.href);
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as any)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
            accessibilityLabel={item.label}
          >
            {item.icon && (
              <Icon
                name={item.icon}
                size={22}
                color={active ? colors.primary : colors.text.secondary}
              />
            )}
            <Text
              style={{
                ...typography.xs,
                fontWeight: active ? '600' : '500',
                color: active ? colors.primary : colors.text.secondary,
              }}
            >
              {item.label}
            </Text>
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 999,
        backgroundColor: active
          ? colors.primaryLight
          : pressed
            ? colors.background.tertiary
            : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
      })}
    >
      {icon && (
        <Icon
          name={icon}
          size={14}
          color={active ? colors.primary : colors.text.secondary}
        />
      )}
      <Text
        style={{
          ...typography.sm,
          fontWeight: active ? '700' : '500',
          color: active ? colors.primary : colors.text.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Brand() {
  const { colors } = useTheme();
  return (
    <>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>W</Text>
      </View>
      <Text
        style={{
          ...typography.lg,
          fontWeight: '700',
          color: colors.text.primary,
          letterSpacing: -0.3,
        }}
      >
        Wysta
      </Text>
    </>
  );
}

function ContentContainer({
  children,
  maxWidth,
  bottomInset,
}: {
  children: ReactNode;
  maxWidth: number;
  bottomInset: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: Number.isFinite(maxWidth) ? maxWidth : undefined,
          backgroundColor: colors.background.primary,
          paddingBottom: bottomInset,
        }}
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
