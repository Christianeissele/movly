import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Modal, ScrollView, Dimensions,
  ActivityIndicator, Animated,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { WorkoutSession, WorkoutType, HR_ZONE_COLORS } from '../types/workout';
import { loadWorkoutHistory } from '../services/workoutHistory';
import { getHeartRateSamples, getDailySteps, getWeeklySteps, importHealthKitWorkouts } from '../services/healthkit';
import { saveWorkout, fetchWorkouts, deleteWorkout } from '../services/api';
import { HRChart } from '../components/HRChart';

const { width: W } = Dimensions.get('window');

const TYPE_CONFIG: Record<string, { symbol: string; label: string; color: string }> = {
  running:  { symbol: 'figure.run',           label: 'Laufen',    color: '#FF3B30' },
  cycling:  { symbol: 'figure.outdoor.cycle', label: 'Radfahren', color: '#30D158' },
  swimming: { symbol: 'figure.pool.swim',     label: 'Schwimmen', color: '#5E5CE6' },
  tennis:   { symbol: 'figure.tennis',        label: 'Tennis',    color: '#FF9F0A' },
};

const FEELINGS: Record<number, string> = { 1: '😓', 2: '😕', 3: '🙂', 4: '😊', 5: '🔥' };

const fmt = {
  duration: (s: number) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}min` : `${m} min`; },
  date: (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }),
  time: (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  pace: (distM: number, durS: number) => {
    if (!distM || !durS) return '--:--';
    const s = durS / (distM / 1000);
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  },
  speed: (distM: number, durS: number) => durS > 0 ? ((distM/1000)/(durS/3600)).toFixed(1) : '0.0',
};

// ─── Personal Records ────────────────────────────────────────────────────────
const computeRecords = (workouts: WorkoutSession[]) => {
  const runs    = workouts.filter(w => w.type === 'running');
  const cycles  = workouts.filter(w => w.type === 'cycling');
  const all     = workouts;
  return {
    longestRun:      runs.length   ? Math.max(...runs.map(w => w.distance))   : 0,
    fastestPace:     runs.filter(w => w.distance >= 5000).length
      ? Math.min(...runs.filter(w => w.distance >= 5000).map(w => w.duration / (w.distance / 1000))) : 0,
    longestRide:     cycles.length ? Math.max(...cycles.map(w => w.distance)) : 0,
    maxSpeed:        cycles.length ? Math.max(...cycles.map(w => w.maxSpeed)) : 0,
    maxElevGain:     all.length    ? Math.max(...all.map(w => w.elevGain))    : 0,
    mostCalories:    all.length    ? Math.max(...all.map(w => w.calories))    : 0,
    longestDuration: all.length    ? Math.max(...all.map(w => w.duration))    : 0,
  };
};

// ─── Streak ──────────────────────────────────────────────────────────────────
const computeStreak = (workouts: WorkoutSession[]) => {
  const days = new Set(workouts.map(w => w.startTime.toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }
  return streak;
};

// ─── Heatmap data (last 16 weeks) ─────────────────────────────────────────────
const buildHeatmap = (workouts: WorkoutSession[]) => {
  const map: Record<string, number> = {};
  workouts.forEach(w => {
    const k = w.startTime.toDateString();
    map[k] = (map[k] ?? 0) + 1;
  });
  const cells: Array<{ date: Date; count: number }> = [];
  const today = new Date(); today.setHours(0,0,0,0);
  // Start from Monday of 15 weeks ago
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - 15 * 7 - today.getDay() + 1);
  for (let i = 0; i < 16 * 7; i++) {
    const d = new Date(startDay); d.setDate(startDay.getDate() + i);
    cells.push({ date: d, count: map[d.toDateString()] ?? 0 });
  }
  return cells;
};

// ─── HistoryScreen ─────────────────────────────────────────────────────────────
export const HistoryScreen = () => {
  const [workouts, setWorkouts]   = useState<WorkoutSession[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<WorkoutSession | null>(null);
  const [hrData, setHrData]       = useState<number[]>([]);
  const [loadingHR, setLoadingHR] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [tab, setTab]             = useState<'list' | 'stats' | 'records'>('list');

  // Stats tab state
  const [todaySteps, setTodaySteps]   = useState(0);
  const [weekSteps, setWeekSteps]     = useState<number[]>([]);
  const [stepGoal] = useState(8000);

  const reload = useCallback(async () => {
    const data = await loadWorkoutHistory();
    setWorkouts(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, []);

  // Load stats when stats tab opens
  useEffect(() => {
    if (tab !== 'stats') return;
    getDailySteps(new Date()).then(setTodaySteps);
    getWeeklySteps().then(setWeekSteps);
  }, [tab]);

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

  const handleImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const hkWo = await importHealthKitWorkouts();
      if (!hkWo.length) { setImportMsg('Keine Trainings in Apple Health.'); return; }
      const existing = await fetchWorkouts();
      const times    = existing.map(w => w.startTime.getTime());
      const toSave   = hkWo.filter(w => !times.some(t => Math.abs(t - w.startTime.getTime()) < 2000));
      if (!toSave.length) { setImportMsg('Alles bereits importiert.'); return; }
      for (const w of toSave) await saveWorkout(w);
      setImportMsg(`${toSave.length} Training${toSave.length !== 1 ? 's' : ''} importiert`);
      await reload();
    } catch (e: any) {
      setImportMsg(`Fehler: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteWorkout(id);
    setSelected(null);
    await reload();
  };

  // ── weekly summary ──
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const week    = workouts.filter(w => w.startTime.getTime() > weekAgo);
  const weekKcal = week.reduce((a, w) => a + w.calories, 0);
  const weekKm   = week.reduce((a, w) => a + w.distance / 1000, 0);

  return (
    <SafeAreaView style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.headerTitle}>Aktivitäten</Text>
        <TouchableOpacity onPress={handleImport} disabled={importing} style={st.importBtn}>
          {importing ? <ActivityIndicator color="#0A84FF" size="small" />
            : <SymbolView name="square.and.arrow.down" size={22} tintColor="#0A84FF" />}
        </TouchableOpacity>
      </View>

      {importMsg && (
        <TouchableOpacity onPress={() => setImportMsg(null)} style={st.banner}>
          <Text style={st.bannerText}>{importMsg}</Text>
          <SymbolView name="xmark" size={11} tintColor="#8E8E93" />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={st.tabs}>
        {(['list', 'stats', 'records'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[st.tabBtn, tab === t && st.tabActive]}
          >
            <Text style={[st.tabText, tab === t && st.tabTextActive]}>
              {t === 'list' ? 'Aktivitäten' : t === 'stats' ? 'Stats' : 'Rekorde'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#FF3B30" />
      ) : tab === 'list' ? (
        <ListTab
          workouts={workouts} week={week} weekKcal={weekKcal} weekKm={weekKm}
          onOpen={openDetail}
        />
      ) : tab === 'stats' ? (
        <StatsTab
          workouts={workouts} todaySteps={todaySteps} weekSteps={weekSteps}
          stepGoal={stepGoal} weekKcal={weekKcal} weekKm={weekKm} weekCount={week.length}
        />
      ) : (
        <RecordsTab workouts={workouts} />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <DetailSheet
            workout={selected} hrData={hrData} loadingHR={loadingHR}
            onClose={() => setSelected(null)}
            onDelete={() => handleDelete(selected.id)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
};

// ─── List Tab ─────────────────────────────────────────────────────────────────
const ListTab = ({ workouts, week, weekKcal, weekKm, onOpen }: any) => {
  if (workouts.length === 0) return (
    <View style={st.emptyState}>
      <SymbolView name="figure.run.circle" size={64} tintColor="#3A3A3C" />
      <Text style={st.emptyTitle}>Noch keine Trainings</Text>
      <Text style={st.emptyText}>Starte dein erstes Training oder importiere aus Apple Health.</Text>
    </View>
  );
  return (
    <FlatList
      data={workouts}
      keyExtractor={w => w.id}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListHeaderComponent={<WeeklySummary count={week.length} kcal={weekKcal} km={weekKm} />}
      renderItem={({ item, index }) => (
        <FadeInRow delay={index * 30}>
          <WorkoutRow workout={item} onPress={() => onOpen(item)} />
        </FadeInRow>
      )}
      ItemSeparatorComponent={() => <View style={st.separator} />}
    />
  );
};

// ─── Stats Tab ─────────────────────────────────────────────────────────────────
const StatsTab = ({ workouts, todaySteps, weekSteps, stepGoal, weekKcal, weekKm, weekCount }: any) => {
  const streak  = computeStreak(workouts);
  const heatmap = buildHeatmap(workouts);
  const stepPct = Math.min(1, todaySteps / stepGoal);
  const CELL    = (W - 48) / 16 - 2;

  // Monthly km
  const months: Record<string, number> = {};
  workouts.forEach((w: WorkoutSession) => {
    const k = `${w.startTime.getFullYear()}-${String(w.startTime.getMonth()+1).padStart(2,'0')}`;
    months[k] = (months[k] ?? 0) + w.distance / 1000;
  });
  const last6 = Object.entries(months).sort().slice(-6);
  const maxKm  = Math.max(1, ...last6.map(([,v]) => v));
  const BAR_W  = (W - 64) / Math.max(last6.length, 1) - 8;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      {/* Schritte heute */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Schritte heute</Text>
        <View style={st.stepsRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.stepsNum}>{todaySteps.toLocaleString('de-DE')}</Text>
            <Text style={st.stepsGoal}>Ziel: {stepGoal.toLocaleString('de-DE')}</Text>
            <View style={st.stepBar}>
              <View style={[st.stepFill, { width: `${stepPct * 100}%` }]} />
            </View>
          </View>
          <View style={st.stepRing}>
            <Text style={st.stepRingPct}>{Math.round(stepPct * 100)}%</Text>
          </View>
        </View>
      </View>

      {/* Wochensteps Balken */}
      {weekSteps.length > 0 && (
        <View style={st.card}>
          <Text style={st.cardTitle}>Schritte letzte 7 Tage</Text>
          <WeekStepsChart steps={weekSteps} goal={stepGoal} />
        </View>
      )}

      {/* Diese Woche */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Diese Woche</Text>
        <View style={st.row3}>
          <StatItem symbol="flame.fill" value={String(Math.round(weekKcal))} label="kcal" color="#FF9F0A" />
          <StatItem symbol="figure.run" value={weekKm.toFixed(1)} label="km" color="#30D158" />
          <StatItem symbol="checkmark.circle.fill" value={String(weekCount)} label="Einheiten" color="#0A84FF" />
          <StatItem symbol="flame.fill" value={String(streak)} label="Streak 🔥" color="#FF3B30" />
        </View>
      </View>

      {/* Monthly km chart */}
      {last6.length > 0 && (
        <View style={st.card}>
          <Text style={st.cardTitle}>km pro Monat</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100, paddingTop: 8 }}>
            {last6.map(([month, km]) => {
              const h = Math.max(6, (km / maxKm) * 80);
              const label = month.slice(5);
              return (
                <View key={month} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#8E8E93', fontSize: 9, marginBottom: 4 }}>{km.toFixed(0)}</Text>
                  <View style={{ width: '80%', height: h, backgroundColor: '#30D158', borderRadius: 4 }} />
                  <Text style={{ color: '#636366', fontSize: 9, marginTop: 4 }}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Heatmap */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Kalender-Aktivität (16 Wochen)</Text>
        <Heatmap cells={heatmap} cellSize={CELL} />
      </View>
    </ScrollView>
  );
};

const WeekStepsChart = ({ steps, goal }: { steps: number[]; goal: number }) => {
  const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const maxS = Math.max(goal, ...steps);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80, marginTop: 8 }}>
      {steps.map((s, i) => {
        const h = Math.max(4, (s / maxS) * 60);
        const done = s >= goal;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: '80%', height: h, backgroundColor: done ? '#30D158' : '#0A84FF', borderRadius: 4 }} />
            <Text style={{ color: '#636366', fontSize: 9, marginTop: 4 }}>{DAY_LABELS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
};

const Heatmap = ({ cells, cellSize }: { cells: Array<{ date: Date; count: number }>; cellSize: number }) => {
  const weeks: Array<typeof cells> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const colors = ['#1C1C1E', '#0A3A0A', '#1A6A1A', '#30D158'];
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginTop: 8 }}>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'column', gap: 2 }}>
          {week.map((cell, di) => (
            <View
              key={di}
              style={{
                width: cellSize, height: cellSize, borderRadius: 2,
                backgroundColor: colors[Math.min(cell.count, 3)],
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const StatItem = ({ symbol, value, label, color }: any) => (
  <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
    <SymbolView name={symbol} size={16} tintColor={color} />
    <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{value}</Text>
    <Text style={{ color: '#8E8E93', fontSize: 11 }}>{label}</Text>
  </View>
);

// ─── Records Tab ──────────────────────────────────────────────────────────────
const RecordsTab = ({ workouts }: { workouts: WorkoutSession[] }) => {
  const r       = computeRecords(workouts);
  const streak  = computeStreak(workouts);
  const totalKm = workouts.reduce((a, w) => a + w.distance / 1000, 0);
  const totalH  = workouts.reduce((a, w) => a + w.duration / 3600, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={st.recSection}>Gesamtstatistik</Text>
      <View style={st.recGrid}>
        <RecordCard icon="road.lanes" label="Gesamt km" value={totalKm.toFixed(0)} unit="km" color="#30D158" />
        <RecordCard icon="clock" label="Gesamt Zeit" value={totalH.toFixed(1)} unit="h" color="#0A84FF" />
        <RecordCard icon="figure.run.circle" label="Aktivitäten" value={String(workouts.length)} unit="" color="#FF9F0A" />
        <RecordCard icon="flame.fill" label="Aktiv-Streak" value={String(streak)} unit="Tage" color="#FF3B30" />
      </View>

      <Text style={st.recSection}>Persönliche Rekorde</Text>
      <View style={st.recGrid}>
        {r.longestRun > 0 && <RecordCard icon="figure.run" label="Längster Lauf" value={(r.longestRun/1000).toFixed(2)} unit="km" color="#FF3B30" />}
        {r.fastestPace > 0 && <RecordCard icon="hare.fill" label="Schnellste 5km Pace" value={`${Math.floor(r.fastestPace/60)}:${Math.floor(r.fastestPace%60).toString().padStart(2,'0')}`} unit="min/km" color="#FF3B30" />}
        {r.longestRide > 0 && <RecordCard icon="figure.outdoor.cycle" label="Längste Fahrt" value={(r.longestRide/1000).toFixed(2)} unit="km" color="#30D158" />}
        {r.maxSpeed > 0 && <RecordCard icon="speedometer" label="Maximal Speed" value={r.maxSpeed.toFixed(1)} unit="km/h" color="#30D158" />}
        {r.maxElevGain > 0 && <RecordCard icon="mountain.2.fill" label="Meiste Höhenmeter" value={String(Math.round(r.maxElevGain))} unit="m" color="#0A84FF" />}
        {r.mostCalories > 0 && <RecordCard icon="flame.fill" label="Meiste Kalorien" value={String(Math.round(r.mostCalories))} unit="kcal" color="#FF9F0A" />}
      </View>
    </ScrollView>
  );
};

const RecordCard = ({ icon, label, value, unit, color }: any) => (
  <View style={st.recCard}>
    <SymbolView name={icon} size={20} tintColor={color} />
    <Text style={[st.recValue, { color }]}>{value} <Text style={st.recUnit}>{unit}</Text></Text>
    <Text style={st.recLabel}>{label}</Text>
  </View>
);

// ─── Shared components ─────────────────────────────────────────────────────────
const FadeInRow = ({ children, delay }: { children: React.ReactNode; delay: number }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
};

const WeeklySummary = ({ count, kcal, km }: { count: number; kcal: number; km: number }) => (
  <View style={st.summaryCard}>
    <Text style={st.summaryHeading}>Diese Woche</Text>
    <View style={st.summaryRow}>
      <SummaryItem symbol="flame.fill" value={String(Math.round(kcal))} label="kcal" color="#FF9F0A" />
      <View style={st.summaryDivider} />
      <SummaryItem symbol="figure.run" value={km.toFixed(1)} label="km" color="#30D158" />
      <View style={st.summaryDivider} />
      <SummaryItem symbol="checkmark.circle.fill" value={String(count)} label="Einheiten" color="#0A84FF" />
    </View>
  </View>
);

const SummaryItem = ({ symbol, value, label, color }: any) => (
  <View style={st.summaryItem}>
    <SymbolView name={symbol} size={18} tintColor={color} />
    <Text style={st.summaryValue}>{value}</Text>
    <Text style={st.summaryLabel}>{label}</Text>
  </View>
);

const WorkoutRow = ({ workout: w, onPress }: { workout: WorkoutSession; onPress: () => void }) => {
  const cfg   = TYPE_CONFIG[w.type] ?? TYPE_CONFIG.running;
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={st.row} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start()}
      >
        <View style={[st.rowIcon, { backgroundColor: cfg.color + '1A' }]}>
          <SymbolView name={cfg.symbol as any} size={22} tintColor={cfg.color} />
        </View>
        <View style={st.rowContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={st.rowTitle}>{cfg.label}</Text>
            {w.feeling && <Text style={{ fontSize: 14 }}>{FEELINGS[w.feeling]}</Text>}
          </View>
          <Text style={st.rowSub}>{fmt.date(w.startTime)} · {fmt.time(w.startTime)}</Text>
          <View style={st.rowPills}>
            {w.distance > 0 && <Pill text={`${(w.distance/1000).toFixed(2)} km`} />}
            {w.calories > 0 && <Pill text={`${Math.round(w.calories)} kcal`} />}
            {w.avgHeartRate > 0 && <Pill text={`⌀ ${w.avgHeartRate} bpm`} />}
            {w.elevGain > 0 && <Pill text={`↑ ${Math.round(w.elevGain)} m`} />}
          </View>
        </View>
        <View style={st.rowRight}>
          <Text style={st.rowDuration}>{fmt.duration(w.duration)}</Text>
          <SymbolView name="chevron.right" size={12} tintColor="#636366" style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const Pill = ({ text }: { text: string }) => (
  <View style={st.pill}><Text style={st.pillText}>{text}</Text></View>
);

const DetailSheet = ({ workout: w, hrData, loadingHR, onClose, onDelete }: any) => {
  const cfg = TYPE_CONFIG[w.type] ?? TYPE_CONFIG.running;
  return (
    <SafeAreaView style={st.sheet}>
      <View style={st.sheetHandle} />
      <ScrollView contentContainerStyle={st.sheetScroll}>
        <View style={st.sheetHeader}>
          <View style={[st.rowIcon, { backgroundColor: cfg.color + '1A', width: 52, height: 52, borderRadius: 14 }]}>
            <SymbolView name={cfg.symbol as any} size={28} tintColor={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={st.sheetTitle}>{cfg.label}</Text>
              {w.feeling && <Text style={{ fontSize: 20 }}>{FEELINGS[w.feeling]}</Text>}
            </View>
            <Text style={st.sheetDate}>{fmt.date(w.startTime)} · {fmt.time(w.startTime)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={st.closeBtn}>
            <SymbolView name="xmark.circle.fill" size={28} tintColor="#636366" />
          </TouchableOpacity>
        </View>

        {w.notes && (
          <View style={st.notesCard}>
            <Text style={st.notesText}>"{w.notes}"</Text>
          </View>
        )}

        <View style={st.statsGrid}>
          {w.distance > 0 && <StatCard symbol="arrow.triangle.swap" label="Distanz"    value={(w.distance/1000).toFixed(2)} unit="km" color="#FFF" />}
          <StatCard symbol="timer"               label="Zeit"        value={fmt.duration(w.duration)} unit="" color="#FFF" />
          {w.movingTime > 0 && w.movingTime !== w.duration &&
            <StatCard symbol="figure.walk"        label="Bewegung"    value={fmt.duration(w.movingTime)} unit="" color="#8E8E93" />}
          {w.calories > 0 && <StatCard symbol="flame.fill"    label="Kalorien"   value={String(Math.round(w.calories))} unit="kcal" color="#FF9F0A" />}
          {w.distance > 0 && w.type === 'running' &&
            <StatCard symbol="hare.fill"          label="Pace"        value={fmt.pace(w.distance, w.duration)} unit="min/km" color="#FFF" />}
          {w.distance > 0 && w.type === 'cycling' &&
            <StatCard symbol="speedometer"        label="Ø Speed"     value={fmt.speed(w.distance, w.duration)} unit="km/h" color="#30D158" />}
          {w.maxSpeed > 0 &&
            <StatCard symbol="speedometer"        label="Max Speed"   value={w.maxSpeed.toFixed(1)} unit="km/h" color="#30D158" />}
          {w.avgHeartRate > 0 && <StatCard symbol="heart.fill" label="Ø HR"       value={String(w.avgHeartRate)} unit="bpm" color="#FF3B30" />}
          {w.maxHeartRate > 0 && <StatCard symbol="heart.fill" label="Max HR"     value={String(w.maxHeartRate)} unit="bpm" color="#FF3B30" />}
          {w.elevGain > 0 && <StatCard symbol="arrow.up.right"   label="Aufstieg"   value={String(Math.round(w.elevGain))} unit="m" color="#0A84FF" />}
          {w.elevLoss > 0 && <StatCard symbol="arrow.down.right" label="Abstieg"    value={String(Math.round(w.elevLoss))} unit="m" color="#FF9F0A" />}
        </View>

        {/* Route map */}
        {w.route?.length > 1 && (() => {
          const lats = w.route.map((p: any) => p.latitude);
          const lons = w.route.map((p: any) => p.longitude);
          const region = {
            latitude:       (Math.max(...lats) + Math.min(...lats)) / 2,
            longitude:      (Math.max(...lons) + Math.min(...lons)) / 2,
            latitudeDelta:  (Math.max(...lats) - Math.min(...lats)) * 1.5 + 0.002,
            longitudeDelta: (Math.max(...lons) - Math.min(...lons)) * 1.5 + 0.002,
          };
          return (
            <View style={st.mapCard}>
              <MapView style={{ flex: 1 }} provider={PROVIDER_DEFAULT}
                region={region} scrollEnabled={false} zoomEnabled={false}
                userInterfaceStyle="dark" pointerEvents="none"
              >
                <Polyline coordinates={w.route} strokeColor={cfg.color} strokeWidth={4} lineCap="round" />
              </MapView>
            </View>
          );
        })()}

        {/* HR chart */}
        <View style={st.chartCard}>
          <View style={st.chartHeader}>
            <SymbolView name="heart.fill" size={16} tintColor="#FF3B30" />
            <Text style={st.chartTitle}>Herzfrequenz</Text>
          </View>
          {loadingHR ? (
            <ActivityIndicator color="#FF3B30" style={{ height: 130 }} />
          ) : hrData.length > 1 ? (
            <HRChart data={hrData} width={W - 64} height={130} color="#FF3B30" />
          ) : (
            <Text style={st.noData}>Keine HR-Daten verfügbar.</Text>
          )}
        </View>

        {/* Delete */}
        <TouchableOpacity onPress={() => onDelete(w.id)} style={st.deleteBtn}>
          <SymbolView name="trash" size={16} tintColor="#FF3B30" />
          <Text style={st.deleteBtnText}>Training löschen</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const StatCard = ({ symbol, label, value, unit, color }: any) => (
  <View style={st.statCard}>
    <SymbolView name={symbol} size={14} tintColor="#636366" />
    <Text style={[st.statValue, { color }]}>{value}</Text>
    {unit ? <Text style={st.statUnit}>{unit}</Text> : null}
    <Text style={st.statLabel}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  header:         { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:    { color: '#FFF', fontSize: 34, fontWeight: '700', letterSpacing: 0.37 },
  importBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  banner:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  bannerText:     { color: '#EBEBF5', fontSize: 13, flex: 1 },
  tabs:           { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1C1C1E', borderRadius: 10, padding: 2 },
  tabBtn:         { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  tabActive:      { backgroundColor: '#2C2C2E' },
  tabText:        { color: '#636366', fontSize: 13, fontWeight: '600' },
  tabTextActive:  { color: '#FFF' },
  emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle:     { color: '#FFF', fontSize: 20, fontWeight: '600' },
  emptyText:      { color: '#636366', fontSize: 15, textAlign: 'center', lineHeight: 22 },
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
  card:           { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 16 },
  cardTitle:      { color: '#8E8E93', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  stepsRow:       { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepsNum:       { color: '#FFF', fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  stepsGoal:      { color: '#636366', fontSize: 12, marginTop: 2 },
  stepBar:        { height: 6, backgroundColor: '#2C2C2E', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  stepFill:       { height: '100%', backgroundColor: '#30D158', borderRadius: 3 },
  stepRing:       { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: '#30D158', alignItems: 'center', justifyContent: 'center' },
  stepRingPct:    { color: '#30D158', fontSize: 14, fontWeight: '700' },
  row3:           { flexDirection: 'row', justifyContent: 'space-between' },
  recSection:     { color: '#8E8E93', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  recGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  recCard:        { width: (W - 44) / 2, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, gap: 4 },
  recValue:       { fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  recUnit:        { fontSize: 14, color: '#8E8E93' },
  recLabel:       { color: '#8E8E93', fontSize: 12 },
  sheet:          { flex: 1, backgroundColor: '#1C1C1E' },
  sheetHandle:    { width: 36, height: 5, backgroundColor: '#3A3A3C', borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  sheetScroll:    { padding: 20, gap: 16, paddingBottom: 40 },
  sheetHeader:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetTitle:     { color: '#FFF', fontSize: 22, fontWeight: '700' },
  sheetDate:      { color: '#8E8E93', fontSize: 14, marginTop: 2 },
  closeBtn:       { padding: 4 },
  notesCard:      { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 14 },
  notesText:      { color: '#EBEBF5', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:       { width: (W - 64) / 2, backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16, gap: 4 },
  statValue:      { fontSize: 26, fontWeight: '300', letterSpacing: -0.5 },
  statUnit:       { color: '#8E8E93', fontSize: 12 },
  statLabel:      { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  mapCard:        { borderRadius: 16, overflow: 'hidden', height: 200 },
  chartCard:      { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16 },
  chartHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  chartTitle:     { color: '#FFF', fontSize: 15, fontWeight: '600' },
  noData:         { color: '#636366', fontSize: 13, fontStyle: 'italic', paddingVertical: 20 },
  deleteBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  deleteBtnText:  { color: '#FF3B30', fontSize: 15 },
});
