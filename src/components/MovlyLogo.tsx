import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  showWordmark?: boolean;
  color?: string;
}

// M-shaped pulse line — movement + heartbeat
export const MovlyMark = ({ size = 40, color = '#FF3B30' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Defs>
      <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={color} />
        <Stop offset="1" stopColor="#FF6B35" />
      </LinearGradient>
    </Defs>
    {/* Rounded square background */}
    <Path
      d="M8 0h24a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V8a8 8 0 0 1 8-8z"
      fill="url(#grad)"
    />
    {/* Pulse / M shape */}
    <Path
      d="M5 22 L10 22 L13 14 L17 28 L21 18 L24 24 L27 20 L35 20"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export const MovlyLogo = ({ size = 40, showWordmark = true, color = '#FF3B30' }: Props) => (
  <View style={styles.row}>
    <MovlyMark size={size} color={color} />
    {showWordmark && (
      <Text style={[styles.wordmark, { fontSize: size * 0.55, color: '#FFFFFF' }]}>
        movly
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontWeight: '700', letterSpacing: -1 },
});
