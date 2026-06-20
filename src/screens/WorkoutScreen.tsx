import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useWorkout } from '../hooks/useWorkout';
import { WorkoutType } from '../types/workout';

const SPORTS: { type: WorkoutType; symbol: string; label: string; color: string; hasGPS: boolean }[] = [
  { type: 'running',  symbol: 'figure.run',           label: 'Laufen',    color: '#FF3B30', hasGPS: true  },
  { type: 'cycling',  symbol: 'figure.outdoor.cycle', label: 'Radfahren', color: '#30D158', hasGPS: true  },
  { type: 'swimming', symbol: 'figure.pool.swim',     label: 'Schwimmen', color: '#5E5CE6', hasGPS: false },
  { type: 'tennis',   symbol: 'figure.tennis',        label: 'Tennis',    color: '#FF9F0A', hasGPS: false },
];

const fmt = {
  duration: (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  },
  pace:  (s: number) => (!s || s > 3600) ? '--:--' : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`,
  km:    (m: number) => (m / 1000).toFixed(2),
  speed: (kmh: number) => kmh.toFixed(1),
  alt:   (m: number) => `${Math.round(m)} m`,
};

export const WorkoutScreen = () => {
  const { isRunning, isSaving, metrics, route, startWorkout, stopWorkout } = useWorkout();
  const [selectedType, setSelectedType] = useState<WorkoutType>('running');
  const btnScale = useRef(new Animated.Value(1)).current;
  const mapRef   = useRef<MapView>(null);
  const sport    = SPORTS.find(w => w.type === selectedType) ?? SPORTS[0];

  const handlePress = useCallback(async () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.93, duration: 70, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }),
    ]).start();
    if (isRunning) stopWorkout();
    else await startWorkout(selectedType);
  }, [isRunning, selectedType]);

  const mapRegion = route.length > 0 ? {
    latitude:      route[route.length - 1].latitude,
    longitude:     route[route.length - 1].longitude,
    latitudeDelta: 0.005, longitudeDelta: 0.005,
  } : undefined;

  return (
    <View style={s.root}>
      {sport.hasGPS && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          region={mapRegion}
          showsUserLocation
          showsCompass={false}
          followsUserLocation={isRunning}
          userInterfaceStyle="dark"
        >
          {route.length > 1 && (
            <Polyline coordinates={route} strokeColor={sport.color} strokeWidth={5} lineCap="round" />
          )}
        </MapView>
      )}

      {!sport.hasGPS && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />}

      {/* Non-GPS idle */}
      {!sport.hasGPS && !isRunning && (
        <View style={s.noGpsCenter}>
          <SymbolView name={sport.symbol as any} size={100} tintColor={sport.color} />
          <Text style={s.noGpsLabel}>{sport.label}</Text>
          <Text style={s.noGpsSub}>HR via Apple Watch</Text>
        </View>
      )}

      {/* Non-GPS running */}
      {!sport.hasGPS && isRunning && (
        <View style={s.noGpsCenter}>
          <Text style={s.timerBig}>{fmt.duration(metrics.duration)}</Text>
          <View style={s.hrBadge}>
            <SymbolView name="heart.fill" size={16} tintColor="#FF3B30" />
            <Text style={s.hrBadgeText}>{metrics.heartRate > 0 ? metrics.heartRate : '--'} bpm</Text>
            {metrics.maxHeartRate > 0 && <Text style={s.hrBadgeSub}>max {metrics.maxHeartRate}</Text>}
          </View>
          <Text style={s.kcalBig}>{Math.round(metrics.calories)} kcal</Text>
        </View>
      )}

      {/* LIVE badge */}
      {isRunning && (
        <SafeAreaView style={s.liveBadgeWrap} pointerEvents="none">
          <View style={s.livePill}>
            <View style={[s.liveDot, { backgroundColor: sport.color }]} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </SafeAreaView>
      )}

      {/* Bottom sheet */}
      <SafeAreaView style={s.sheetSafe}>
        <BlurView intensity={85} tint="dark" style={s.sheet}>

          {/* ── RUNNING metrics ── */}
          {isRunning && selectedType === 'running' && (
            <View style={s.metricsBlock}>
              {/* HR hero */}
              <View style={s.hrHero}>
                <SymbolView name="heart.fill" size={18} tintColor={metrics.heartRate > 0 ? '#FF3B30' : '#3A3A3C'} />
                <Text style={s.hrNum}>{metrics.heartRate > 0 ? metrics.heartRate : '--'}</Text>
                <Text style={s.hrUnit}>bpm</Text>
                {metrics.maxHeartRate > 0 && <Text style={s.hrMax}>max {metrics.maxHeartRate}</Text>}
              </View>
              <View style={s.divider} />
              <View style={s.grid4}>
                <MetricCell label="Zeit"    value={fmt.duration(metrics.duration)} />
                <MetricCell label="km"      value={fmt.km(metrics.distance)} />
                <MetricCell label="min/km"  value={fmt.pace(metrics.pace)} />
                <MetricCell label="kcal"    value={String(Math.round(metrics.calories))} color="#FF9F0A" />
              </View>
            </View>
          )}

          {/* ── CYCLING metrics ── */}
          {isRunning && selectedType === 'cycling' && (
            <View style={s.metricsBlock}>
              {/* Speed hero */}
              <View style={s.speedHero}>
                <View style={s.speedMain}>
                  <Text style={s.speedNum}>{fmt.speed(metrics.speed)}</Text>
                  <Text style={s.speedUnit}>km/h</Text>
                </View>
                <View style={s.speedSide}>
                  <Text style={s.speedAvgLabel}>Ø</Text>
                  <Text style={s.speedAvg}>{fmt.speed(metrics.avgSpeed)}</Text>
                  <Text style={s.speedAvgUnit}>km/h</Text>
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.grid4}>
                <MetricCell label="Zeit"   value={fmt.duration(metrics.duration)} />
                <MetricCell label="km"     value={fmt.km(metrics.distance)} />
                <MetricCell label="kcal"   value={String(Math.round(metrics.calories))} color="#FF9F0A" />
                <MetricCell label="Höhe"   value={fmt.alt(metrics.altitude)} color="#8E8E93" />
              </View>
              <View style={s.grid2}>
                <MetricCell label="Puls"   value={metrics.heartRate > 0 ? `${metrics.heartRate}` : '--'} color="#FF3B30" />
                <MetricCell label="Max HR" value={metrics.maxHeartRate > 0 ? `${metrics.maxHeartRate}` : '--'} color="#FF3B30" />
              </View>
            </View>
          )}

          {/* ── NON-GPS metrics ── */}
          {isRunning && !sport.hasGPS && (
            <View style={s.grid4}>
              <MetricCell label="Zeit"   value={fmt.duration(metrics.duration)} />
              <MetricCell label="kcal"   value={String(Math.round(metrics.calories))} color="#FF9F0A" />
              <MetricCell label="HR"     value={metrics.heartRate > 0 ? `${metrics.heartRate}` : '--'} color="#FF3B30" />
              <MetricCell label="Max HR" value={metrics.maxHeartRate > 0 ? `${metrics.maxHeartRate}` : '--'} color="#FF3B30" />
            </View>
          )}

          {/* Sport selector */}
          {!isRunning && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
              {SPORTS.map(sp => {
                const active = sp.type === selectedType;
                return (
                  <TouchableOpacity
                    key={sp.type}
                    onPress={() => setSelectedType(sp.type)}
                    activeOpacity={0.75}
                    style={[s.pill, { backgroundColor: active ? sp.color : '#1C1C1E' }]}
                  >
                    <SymbolView name={sp.symbol as any} size={26} tintColor={active ? '#FFF' : '#8E8E93'} />
                    <Text style={[s.pillLabel, { color: active ? '#FFF' : '#8E8E93' }]}>{sp.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Button */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: isRunning ? '#FF3B30' : sport.color, opacity: isSaving ? 0.5 : 1 }]}
              onPress={handlePress}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              <SymbolView
                name={isSaving ? 'arrow.up.circle' : isRunning ? 'stop.fill' : 'play.fill'}
                size={20} tintColor="#FFF"
              />
              <Text style={s.btnLabel}>
                {isSaving ? 'Wird gespeichert…' : isRunning ? 'Training beenden' : `${sport.label} starten`}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </BlurView>
      </SafeAreaView>
    </View>
  );
};

const MetricCell = ({ label, value, color = '#FFFFFF' }: { label: string; value: string; color?: string }) => (
  <View style={s.cell}>
    <Text style={[s.cellVal, { color }]}>{value}</Text>
    <Text style={s.cellLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Non-GPS center
  noGpsCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 260 },
  noGpsLabel:  { color: '#FFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  noGpsSub:    { color: '#636366', fontSize: 14 },
  timerBig:    { color: '#FFF', fontSize: 72, fontWeight: '200', letterSpacing: -4 },
  kcalBig:     { color: '#FF9F0A', fontSize: 28, fontWeight: '300', marginTop: 8 },
  hrBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C1C1E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  hrBadgeText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  hrBadgeSub:  { color: '#636366', fontSize: 13 },

  // Live badge
  liveBadgeWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginTop: 10 },
  liveDot:       { width: 8, height: 8, borderRadius: 4 },
  liveText:      { color: '#FFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },

  // Sheet
  sheetSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:     { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },

  // Metrics
  metricsBlock: { gap: 12 },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E' },

  // Running HR hero
  hrHero:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  hrNum:    { color: '#FFF', fontSize: 58, fontWeight: '200', letterSpacing: -2, lineHeight: 62 },
  hrUnit:   { color: '#8E8E93', fontSize: 16, marginBottom: 8 },
  hrMax:    { color: '#636366', fontSize: 13, marginBottom: 10, marginLeft: 4 },

  // Cycling speed hero
  speedHero:    { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  speedMain:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  speedNum:     { color: '#30D158', fontSize: 58, fontWeight: '200', letterSpacing: -2, lineHeight: 62 },
  speedUnit:    { color: '#8E8E93', fontSize: 16, marginBottom: 8 },
  speedSide:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 8, paddingBottom: 2 },
  speedAvgLabel:{ color: '#636366', fontSize: 13, marginBottom: 4 },
  speedAvg:     { color: '#FFF', fontSize: 28, fontWeight: '300', letterSpacing: -1 },
  speedAvgUnit: { color: '#636366', fontSize: 12, marginBottom: 4 },

  // Grids
  grid4:  { flexDirection: 'row', justifyContent: 'space-between' },
  grid2:  { flexDirection: 'row', justifyContent: 'space-around' },
  cell:      { alignItems: 'center', gap: 3, flex: 1 },
  cellVal:   { fontSize: 20, fontWeight: '600', letterSpacing: -0.5 },
  cellLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '500' },

  // Pills
  pillRow:   { gap: 10, paddingVertical: 2 },
  pill:      { alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, minWidth: 82 },
  pillLabel: { fontSize: 12, fontWeight: '600' },

  // Button
  btn:      { borderRadius: 50, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnLabel: { color: '#FFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
});
