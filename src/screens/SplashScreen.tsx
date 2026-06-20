import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Easing, Dimensions, View, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';

const { width: W, height: H } = Dimensions.get('window');

const SPORTS = [
  { symbol: 'figure.pool.swim',     color: '#5E5CE6' },
  { symbol: 'figure.run',           color: '#FF3B30' },
  { symbol: 'figure.outdoor.cycle', color: '#30D158' },
];

const LETTERS = 'movly'.split('');
const HOLD    = 620;
const OUT_DUR = 260;
const IN_DUR  = 400;

// Letters only mount when it's time — animations fire immediately on mount
const BounceLetter = ({ char, index }: { char: string; index: number }) => {
  const y  = useRef(new Animated.Value(40)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 70;
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 180, delay, useNativeDriver: true }),
      Animated.spring(y, {
        toValue: 0, delay,
        damping: 7, stiffness: 200, mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.Text style={[s.letter, { opacity: op, transform: [{ translateY: y }] }]}>
      {char}
    </Animated.Text>
  );
};

export const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const opacities = useRef(SPORTS.map((_, i) => new Animated.Value(i === 0 ? 0 : 0))).current;
  const scales    = useRef(SPORTS.map(() => new Animated.Value(0.4))).current;
  const screenOp  = useRef(new Animated.Value(1)).current;
  const [showText, setShowText] = useState(false);

  const enter = (i: number) => Animated.parallel([
    Animated.timing(opacities[i], { toValue: 1, duration: IN_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.spring(scales[i], { toValue: 1, damping: 13, stiffness: 150, useNativeDriver: true }),
  ]);

  const exit = (i: number) => Animated.parallel([
    Animated.timing(opacities[i], { toValue: 0, duration: OUT_DUR, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    Animated.timing(scales[i],    { toValue: 1.5, duration: OUT_DUR, easing: Easing.in(Easing.quad), useNativeDriver: true }),
  ]);

  useEffect(() => {
    Animated.sequence([
      enter(0),
      Animated.delay(HOLD),
      Animated.parallel([exit(0), enter(1)]),
      Animated.delay(HOLD),
      Animated.parallel([exit(1), enter(2)]),
      Animated.delay(HOLD - 200),
    ]).start(() => {
      setShowText(true); // letters mount NOW and animate
      setTimeout(() => {
        Animated.timing(screenOp, {
          toValue: 0, duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => onDone());
      }, 900);
    });
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: screenOp }]}>
      {/* Icons */}
      <View style={s.iconStack}>
        {SPORTS.map((sport, i) => (
          <Animated.View
            key={sport.symbol}
            style={[StyleSheet.absoluteFill, s.center, {
              opacity: opacities[i],
              transform: [{ scale: scales[i] }],
            }]}
          >
            <SymbolView name={sport.symbol as any} size={170} tintColor={sport.color} />
          </Animated.View>
        ))}
      </View>

      {/* Text — mounts only when showText = true */}
      <View style={s.textBlock}>
        {showText && (
          <>
            <View style={s.letterRow}>
              {LETTERS.map((c, i) => <BounceLetter key={i} char={c} index={i} />)}
            </View>
            <Text style={s.tagline}>Track what matters.</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0,
    width: W, height: H,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  iconStack: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  center:    { alignItems: 'center', justifyContent: 'center' },
  textBlock: { height: 70, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  letterRow: { flexDirection: 'row' },
  letter:    { color: '#FFF', fontSize: 48, fontWeight: '700', letterSpacing: -1 },
  tagline:   { color: '#444', fontSize: 13, letterSpacing: 0.4 },
});
