import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { WorkoutType } from '../types/workout';

const { width: W } = Dimensions.get('window');
const ITEM_WIDTH = 88;
const ITEM_GAP = 12;
const SIDE_PADDING = (W - ITEM_WIDTH) / 2;

export type SportConfig = {
  type: WorkoutType;
  label: string;
  symbol: string;
  color: string;
};

export const SPORTS: SportConfig[] = [
  { type: 'running',  label: 'Laufen',     symbol: 'figure.run',            color: '#FF3B30' },
  { type: 'cycling',  label: 'Radfahren',  symbol: 'figure.outdoor.cycle',  color: '#30D158' },
  { type: 'walking',  label: 'Gehen',      symbol: 'figure.walk',           color: '#0A84FF' },
  { type: 'hiking',   label: 'Wandern',    symbol: 'figure.hiking',         color: '#FF9F0A' },
  { type: 'swimming', label: 'Schwimmen',  symbol: 'figure.pool.swim',      color: '#5E5CE6' },
];

interface Props {
  selected: WorkoutType;
  onChange: (type: WorkoutType) => void;
}

export const SportCarousel = ({ selected, onChange }: Props) => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const selectedIndex = SPORTS.findIndex(s => s.type === selected);

  const scrollToIndex = useCallback((index: number) => {
    scrollRef.current?.scrollTo({
      x: index * (ITEM_WIDTH + ITEM_GAP),
      animated: true,
    });
    onChange(SPORTS[index].type);
  }, [onChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sportart</Text>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH + ITEM_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (ITEM_WIDTH + ITEM_GAP));
          onChange(SPORTS[Math.max(0, Math.min(index, SPORTS.length - 1))].type);
        }}
        initialScrollIndex={0}
      >
        {SPORTS.map((sport, index) => {
          const inputRange = [
            (index - 1.5) * (ITEM_WIDTH + ITEM_GAP),
            index * (ITEM_WIDTH + ITEM_GAP),
            (index + 1.5) * (ITEM_WIDTH + ITEM_GAP),
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.82, 1, 0.82],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.45, 1, 0.45],
            extrapolate: 'clamp',
          });

          const isActive = selected === sport.type;

          return (
            <Animated.View
              key={sport.type}
              style={[styles.itemWrap, { marginRight: ITEM_GAP, transform: [{ scale }], opacity }]}
            >
              <TouchableOpacity
                onPress={() => scrollToIndex(index)}
                activeOpacity={0.8}
                style={styles.itemTouchable}
              >
                <BlurView intensity={70} tint="dark" style={styles.itemBlur}>
                  {/* Active border glow */}
                  <View style={[
                    styles.itemBorder,
                    { borderColor: isActive ? sport.color : 'rgba(255,255,255,0.1)' },
                  ]} />

                  {/* Active background tint */}
                  {isActive && (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: sport.color + '18', borderRadius: 22 }]} />
                  )}

                  <SymbolView
                    name={sport.symbol as any}
                    size={32}
                    tintColor={isActive ? sport.color : '#636366'}
                  />
                  <Text style={[styles.itemLabel, { color: isActive ? sport.color : '#636366' }]}>
                    {sport.label}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SPORTS.map((s, i) => (
          <Animated.View
            key={s.type}
            style={[
              styles.dot,
              {
                backgroundColor: selected === s.type ? SPORTS[selectedIndex].color : '#3A3A3C',
                width: selected === s.type ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:      { paddingVertical: 16 },
  title:          { color: '#8E8E93', fontSize: 13, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingHorizontal: 20 },
  itemWrap:       { width: ITEM_WIDTH },
  itemTouchable:  { width: ITEM_WIDTH, height: 100 },
  itemBlur:       { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  itemBorder:     { ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1 },
  itemLabel:      { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  dots:           { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 14 },
  dot:            { height: 6, borderRadius: 3, overflow: 'hidden' },
});
