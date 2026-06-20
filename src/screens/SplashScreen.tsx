import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { MovlyMark } from '../components/MovlyLogo';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

export const SplashScreen = ({ onDone }: Props) => {
  const logoScale   = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY       = useSharedValue(12);
  const exitOpacity = useSharedValue(1);

  useEffect(() => {
    // 1. Logo einblenden
    logoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    logoScale.value   = withSpring(1, { damping: 14, stiffness: 120 });

    // 2. Wordmark einblenden
    textOpacity.value = withDelay(300, withTiming(1, { duration: 350 }));
    textY.value       = withDelay(300, withSpring(0, { damping: 18 }));

    // 3. Alles ausblenden und onDone aufrufen
    exitOpacity.value = withDelay(
      1600,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)();
      })
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.logo, logoStyle]}>
        <MovlyMark size={88} color="#FF3B30" />
      </Animated.View>
      <Animated.Text style={[styles.wordmark, textStyle]}>
        movly
      </Animated.Text>
      <Animated.Text style={[styles.tagline, textStyle]}>
        Track what matters.
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 999,
  },
  logo: {},
  wordmark: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  tagline: {
    color: '#636366',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
