import { Text, type TextProps } from 'react-native';

// AI text marks emphasis Markdown-style ("**Perfil**: …"). Shows those parts
// in bold and drops the asterisks; everything else is plain text.
export function BoldText({ children, ...props }: TextProps & { children: string }) {
  const parts = children.split(/\*\*(.+?)\*\*/g);
  return (
    <Text {...props}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontWeight: '700' }}>
            {part}
          </Text>
        ) : (
          part.replace(/\*\*/g, '')
        )
      )}
    </Text>
  );
}
