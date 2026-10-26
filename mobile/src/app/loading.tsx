import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

export default function LoadingRoute() {
  const [rotation] = useState(
    () => new Animated.Value(0)
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        duration: 1600,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View
        pointerEvents="none"
        style={styles.decoration}
      >
        <View style={styles.glow} />
        <View style={styles.ring} />
        <View style={styles.core} />
      </View>

      <View style={styles.content}>
        <Image
          accessibilityLabel="GestorIA"
          contentFit="contain"
          source={require('@/assets/images/gestoria-logo.png')}
          style={styles.logo}
        />

        <View
          accessibilityLabel="Carregando GestorIA"
          accessibilityRole="progressbar"
          style={styles.spinnerShell}
        >
          <Animated.View
            style={[
              styles.rotatingMark,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          >
            <View style={styles.markCrop}>
              <Image
                contentFit="contain"
                source={require('@/assets/images/gestoria-logo.png')}
                style={styles.markImage}
              />
            </View>
          </Animated.View>
        </View>

        <Text style={styles.title}>
          Preparando seu GestorIA
        </Text>

        <Text style={styles.description}>
          Conectando sua empresa com segurança.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: sereneColors.background,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },

  decoration: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  glow: {
    backgroundColor: 'rgba(40, 103, 232, 0.10)',
    borderRadius: 190,
    height: 380,
    left: -180,
    position: 'absolute',
    top: -210,
    width: 430,
  },

  ring: {
    borderColor: 'rgba(40, 103, 232, 0.15)',
    borderRadius: 170,
    borderWidth: 42,
    bottom: -120,
    height: 340,
    position: 'absolute',
    right: -170,
    width: 340,
  },

  core: {
    backgroundColor: 'rgba(23, 174, 230, 0.05)',
    borderRadius: 110,
    bottom: -55,
    height: 220,
    position: 'absolute',
    right: -105,
    width: 220,
  },

  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    width: '100%',
  },

  logo: {
    height: 100,
    marginBottom: spacing.lg,
    width: 300,
  },

  spinnerShell: {
    alignItems: 'center',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    width: 58,
  },

  rotatingMark: {
    height: 40,
    width: 40,
  },

  markCrop: {
    height: 40,
    overflow: 'hidden',
    width: 40,
  },

  markImage: {
    height: 133,
    left: -36,
    position: 'absolute',
    top: -45,
    width: 220,
  },

  title: {
    color: sereneColors.text,
    fontSize: fontSizes.title,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
  },

  description: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});