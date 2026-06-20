import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useWorkout } from '../hooks/useWorkout';
import { WorkoutType } from '../types/workout';
import { MovlyLogo } from '../components/MovlyLogo';

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (secPerKm: number) => {
  if (!secPerKm || secPerKm > 3600) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

type WorkoutConfig = {
  type: WorkoutType;
  label: string;
  symbol: string;
  color: string;
};

const WORKOUT_TYPES: WorkoutConfig[] = [
  { type: 'running', label: 'Laufen', symbol: 'figure.run', color: '#FF3B30' },
  { type: 'cycling', label: 'Radfahren', symbol: 'figure.outdoor.cycle', color: '#30D158' },
  { type: 'walking', label: 'Gehen', symbol: 'figure.walk', color: '#0A84FF' },
  { type: 'hiking', label: 'Wandern', symbol: 'figure.hiking', color: '#FF9F0A' },
];

export const WorkoutScreen = () => {
  const { isRunning, metrics, route, startWorkout, stopWorkout } = useWorkout();
  const [selectedType, setSelectedType] = useState<WorkoutType>('running');
  const buttonScale = useSharedValue(1);
  const panelOffset = useSharedValue(0);

  const selectedConfig = WORKOUT_TYPES.find(w => w.type === selectedType)!;

  const handlePress = useCallback(async () => {
    buttonScale.value = withSpring(0.94, { duration: 100 }, () => {
      buttonScale.value = withSpring(1, { duration: 200 });
    });
    if (isRunning) {
      stopWorkout();
      panelOffset.value = withTiming(0, { duration: 400 });
    } else {
      await startWorkout(selectedType);
      panelOffset.value = withTiming(1, { duration: 400 });
    }
  }, [isRunning, selectedType]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const mapRegion = route.length > 0
    ? {
        latitude: route[route.length - 1].latitude,
        longitude: route[route.length - 1].longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : undefined;

  return (
    <View style={styles.container}>
      {/* Map fills the screen */}
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={mapRegion}
        showsUserLocation
        showsCompass={false}
        followsUserLocation={isRunning}
        userInterfaceStyle="dark"
      >
        {route.length > 1 && (
          <Polyline
            coordinates={route.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeColor={selectedConfig.color}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      <SafeAreaView style={styles.overlay}>
        {/* Header */}
        <BlurView intensity={60} tint="dark" style={styles.header}>
          <MovlyLogo size={28} showWordmark />
          {isRunning && (
            <View style={[styles.liveBadge, { backgroundColor: selectedConfig.color }]}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </BlurView>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Live Metrics Panel */}
          {isRunning && (
            <BlurView intensity={70} tint="dark" style={styles.metricsPanel}>
              {/* Primary metric — HR big */}
              <View style={styles.primaryMetric}>
                <SymbolView
                  name="heart.fill"
                  size={22}
                  tintColor={metrics.heartRate > 0 ? '#FF3B30' : '#636366'}
                  style={styles.metricIcon}
                />
                <Text style={styles.primaryValue}>
                  {metrics.heartRate > 0 ? metrics.heartRate : '--'}
                </Text>
                <Text style={styles.primaryUnit}>bpm</Text>
              </View>

              <View style={styles.divider} />

              {/* Secondary metrics grid */}
              <View style={styles.metricsGrid}>
                <MetricCell
                  symbol="timer"
                  value={formatDuration(metrics.duration)}
                  label="Zeit"
                  color="#FFFFFF"
                />
                <MetricCell
                  symbol="arrow.triangle.swap"
                  value={(metrics.distance / 1000).toFixed(2)}
                  label="km"
                  color="#FFFFFF"
                />
                <MetricCell
                  symbol="flame.fill"
                  value={String(Math.round(metrics.calories))}
                  label="kcal"
                  color="#FF9F0A"
                />
                <MetricCell
                  symbol="hare.fill"
                  value={formatPace(metrics.pace)}
                  label="min/km"
                  color="#FFFFFF"
                />
              </View>
            </BlurView>
          )}

          {/* Workout Type Picker */}
          {!isRunning && (
            <BlurView intensity={70} tint="dark" style={styles.typePicker}>
              <Text style={styles.typePickerTitle}>Trainingsart</Text>
              <View style={styles.typeGrid}>
                {WORKOUT_TYPES.map(w => (
                  <TouchableOpacity
                    key={w.type}
                    style={[
                      styles.typeItem,
                      selectedType === w.type && {
                        backgroundColor: w.color + '22',
                        borderColor: w.color,
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => setSelectedType(w.type)}
                    activeOpacity={0.7}
                  >
                    <SymbolView
                      name={w.symbol as any}
                      size={28}
                      tintColor={selectedType === w.type ? w.color : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        selectedType === w.type && { color: w.color },
                      ]}
                    >
                      {w.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </BlurView>
          )}
        </ScrollView>

        {/* Start / Stop Button */}
        <View style={styles.buttonRow}>
          <Animated.View style={buttonStyle}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isRunning ? '#FF3B30' : selectedConfig.color,
                },
              ]}
              onPress={handlePress}
              activeOpacity={0.85}
            >
              <SymbolView
                name={isRunning ? 'stop.fill' : 'play.fill'}
                size={26}
                tintColor="#FFFFFF"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.actionButtonText}>
                {isRunning ? 'Training beenden' : 'Training starten'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const MetricCell = ({
  symbol,
  value,
  label,
  color,
}: {
  symbol: string;
  value: string;
  label: string;
  color: string;
}) => (
  <View style={styles.metricCell}>
    <SymbolView name={symbol as any} size={14} tintColor="#8E8E93" />
    <Text style={[styles.metricCellValue, { color }]}>{value}</Text>
    <Text style={styles.metricCellLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  liveBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
    padding: 16,
    gap: 12,
    justifyContent: 'flex-end',
  },
  metricsPanel: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  primaryMetric: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 16,
  },
  metricIcon: { marginBottom: 8 },
  primaryValue: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '300',
    letterSpacing: -2,
    lineHeight: 68,
  },
  primaryUnit: {
    color: '#8E8E93',
    fontSize: 18,
    marginBottom: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#38383A',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCell: { alignItems: 'center', gap: 4 },
  metricCellValue: { fontSize: 20, fontWeight: '600' },
  metricCellLabel: { color: '#636366', fontSize: 11 },
  typePicker: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  typePickerTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  typeItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  buttonRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
});
