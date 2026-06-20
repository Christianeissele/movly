import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

// Clean geometric mark — forward slash speed lines forming an abstract M
export const MovlyMark = ({ size = 40 }: { size?: number }) => {
  const r = size * 0.22; // corner radius
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF3B30" />
          <Stop offset="1" stopColor="#FF6B35" />
        </LinearGradient>
      </Defs>

      {/* Rounded square */}
      <Rect x="0" y="0" width="100" height="100" rx="22" fill="url(#bg)" />

      {/* Abstract M — two peaks with speed tail */}
      {/* Left diagonal up */}
      <Path
        d="M18 72 L36 30 L50 54 L64 30 L82 72"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Speed line below */}
      <Path
        d="M22 82 L55 82"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
};

export const MovlyWordmark = ({ color = '#FFFFFF', size = 36 }: { color?: string; size?: number }) => (
  <Text style={[styles.wordmark, { color, fontSize: size, letterSpacing: size * -0.04 }]}>
    movly
  </Text>
);

const styles = StyleSheet.create({
  wordmark: { fontWeight: '700' },
});
