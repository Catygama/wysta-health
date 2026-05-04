import { type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, typography } from '@/constants/theme';

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

export function WebShell({ items, brandHref = '/', maxWidth = 1040 }: Props) {
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
      <Header items={items} brandHref={brandHref} maxWidth={maxWidth} />
      <ContentContainer maxWidth={maxWidth}>
        <Slot />
      </ContentContainer>
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
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              W
            </Text>
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
              <NavLink
                key={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
                onPress={() => router.push(item.href as any)}
              />
            );
          })}
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

function NavLink({
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

function ContentContainer({
  children,
  maxWidth,
}: {
  children: ReactNode;
  maxWidth: number;
}) {
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
          maxWidth,
          backgroundColor: colors.background.primary,
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
