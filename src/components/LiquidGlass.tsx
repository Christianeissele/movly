import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  borderRadius?: number;
}

export const LiquidGlass = ({ children, style, intensity = 80, borderRadius = 20 }: Props) => (
  <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
    <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { borderRadius, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' }]} />
    <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
  </View>
);
