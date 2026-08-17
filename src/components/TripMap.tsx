import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Text, Animated } from 'react-native';
import { Linking } from 'react-native';

const openMaps = (lat: number, lng: number, label?: string) => {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const latLng = `${lat},${lng}`;
  const url = Platform.select({
    ios: `${scheme}${label || latLng}@${lat},${lng}`,
    android: `${scheme}${latLng}(${label || 'Location'})`
  }) as string;
  Linking.openURL(url);
};

const isWeb = Platform.OS === 'web';

// IMPORTANT: react-native-maps must NOT be required at module scope. Doing so
// evaluates its whole module tree (MapView, AnimatedRegion, Fabric specs) during
// app startup, before the React runtime is ready, which crashes on device with:
//   "TypeError: undefined cannot be used as a constructor"
// (surfaced through loadModuleImplementation/guardedLoadModule with the
// "[runtime not ready]" prefix). We require it lazily on first render instead.
let mapsApi: { MapView: any; Marker: any; Polyline: any } | null = null;

function getMapsApi(): { MapView: any; Marker: any; Polyline: any } | null {
  if (mapsApi) {
    return mapsApi;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maps = require('react-native-maps');
    mapsApi = {
      MapView: maps.default || maps,
      Marker: maps.Marker,
      Polyline: maps.Polyline,
    };
  } catch (e) {
    console.warn('react-native-maps not available:', e);
    mapsApi = null;
  }
  return mapsApi;
}

const TripMap: React.FC<{ points: { lat: number; lng: number; title?: string; color?: string; day?: number }[]; highlightIndex?: number; onMarkerPress?: (index: number) => void; actionLabel?: string; onAction?: () => void; redPins?: boolean; noLines?: boolean; showLabels?: boolean }> = ({ points, highlightIndex, onMarkerPress, actionLabel = 'Navigate', onAction, redPins = false, noLines = false, showLabels = false }) => {
  const region = points && points.length ? {
    latitude: points[0].lat,
    longitude: points[0].lng,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8
  } : { latitude: 0, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 };

  // Global numbering for markers (1..N)
  const numbered = points.map((p, i) => ({ ...p, num: i + 1 }));

  // Group points by day so each day's activities are connected with their own line
  // (never crossing between different days)
  const groups: Record<number, { lat: number; lng: number; title?: string; color?: string; day?: number; num: number }[]> = {};
  numbered.forEach((p) => {
    const d = p.day ?? 0;
    if (!groups[d]) groups[d] = [];
    groups[d].push(p);
  });
  const polylines = Object.values(groups).filter((g) => g.length > 1);

  const scalesRef = useRef<Animated.Value[]>([]);
  const api = getMapsApi();
  const { MapView, Marker, Polyline } = api || { MapView: null, Marker: null, Polyline: null };

  useEffect(() => {
    if (!scalesRef.current) scalesRef.current = [];
    points.forEach((_, i) => {
      if (!scalesRef.current[i]) scalesRef.current[i] = new Animated.Value(1);
    });
    scalesRef.current.forEach((v, i) => {
      const toValue = highlightIndex === i ? 1.4 : 1;
      Animated.spring(v, { toValue, useNativeDriver: true, speed: 20, bounciness: 10 } as any).start();
    });
  }, [points, highlightIndex]);

  if (isWeb || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.webPlaceholder}>
          <Text style={styles.webText}>
            {isWeb ? 'Map preview is unavailable on web.' : 'Map component is loading...'}
          </Text>
          {points.length > 0 && <Text style={styles.webText}>Saved {points.length} location(s).</Text>}
          {points.length > 0 && (
            <TouchableOpacity style={styles.navigate} onPress={() => onAction ? onAction() : openMaps(points[0].lat, points[0].lng, points[0].title)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{actionLabel === 'Navigate' ? 'Open in Maps' : actionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={region}
        provider="google"
      >
        {numbered.map((p, i) => {
          const color = redPins ? '#EF4444' : p.color || '#1B6EF3';
          return (
            <Marker 
              key={i} 
              coordinate={{ latitude: p.lat, longitude: p.lng }} 
              title={`${p.num}. ${p.title || ''}`} 
              pinColor={color}
              onPress={() => onMarkerPress && onMarkerPress(i)}
            >
              <View style={styles.markerWrap}>
                <Animated.View style={[styles.marker, { borderColor: color }, highlightIndex === i && styles.markerHighlight, { transform: [{ scale: scalesRef.current[i] || new Animated.Value(1) }] }]}>
                  <Text style={[styles.markerText, { color }, highlightIndex === i && { color: '#fff' }]}>{p.num}</Text>
                </Animated.View>
                {showLabels && p.title ? (
                  <View style={[styles.markerLabel, { backgroundColor: color }]}>
                    <Text style={styles.markerLabelText} numberOfLines={1}>{p.title}</Text>
                  </View>
                ) : null}
              </View>
            </Marker>
          );
        })}
        {(noLines ? [] : polylines).map((group, gi) => (
          <Polyline
            key={`poly-${gi}`}
            coordinates={group.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeWidth={3}
            strokeColor={group[0]?.color || '#1B6EF3'}
          />
        ))}
      </MapView>
      {points.length > 0 && (
        <TouchableOpacity style={styles.navigate} onPress={() => onAction ? onAction() : openMaps(points[0].lat, points[0].lng, points[0].title)}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 18, overflow: 'hidden', marginVertical: 12 },
  map: { flex: 1 },
  navigate: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#1B6EF3', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 999 },
  markerWrap: { alignItems: 'center' },
  marker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1B6EF3' },
  markerLabel: { marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, maxWidth: 140, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  markerLabelText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  markerText: { color: '#1B6EF3', fontWeight: '700' },
  markerHighlight: { backgroundColor: '#1B6EF3', borderColor: '#fff' },
  markerHighlightText: { color: '#fff' },
  webPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FE', borderRadius: 18 },
  webText: { color: '#64748B', fontWeight: '600' }
});


export default TripMap;
