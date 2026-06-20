import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Keyboard, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { geocode, fetchRoute, LatLng, GeocodingResult, RouteResult } from '../services/routing';

const { width: W, height: H } = Dimensions.get('window');

const fmt = {
  dist: (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`,
  dur:  (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  },
};

type Mode = 'cycling' | 'foot';

export const RouteScreen = () => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<GeocodingResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const [focused, setFocused]           = useState(false);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [destination, setDestination]   = useState<GeocodingResult | null>(null);
  const [route, setRoute]               = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [mode, setMode]                 = useState<Mode>('cycling');

  const cardY = useRef(new Animated.Value(300)).current;

  // Get user location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleQueryChange = (text: string) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    if (!text.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await geocode(text)); } catch {}
      setSearching(false);
    }, 400);
  };

  const selectDestination = useCallback(async (result: GeocodingResult) => {
    setDestination(result);
    setQuery(result.name);
    setResults([]);
    Keyboard.dismiss();
    setFocused(false);

    if (!userLocation) return;
    setLoadingRoute(true);
    setRoute(null);

    try {
      const r = await fetchRoute(userLocation, { latitude: result.latitude, longitude: result.longitude }, mode);
      setRoute(r);
      Animated.spring(cardY, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }).start();
      // Fit map to route
      mapRef.current?.fitToCoordinates(r.coords, {
        edgePadding: { top: 120, right: 40, bottom: 260, left: 40 },
        animated: true,
      });
    } catch (e: any) {
      setDestination(null);
    } finally {
      setLoadingRoute(false);
    }
  }, [userLocation, mode]);

  const clearRoute = () => {
    setDestination(null);
    setRoute(null);
    setQuery('');
    Animated.timing(cardY, { toValue: 300, duration: 250, useNativeDriver: true }).start();
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500);
    }
  };

  const recenterMap = async () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    }
  };

  // Recalculate when mode changes
  useEffect(() => {
    if (!destination || !userLocation) return;
    (async () => {
      setLoadingRoute(true);
      try {
        const r = await fetchRoute(userLocation, { latitude: destination.latitude, longitude: destination.longitude }, mode);
        setRoute(r);
        mapRef.current?.fitToCoordinates(r.coords, {
          edgePadding: { top: 120, right: 40, bottom: 260, left: 40 },
          animated: true,
        });
      } catch {}
      setLoadingRoute(false);
    })();
  }, [mode]);

  const ACCENT = mode === 'cycling' ? '#30D158' : '#0A84FF';

  return (
    <View style={s.root}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsCompass={false}
        showsPointsOfInterest
        showsBuildings
        userInterfaceStyle="dark"
        initialRegion={userLocation
          ? { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          : { latitude: 48.1351, longitude: 11.5820, latitudeDelta: 0.1, longitudeDelta: 0.1 }
        }
      >
        {route && (
          <Polyline coordinates={route.coords} strokeColor={ACCENT} strokeWidth={5} lineCap="round" />
        )}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            pinColor={ACCENT}
          />
        )}
      </MapView>

      {/* Search bar */}
      <SafeAreaView style={s.searchWrap} edges={['top']}>
        <BlurView intensity={85} tint="dark" style={s.searchBar}>
          <SymbolView name="magnifyingglass" size={16} tintColor="#8E8E93" />
          <TextInput
            style={s.input}
            placeholder="Wohin?"
            placeholderTextColor="#636366"
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" color="#8E8E93" />}
          {destination && !focused && (
            <TouchableOpacity onPress={clearRoute}>
              <SymbolView name="xmark.circle.fill" size={18} tintColor="#636366" />
            </TouchableOpacity>
          )}
        </BlurView>

        {/* Search results */}
        {focused && results.length > 0 && (
          <BlurView intensity={90} tint="dark" style={s.resultsList}>
            {results.map((r, i) => (
              <React.Fragment key={r.address}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity style={s.resultRow} onPress={() => selectDestination(r)}>
                  <View style={s.resultIcon}>
                    <SymbolView name="mappin" size={14} tintColor="#8E8E93" />
                  </View>
                  <View style={s.resultText}>
                    <Text style={s.resultName} numberOfLines={1}>{r.name}</Text>
                    <Text style={s.resultAddr} numberOfLines={1}>{r.address}</Text>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </BlurView>
        )}
      </SafeAreaView>

      {/* Recenter button */}
      {!focused && (
        <TouchableOpacity style={[s.recenterBtn, { bottom: route ? 280 : 110 }]} onPress={recenterMap}>
          <BlurView intensity={80} tint="dark" style={s.recenterInner}>
            <SymbolView name="location.fill" size={18} tintColor="#0A84FF" />
          </BlurView>
        </TouchableOpacity>
      )}

      {/* Loading overlay */}
      {loadingRoute && (
        <View style={s.loadingOverlay} pointerEvents="none">
          <BlurView intensity={75} tint="dark" style={s.loadingPill}>
            <ActivityIndicator color={ACCENT} />
            <Text style={s.loadingText}>Route berechnen…</Text>
          </BlurView>
        </View>
      )}

      {/* Route info card */}
      {route && !loadingRoute && (
        <Animated.View style={[s.card, { transform: [{ translateY: cardY }] }]}>
          <BlurView intensity={90} tint="dark" style={s.cardInner}>
            {/* Destination name */}
            <Text style={s.cardTitle} numberOfLines={1}>{destination?.name}</Text>
            <Text style={s.cardAddr} numberOfLines={1}>{destination?.address}</Text>

            {/* Mode switcher */}
            <View style={s.modeRow}>
              <ModePill
                icon="figure.outdoor.cycle"
                label="Radfahren"
                active={mode === 'cycling'}
                color="#30D158"
                onPress={() => setMode('cycling')}
              />
              <ModePill
                icon="figure.run"
                label="Zu Fuß"
                active={mode === 'foot'}
                color="#0A84FF"
                onPress={() => setMode('foot')}
              />
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={[s.statValue, { color: ACCENT }]}>{fmt.dist(route.distance)}</Text>
                <Text style={s.statLabel}>Distanz</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={[s.statValue, { color: ACCENT }]}>{fmt.dur(route.duration)}</Text>
                <Text style={s.statLabel}>Dauer</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={[s.statValue, { color: '#FFF' }]}>
                  {((route.distance / 1000) / (route.duration / 3600)).toFixed(1)}
                </Text>
                <Text style={s.statLabel}>km/h</Text>
              </View>
            </View>

            {/* CTA */}
            <TouchableOpacity style={[s.startBtn, { backgroundColor: ACCENT }]}>
              <SymbolView name="play.fill" size={16} tintColor="#FFF" />
              <Text style={s.startBtnLabel}>Navigation starten</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
};

const ModePill = ({ icon, label, active, color, onPress }: any) => (
  <TouchableOpacity
    style={[s.modePill, active && { backgroundColor: color + '30', borderColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <SymbolView name={icon} size={18} tintColor={active ? color : '#636366'} />
    <Text style={[s.modePillLabel, { color: active ? color : '#636366' }]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#000' },

  // Search
  searchWrap:    { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, gap: 10 },
  searchBar:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  input:         { flex: 1, color: '#FFF', fontSize: 16, padding: 0 },
  resultsList:   { borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  resultRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  resultIcon:    { width: 32, height: 32, borderRadius: 8, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  resultText:    { flex: 1 },
  resultName:    { color: '#FFF', fontSize: 15, fontWeight: '500' },
  resultAddr:    { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  divider:       { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 58 },

  // Recenter
  recenterBtn:   { position: 'absolute', right: 16 },
  recenterInner: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },

  // Loading
  loadingOverlay:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  loadingPill:   { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, overflow: 'hidden' },
  loadingText:   { color: '#FFF', fontSize: 14 },

  // Card
  card:          { position: 'absolute', bottom: 0, left: 0, right: 0 },
  cardInner:     { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  cardTitle:     { color: '#FFF', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  cardAddr:      { color: '#8E8E93', fontSize: 13, marginTop: -8 },

  // Mode
  modeRow:       { flexDirection: 'row', gap: 10 },
  modePill:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#1C1C1E' },
  modePillLabel: { fontSize: 13, fontWeight: '600' },

  // Stats
  statsRow:      { flexDirection: 'row', alignItems: 'center' },
  stat:          { flex: 1, alignItems: 'center', gap: 4 },
  statValue:     { fontSize: 24, fontWeight: '600', letterSpacing: -0.5 },
  statLabel:     { color: '#8E8E93', fontSize: 11 },
  statDivider:   { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: '#38383A' },

  // Start button
  startBtn:      { borderRadius: 50, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  startBtnLabel: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
