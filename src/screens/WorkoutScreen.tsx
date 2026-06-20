import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useWorkout } from '../hooks/useWorkout';
import { WorkoutType, WorkoutSession, HR_ZONE_COLORS, HR_ZONE_LABELS } from '../types/workout';

const SPORTS: { type: WorkoutType; symbol: string; label: string; color: string; hasGPS: boolean }[] = [
  { type: 'running',  symbol: 'figure.run',           label: 'Laufen',    color: '#FF3B30', hasGPS: true  },
  { type: 'cycling',  symbol: 'figure.outdoor.cycle', label: 'Radfahren', color: '#30D158', hasGPS: true  },
  { type: 'swimming', symbol: 'figure.pool.swim',     label: 'Schwimmen', color: '#5E5CE6', hasGPS: false },
  { type: 'tennis',   symbol: 'figure.tennis',        label: 'Tennis',    color: '#FF9F0A', hasGPS: false },
];

const FEELINGS = [
  { value: 1, icon: '😓', label: 'Schwer' },
  { value: 2, icon: '😕', label: 'Mäßig' },
  { value: 3, icon: '🙂', label: 'Okay' },
  { value: 4, icon: '😊', label: 'Gut' },
  { value: 5, icon: '🔥', label: 'Top' },
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
  const { isRunning, isSaving, metrics, route, workoutType, pendingSession, startWorkout, stopWorkout, saveSession, discardPending } = useWorkout();
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

  const activeSport = SPORTS.find(s => s.type === workoutType) ?? sport;
  const zoneColor = HR_ZONE_COLORS[metrics.hrZone];

  return (
    <View style={s.root}>
      {activeSport.hasGPS && (
        <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT}
          region={mapRegion} showsUserLocation showsCompass={false}
          followsUserLocation={isRunning} userInterfaceStyle="dark"
        >
          {route.length > 1 && (
            <Polyline coordinates={route} strokeColor={activeSport.color} strokeWidth={5} lineCap="round" />
          )}
        </MapView>
      )}

      {!activeSport.hasGPS && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />}

      {/* Non-GPS idle */}
      {!activeSport.hasGPS && !isRunning && (
        <View style={s.noGpsCenter}>
          <SymbolView name={sport.symbol as any} size={100} tintColor={sport.color} />
          <Text style={s.noGpsLabel}>{sport.label}</Text>
          <Text style={s.noGpsSub}>HR via Apple Watch</Text>
        </View>
      )}

      {/* Non-GPS active */}
      {!activeSport.hasGPS && isRunning && (
        <View style={s.noGpsCenter}>
          <Text style={s.timerBig}>{fmt.duration(metrics.duration)}</Text>
          <View style={s.hrBadge}>
            <SymbolView name="heart.fill" size={16} tintColor={zoneColor} />
            <Text style={[s.hrBadgeText, { color: zoneColor }]}>{metrics.heartRate > 0 ? metrics.heartRate : '--'} bpm</Text>
            {metrics.hrZone > 0 && <Text style={[s.hrBadgeSub, { color: zoneColor }]}>{HR_ZONE_LABELS[metrics.hrZone]}</Text>}
          </View>
          <Text style={s.kcalBig}>{Math.round(metrics.calories)} kcal</Text>
        </View>
      )}

      {/* LIVE / PAUSE badge */}
      {isRunning && (
        <SafeAreaView style={s.liveBadgeWrap} pointerEvents="none">
          <View style={[s.livePill, metrics.isPaused && s.pausePill]}>
            <View style={[s.liveDot, { backgroundColor: metrics.isPaused ? '#FF9F0A' : activeSport.color }]} />
            <Text style={s.liveText}>{metrics.isPaused ? 'AUTO-PAUSE' : 'LIVE'}</Text>
          </View>
        </SafeAreaView>
      )}

      {/* Bottom sheet */}
      <SafeAreaView style={s.sheetSafe}>
        <BlurView intensity={85} tint="dark" style={s.sheet}>

          {/* RUNNING metrics */}
          {isRunning && workoutType === 'running' && (
            <View style={s.metricsBlock}>
              <View style={s.hrHero}>
                <SymbolView name="heart.fill" size={18} tintColor={metrics.heartRate > 0 ? zoneColor : '#3A3A3C'} />
                <Text style={[s.hrNum, { color: metrics.heartRate > 0 ? zoneColor : '#FFF' }]}>{metrics.heartRate > 0 ? metrics.heartRate : '--'}</Text>
                <Text style={s.hrUnit}>bpm</Text>
                {metrics.hrZone > 0 && (
                  <View style={[s.zonePill, { backgroundColor: zoneColor + '33' }]}>
                    <Text style={[s.zoneText, { color: zoneColor }]}>Z{metrics.hrZone} {HR_ZONE_LABELS[metrics.hrZone]}</Text>
                  </View>
                )}
              </View>
              <View style={s.divider} />
              <View style={s.grid4}>
                <MetricCell label="Zeit"    value={fmt.duration(metrics.duration)} />
                <MetricCell label="km"      value={fmt.km(metrics.distance)} />
                <MetricCell label="min/km"  value={fmt.pace(metrics.pace)} />
                <MetricCell label="kcal"    value={String(Math.round(metrics.calories))} color="#FF9F0A" />
              </View>
              <View style={s.grid4}>
                <MetricCell label="Bewegung" value={fmt.duration(metrics.movingTime)} color="#8E8E93" />
                <MetricCell label="↑ Aufst." value={fmt.alt(metrics.elevGain)} color="#30D158" />
                <MetricCell label="↓ Abst."  value={fmt.alt(metrics.elevLoss)} color="#FF9F0A" />
                <MetricCell label="Max HR"   value={metrics.maxHeartRate > 0 ? String(metrics.maxHeartRate) : '--'} color="#FF3B30" />
              </View>
            </View>
          )}

          {/* CYCLING metrics */}
          {isRunning && workoutType === 'cycling' && (
            <View style={s.metricsBlock}>
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
                <View style={s.speedSide}>
                  <Text style={s.speedAvgLabel}>Max</Text>
                  <Text style={s.speedAvg}>{fmt.speed(metrics.maxSpeed)}</Text>
                  <Text style={s.speedAvgUnit}>km/h</Text>
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.grid4}>
                <MetricCell label="Zeit"  value={fmt.duration(metrics.duration)} />
                <MetricCell label="km"    value={fmt.km(metrics.distance)} />
                <MetricCell label="kcal"  value={String(Math.round(metrics.calories))} color="#FF9F0A" />
                <MetricCell label="Höhe"  value={fmt.alt(metrics.altitude)} color="#8E8E93" />
              </View>
              <View style={s.grid4}>
                <MetricCell label="↑ Aufst." value={fmt.alt(metrics.elevGain)} color="#30D158" />
                <MetricCell label="↓ Abst."  value={fmt.alt(metrics.elevLoss)} color="#FF9F0A" />
                <MetricCell label="Puls"     value={metrics.heartRate > 0 ? `${metrics.heartRate}` : '--'} color={zoneColor} />
                <MetricCell label="Max HR"   value={metrics.maxHeartRate > 0 ? `${metrics.maxHeartRate}` : '--'} color="#FF3B30" />
              </View>
            </View>
          )}

          {/* NON-GPS metrics */}
          {isRunning && !activeSport.hasGPS && (
            <View style={s.grid4}>
              <MetricCell label="Zeit"   value={fmt.duration(metrics.duration)} />
              <MetricCell label="kcal"   value={String(Math.round(metrics.calories))} color="#FF9F0A" />
              <MetricCell label="HR"     value={metrics.heartRate > 0 ? `${metrics.heartRate}` : '--'} color={zoneColor} />
              <MetricCell label="Max HR" value={metrics.maxHeartRate > 0 ? `${metrics.maxHeartRate}` : '--'} color="#FF3B30" />
            </View>
          )}

          {/* Sport selector */}
          {!isRunning && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
              {SPORTS.map(sp => {
                const active = sp.type === selectedType;
                return (
                  <TouchableOpacity key={sp.type} onPress={() => setSelectedType(sp.type)}
                    activeOpacity={0.75} style={[s.pill, { backgroundColor: active ? sp.color : '#1C1C1E' }]}
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
              onPress={handlePress} activeOpacity={0.85} disabled={isSaving}
            >
              <SymbolView name={isSaving ? 'arrow.up.circle' : isRunning ? 'stop.fill' : 'play.fill'} size={20} tintColor="#FFF" />
              <Text style={s.btnLabel}>
                {isSaving ? 'Wird gespeichert…' : isRunning ? 'Training beenden' : `${sport.label} starten`}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </BlurView>
      </SafeAreaView>

      {/* Post-workout sheet */}
      {pendingSession && (
        <PostWorkoutSheet
          session={pendingSession}
          onSave={saveSession}
          onDiscard={discardPending}
        />
      )}
    </View>
  );
};

const PostWorkoutSheet = ({
  session, onSave, onDiscard,
}: { session: WorkoutSession; onSave: (s: WorkoutSession) => void; onDiscard: () => void }) => {
  const [feeling, setFeeling] = useState<number>(0);
  const [notes, setNotes]     = useState('');

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={ps.root}>
          <View style={ps.handle} />
          <ScrollView contentContainerStyle={ps.scroll}>
            <Text style={ps.title}>Training gespeichert</Text>

            {/* Quick stats */}
            <View style={ps.statsRow}>
              {session.distance > 0 && <QuickStat label="km"   value={(session.distance/1000).toFixed(2)} />}
              <QuickStat label="Zeit" value={fmt.duration(session.duration)} />
              {session.calories > 0 && <QuickStat label="kcal" value={String(Math.round(session.calories))} />}
            </View>

            {/* Feeling */}
            <Text style={ps.sectionLabel}>Wie war's?</Text>
            <View style={ps.feelingRow}>
              {FEELINGS.map(f => (
                <TouchableOpacity key={f.value} onPress={() => setFeeling(f.value)}
                  style={[ps.feelingBtn, feeling === f.value && ps.feelingActive]}
                >
                  <Text style={ps.feelingIcon}>{f.icon}</Text>
                  <Text style={[ps.feelingLabel, feeling === f.value && { color: '#FFF' }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={ps.sectionLabel}>Notizen</Text>
            <TextInput
              style={ps.noteInput}
              placeholder="Wie hat sich das Training angefühlt?"
              placeholderTextColor="#636366"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
            />

            <TouchableOpacity style={ps.saveBtn} onPress={() => onSave({ ...session, feeling: feeling || undefined, notes: notes || undefined })}>
              <Text style={ps.saveBtnText}>Speichern</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ps.discardBtn} onPress={onDiscard}>
              <Text style={ps.discardBtnText}>Verwerfen</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const QuickStat = ({ label, value }: { label: string; value: string }) => (
  <View style={ps.stat}>
    <Text style={ps.statValue}>{value}</Text>
    <Text style={ps.statLabel}>{label}</Text>
  </View>
);

const MetricCell = ({ label, value, color = '#FFFFFF' }: { label: string; value: string; color?: string }) => (
  <View style={s.cell}>
    <Text style={[s.cellVal, { color }]}>{value}</Text>
    <Text style={s.cellLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  noGpsCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 280 },
  noGpsLabel:  { color: '#FFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  noGpsSub:    { color: '#636366', fontSize: 14 },
  timerBig:    { color: '#FFF', fontSize: 72, fontWeight: '200', letterSpacing: -4 },
  kcalBig:     { color: '#FF9F0A', fontSize: 28, fontWeight: '300', marginTop: 8 },
  hrBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C1C1E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  hrBadgeText: { fontSize: 18, fontWeight: '600' },
  hrBadgeSub:  { fontSize: 13 },
  liveBadgeWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginTop: 10 },
  pausePill:   { backgroundColor: 'rgba(255,159,10,0.2)' },
  liveDot:     { width: 8, height: 8, borderRadius: 4 },
  liveText:    { color: '#FFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  sheetSafe:   { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  metricsBlock:{ gap: 12 },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E' },
  hrHero:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hrNum:       { fontSize: 58, fontWeight: '200', letterSpacing: -2, lineHeight: 62 },
  hrUnit:      { color: '#8E8E93', fontSize: 16, alignSelf: 'flex-end', marginBottom: 8 },
  zonePill:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4 },
  zoneText:    { fontSize: 12, fontWeight: '700' },
  speedHero:   { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  speedMain:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  speedNum:    { color: '#30D158', fontSize: 58, fontWeight: '200', letterSpacing: -2, lineHeight: 62 },
  speedUnit:   { color: '#8E8E93', fontSize: 16, marginBottom: 8 },
  speedSide:   { flexDirection: 'column', alignItems: 'center', marginBottom: 8 },
  speedAvgLabel:{ color: '#636366', fontSize: 11 },
  speedAvg:    { color: '#FFF', fontSize: 22, fontWeight: '300', letterSpacing: -1 },
  speedAvgUnit:{ color: '#636366', fontSize: 11 },
  grid4:       { flexDirection: 'row', justifyContent: 'space-between' },
  cell:        { alignItems: 'center', gap: 3, flex: 1 },
  cellVal:     { fontSize: 18, fontWeight: '600', letterSpacing: -0.5 },
  cellLabel:   { color: '#8E8E93', fontSize: 10, fontWeight: '500' },
  pillRow:     { gap: 10, paddingVertical: 2 },
  pill:        { alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, minWidth: 82 },
  pillLabel:   { fontSize: 12, fontWeight: '600' },
  btn:         { borderRadius: 50, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnLabel:    { color: '#FFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
});

const ps = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#1C1C1E' },
  handle:       { width: 36, height: 5, backgroundColor: '#3A3A3C', borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  scroll:       { padding: 24, gap: 0, paddingBottom: 40 },
  title:        { color: '#FFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },
  statsRow:     { flexDirection: 'row', gap: 16, marginBottom: 28, backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16, justifyContent: 'space-around' },
  stat:         { alignItems: 'center' },
  statValue:    { color: '#FFF', fontSize: 24, fontWeight: '300' },
  statLabel:    { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  sectionLabel: { color: '#8E8E93', fontSize: 13, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 },
  feelingRow:   { flexDirection: 'row', gap: 8, marginBottom: 24 },
  feelingBtn:   { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#2C2C2E', borderRadius: 14 },
  feelingActive:{ backgroundColor: '#0A84FF' },
  feelingIcon:  { fontSize: 24 },
  feelingLabel: { color: '#8E8E93', fontSize: 11, marginTop: 4 },
  noteInput:    { backgroundColor: '#2C2C2E', borderRadius: 14, padding: 16, color: '#FFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 24 },
  saveBtn:      { backgroundColor: '#0A84FF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText:  { color: '#FFF', fontSize: 17, fontWeight: '700' },
  discardBtn:   { alignItems: 'center', paddingVertical: 12 },
  discardBtnText:{ color: '#FF3B30', fontSize: 15 },
});
