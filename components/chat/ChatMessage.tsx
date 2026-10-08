import { View, Text, Image, Pressable, Linking } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';
import { relativeTime } from '@/lib/format';

function formatBytes(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ChatMessageProps = {
  side: 'own' | 'other';
  internal?: boolean;
  content?: string;
  createdAt?: number;
  imageUrl?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  messageType?: string;
  testID?: string;
  /** Extra node rendered under the bubble (e.g. the inline "ask AI" pill). */
  footer?: React.ReactNode;
  /** Who wrote it, shown above someone else's message (e.g. "Enf.ª Ana"). */
  author?: string;
};

export function ChatMessage({
  side,
  internal = false,
  content,
  createdAt,
  imageUrl,
  attachmentUrl,
  attachmentName,
  attachmentSize,
  messageType,
  testID,
  footer,
  author,
}: ChatMessageProps) {
  const isOwn = side === 'own';
  const kind = internal ? 'internal' : isOwn ? 'own' : 'other';
  styles.useVariants({ side, kind });

  const hasImage = messageType === 'image' && !!imageUrl;
  const hasFile = messageType === 'file' && !!attachmentUrl;
  const fileLabel = attachmentName ?? content;
  const fileMeta = formatBytes(attachmentSize);
  const contentIsFallback =
    content === 'Imagem partilhada' ||
    (messageType === 'file' && content === attachmentName);
  const showContent = !!content && !contentIsFallback;

  return (
    <View style={styles.row} testID={testID}>
      {internal ? (
        <Text style={styles.internalLabel}>{author ? `Nota interna · ${author}` : 'Nota interna'}</Text>
      ) : author && !isOwn ? (
        <Text testID={testID ? `${testID}-author` : undefined} style={styles.authorLabel}>
          {author}
        </Text>
      ) : null}
      <View style={[styles.bubble, hasImage && styles.bubbleMedia]}>
        {hasImage ? (
          <Image
            source={{ uri: imageUrl as string }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
        {hasFile ? (
          <Pressable
            onPress={() => Linking.openURL(attachmentUrl as string)}
            style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
            accessibilityRole="link"
            accessibilityLabel={`Abrir ${fileLabel ?? 'ficheiro'}`}
          >
            <View style={styles.fileIcon}>
              <Icon
                name={{ sf: 'doc', ion: 'document-outline' }}
                size={18}
                color={styles.fileIconGlyph.color}
              />
            </View>
            <View style={styles.fileMeta}>
              <Text style={styles.fileName} numberOfLines={2}>
                {fileLabel}
              </Text>
              {fileMeta ? <Text style={styles.fileSize}>{fileMeta}</Text> : null}
            </View>
          </Pressable>
        ) : null}
        {showContent ? (
          <Text style={[styles.text, hasImage && styles.textUnderImage]} selectable>
            {content}
          </Text>
        ) : null}
      </View>
      {createdAt ? <Text style={styles.time}>{relativeTime(createdAt)}</Text> : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    maxWidth: '82%',
    variants: {
      side: {
        own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
        other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
      },
    },
  },
  authorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  internalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.warning,
    marginBottom: 2,
  },
  bubble: {
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    variants: {
      kind: {
        own: { backgroundColor: theme.colors.ink },
        other: { backgroundColor: theme.colors.surface },
        internal: {
          backgroundColor: theme.colors.warningSurface,
          borderLeftWidth: 3,
          borderLeftColor: theme.colors.warning,
        },
      },
      side: {
        own: { borderBottomRightRadius: 6 },
        other: { borderBottomLeftRadius: 6 },
      },
    },
  },
  bubbleMedia: { padding: theme.spacing.xs },
  image: {
    width: 220,
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
  },
  pressed: { opacity: 0.7 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      kind: {
        own: { backgroundColor: 'rgba(255,255,255,0.18)' },
        other: { backgroundColor: theme.colors.surfaceSunken },
        internal: { backgroundColor: theme.colors.surface },
      },
    },
  },
  fileIconGlyph: {
    variants: {
      kind: {
        own: { color: theme.colors.onInk },
        other: { color: theme.colors.textSecondary },
        internal: { color: theme.colors.textSecondary },
      },
    },
  },
  fileMeta: { flex: 1, minWidth: 140 },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    variants: {
      kind: {
        own: { color: theme.colors.onInk },
        other: { color: theme.colors.textPrimary },
        internal: { color: theme.colors.textPrimary },
      },
    },
  },
  fileSize: {
    fontSize: 12,
    variants: {
      kind: {
        own: { color: 'rgba(255,255,255,0.85)' },
        other: { color: theme.colors.textSecondary },
        internal: { color: theme.colors.textSecondary },
      },
    },
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    variants: {
      kind: {
        own: { color: theme.colors.onInk },
        other: { color: theme.colors.textPrimary },
        internal: { color: theme.colors.textPrimary },
      },
    },
  },
  textUnderImage: { paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.xs },
  time: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
}));
