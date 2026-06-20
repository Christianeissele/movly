import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Modal, ScrollView, Dimensions,
  ActivityIndicator, Animated,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { WorkoutSession, WorkoutType } from '../types/workout';
import { loadWorkoutHistory } from '../services/workoutHistory';
import { getHeartRateSamples } from '../services/healthkit';
import { HRChart } from '../components/HRChart';

const { width: W } = Dimensions.get('window');

const TYPE_CONFIG: Record<string, { symbol: string; label: string; color: string }> = {
  running:  { symbol: 'figure.run',           label: 'Laufen',    color: '#FF3B30' },
  cycling:  { symbol: 'figure.outdoor.cycle', label: 'Radfahren', color: '#30D158' },
  swimming: { symbol: 'figure.pool.swim',     label: 'Schwimmen', color: '#5E5CE6' },
  tennis:   { symbol: 'figure.tennis',        label: 'Tennis',    color: '#FF9F0A' },
};

const fmt = {
  duration: (s: number) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}min` : `${m} min`; },
  date: (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }),
  time: (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  pace: (distM: number, durS: number) => {
    if (!distM || !durS) return '--:--';
    const s = durS / (distM / 1000);
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  },
};

export const HistoryScreen = () => {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [hrData, setHrData] = useState<number[]>([]);
  const [loadingHR, setLoadingHR] = useState(false);

  useEffect(() => {
    loadWorkoutHistory().then(data => { setWorkouts(data); setLoading(false); });
  }, []);

  const openDetail = async (w: WorkoutSession) => {
    setSelected(w);
    setHrData([]);
    if (w.endTime) {
      setLoadingHR(true);
      getHeartRateSamples(w.startTime, w.endTime)
        .then(s => setHrData(s.map(x => x.value)))
        .catch(() => setHrData([]))
        .finally(() => setLoadingHR(false));
    }
  };

  const weekAgo = Date.now() - 7 * 86400000;
  const week = workouts.filter(w => w.startTime.getTime() > weekAgo);
  const weekKcal = week.reduce((a, w) => a + w.calories, 0);
  const weekKm   = week.reduce((a, w) => a + w.distance / 1000, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aktivitäten</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#FF3B30" />
      ) : workouts.length === 0 ? (
        <View style={styles.emptyState}>
          <SymbolView name="figure.run.circle" size={64} tintColor="#3A3A3C" />
          <Text style={styles.emptyTitle}>Noch keine Trainings</Text>
          <Text style={styles.emptyText}>Starte dein erstes Training — es wird automatisch hier gespeichert.</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={w => w.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<WeeklySummary count={week.length} kcal={weekKcal} km={weekKm} />}
          renderItem={({ item, index }) => (
            <FadeInRow delay={index * 40}>
              <WorkoutRow workout={item} onPress={() => openDetail(item)} />
            </FadeInRow>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && <DetailSheet workout={selected} hrData={hrData} loadingHR={loadingHR} onClose={() => setSelected(null)} />}
      </Modal>
    </SafeAreaView>
  );
};

const FadeInRow = ({ children, delay }: { children: React.ReactNode; delay: number }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
};

const WeeklySummary = ({ count, kcal, km }: { count: number; kcal: number; km: number }) => (
  <View style={styles.summaryCard}>
    <Text style={styles.summaryHeading}>Diese Woche</Text>
    <View style={styles.summaryRow}>
      <SummaryItem symbol="flame.fill" value={String(Math.round(kcal))} label="kcal" color="#FF9F0A" />
      <View style={styles.summaryDivider} />
      <SummaryItem symbol="figure.run" value={km.toFixed(1)} label="km" color="#30D158" />
      <View style={styles.summaryDivider} />
      <SummaryItem symbol="checkmark.circle.fill" value={String(count)} label="Einheiten" color="#0A84FF" />
    </View>
  </View>
);

const SummaryItem = ({ symbol, value, label, color }: any) => (
  <View style={styles.summaryItem}>
    <SymbolView name={symbol} size={18} tintColor={color} />
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const WorkoutRow = ({ workout: w, onPress }: { workout: WorkoutSession; onPress: () => void }) => {
  const cfg = TYPE_CONFIG[w.type] ?? TYPE_CONFIG.other;
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={[styles.rowIcon, { backgroundColor: cfg.color + '1A' }]}>
          <SymbolView name={cfg.symbol as any} size={22} tintColor={cfg.color} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>{cfg.label}</Text>
          <Text style={styles.rowSub}>{fmt.date(w.startTime)} · {fmt.time(w.startTime)}</Text>
          <View style={styles.rowPills}>
            {w.distance > 0 && <Pill text={`${(w.distance/1000).toFixed(2)} km`} />}
            {w.calories > 0 && <Pill text={`${Math.round(w.calories)} kcal`} />}
            {w.avgHeartRate > 0 && <Pill text={`⌀ ${w.avgHeartRate} bpm`} />}
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.rowDuration}>{fmt.duration(w.duration)}</Text>
          <SymbolView name="chevron.right" size={12} tintColor="#636366" style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const Pill = ({ text }: { text: string }) => (
  <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>
);

const DetailSheet = ({ workout: w, hrData, loadingHR, onClose }: any) => {
  const cfg = TYPE_CONFIG[w.type] ?? TYPE_CONFIG.other;
  return (
    <SafeAreaView style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <ScrollView contentContainerStyle={styles.sheetScroll}>
        <View style={styles.sheetHeader}>
          <View style={[styles.rowIcon, { backgroundColor: cfg.color + '1A', width: 52, height: 52, borderRadius: 14 }]}>
            <SymbolView name={cfg.symbol as any} size={28} tintColor={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>{cfg.label}</Text>
            <Text style={styles.sheetDate}>{fmt.date(w.startTime)} · {fmt.time(w.startTime)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <SymbolView name="xmark.circle.fill" size={28} tintColor="#636366" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <StatCard symbol="arrow.triangle.swap" label="Distanz" value={(w.distance/1000).toFixed(2)} unit="km" color="#FFF" />
          <StatCard symbol="timer" label="Zeit" value={fmt.duration(w.duration)} unit="" color="#FFF" />
          <StatCard symbol="flame.fill" label="Kalorien" value={String(Math.round(w.calories))} unit="kcal" color="#FF9F0A" />
          <StatCard symbol="hare.fill" label="Pace" value={fmt.pace(w.distance, w.duration)} unit="min/km" color="#FFF" />
          {w.avgHeartRate > 0 && <StatCard symbol="heart.fill" label="Ø HR" value={String(w.avgHeartRate)} unit="bpm" color="#FF3B30" />}
          {w.maxHeartRate > 0 && <StatCard symbol="heart.fill" label="Max HR" value={String(w.maxHeartRate)} unit="bpm" color="#FF3B30" />}
        </View>

        {/* Route map */}
        {w.route && w.route.length > 1 && (() => {
          const lats = w.route.map((p: any) => p.latitude);
          const lons = w.route.map((p: any) => p.longitude);
          const region = {
            latitude:      (Math.max(...lats) + Math.min(...lats)) / 2,
            longitude:     (Math.max(...lons) + Math.min(...lons)) / 2,
            latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 1.5 + 0.002,
            longitudeDelta:(Math.max(...lons) - Math.min(...lons)) * 1.5 + 0.002,
          };
          return (
            <View style={styles.mapCard}>
              <MapView
                style={styles.miniMap}
                provider={PROVIDER_DEFAULT}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                userInterfaceStyle="dark"
                pointerEvents="none"
              >
                <Polyline
                  coordinates={w.route}
                  strokeColor={cfg.color}
                  strokeWidth={4}
                  lineCap="round"
                />
              </MapView>
            </View>
          );
        })()}

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <SymbolView name="heart.fill" size={16} tintColor="#FF3B30" />
            <Text style={styles.chartTitle}>Herzfrequenz</Text>
          </View>
          {loadingHR ? (
            <ActivityIndicator color="#FF3B30" style={{ height: 130 }} />
          ) : hrData.length > 1 ? (
            <HRChart data={hrData} width={W - 64} height={130} color="#FF3B30" />
          ) : (
            <Text style={styles.noData}>Keine HR-Daten — Apple Watch schreibt nach dem Training in Health ein.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const StatCard = ({ symbol, label, value, unit, color }: any) => (
  <View style={styles.statCard}>
    <SymbolView name={symbol} size={14} tintColor="#636366" />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  header:         { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle:    { color: '#FFF', fontSize: 34, fontWeight: '700', letterSpacing: 0.37 },
  list:           { paddingBottom: 32 },
  separator:      { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E', marginLeft: 76 },
  summaryCard:    { margin: 16, backgroundColor: '#1C1C1E', borderRadius: 20, padding: 18 },
  summaryHeading: { color: '#8E8E93', fontSize: 13, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: '#38383A' },
  summaryItem:    { alignItems: 'center', gap: 4 },
  summaryValue:   { color: '#FFF', fontSize: 22, fontWeight: '700' },
  summaryLabel:   { color: '#8E8E93', fontSize: 11 },
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowContent:     { flex: 1, gap: 3 },
  rowTitle:       { color: '#FFF', fontSize: 16, fontWeight: '600' },
  rowSub:         { color: '#8E8E93', fontSize: 13 },
  rowPills:       { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rowRight:       { alignItems: 'flex-end' },
  rowDuration:    { color: '#FFF', fontSize: 15, fontWeight: '600' },
  pill:           { backgroundColor: '#2C2C2E', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pillText:       { color: '#EBEBF5', fontSize: 11, fontWeight: '500' },
  sheet:          { flex: 1, backgroundColor: '#1C1C1E' },
  sheetHandle:    { width: 36, height: 5, backgroundColor: '#3A3A3C', borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  sheetScroll:    { padding: 20, gap: 16, paddingBottom: 40 },
  sheetHeader:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetTitle:     { color: '#FFF', fontSize: 22, fontWeight: '700' },
  sheetDate:      { color: '#8E8E93', fontSize: 14, marginTop: 2 },
  closeButton:    { padding: 4 },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:       { width: (W - 64) / 2, backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16, gap: 4 },
  statValue:      { fontSize: 28, fontWeight: '300', letterSpacing: -0.5 },
  statUnit:       { color: '#8E8E93', fontSize: 12 },
  statLabel:      { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  mapCard:        { borderRadius: 16, overflow: 'hidden', height: 200 },
  miniMap:        { flex: 1 },
  chartCard:      { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16 },
  chartHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  chartTitle:     { color: '#FFF', fontSize: 15, fontWeight: '600' },
  noData:         { color: '#636366', fontSize: 13, fontStyle: 'italic', paddingVertical: 20, lineHeight: 20 },
  emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle:     { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  emptyText:      { color: '#636366', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
