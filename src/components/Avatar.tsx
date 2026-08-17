import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';

type Props = {
  uri?: string | null;
  name?: string | null;
  /** Circle diameter / square edge length in dp. */
  size?: number;
  /** Corner radius. Defaults to a perfect circle (size / 2). */
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  fallbackBg?: [string, string];
};

/**
 * User avatar. Shows the profile image when there is one (and it loads
 * successfully); otherwise always falls back to a colored circle with the
 * first letter of the name — never a white/empty square.
 */
const Avatar: React.FC<Props> = ({ uri, name, size = 44, radius, style, fallbackBg }) => {
  const [failed, setFailed] = useState(false);

  // Reset the failed state if a new image is provided.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showImage = !!uri && !failed;
  const r = radius ?? size / 2;
  const letter = ((name || 'U').trim().charAt(0) || 'U').toUpperCase();
  const bg = fallbackBg || [colors.primary, '#7985FF'];

  return (
    <View style={[{ width: size, height: size }, style]}>
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: size, height: size, borderRadius: r }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <LinearGradient
          colors={bg}
          style={[styles.fallback, { width: '100%', height: '100%', borderRadius: r }]}
        >
          <Text style={[styles.letter, { fontSize: Math.max(12, size * 0.42) }]}>{letter}</Text>
        </LinearGradient>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    // Explicit 100% sizing (applied inline) instead of flex: 1 so the fallback
    // fills the full circle/square even when the wrapper passes alignItems:
    // 'center' (which otherwise collapses the gradient to a narrow vertical
    // pill whose width only wraps the letter).
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: colors.white,
    fontWeight: '800',
  },
});

export default Avatar;
