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
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

if (!isWeb) {
  // Dynamically require react-native-maps only on native platforms.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const maps = require('react-native-maps');
  MapView = maps.default || maps;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
}

const TripMap: React.FC<{ points: { lat: number; lng: number; title?: string }[]; highlightIndex?: number; onMarkerPress?: (index: number) => void }> = ({ points, highlightIndex, onMarkerPress }) => {
  const region = points && points.length ? {
    latitude: points[0].lat,
    longitude: points[0].lng,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8
  } : { latitude: 0, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 };

  const scalesRef = useRef<Animated.Value[]>([]);

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

  if (isWeb) {
    return (
      <View style={styles.container}>
        <View style={styles.webPlaceholder}>
          <Text style={styles.webText}>Map preview is unavailable on web.</Text>
          {points.length > 0 && <Text style={styles.webText}>Saved {points.length} location(s).</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {points.map((p, i) => (
          <Marker key={i} coordinate={{ latitude: p.lat, longitude: p.lng }} title={`${i + 1}. ${p.title || ''}`} onPress={() => onMarkerPress && onMarkerPress(i)}>
            <Animated.View style={[styles.marker, highlightIndex === i && styles.markerHighlight, { transform: [{ scale: scalesRef.current[i] || new Animated.Value(1) }] }]}>
              <Text style={[styles.markerText, highlightIndex === i && { color: '#fff' }]}>{i + 1}</Text>
            </Animated.View>
          </Marker>
        ))}
        {points.length > 1 && <Polyline coordinates={points.map(p => ({ latitude: p.lat, longitude: p.lng }))} strokeWidth={3} strokeColor="#1B6EF3" />}
      </MapView>
      {points.length > 0 && (
        <TouchableOpacity style={styles.navigate} onPress={() => openMaps(points[0].lat, points[0].lng, points[0].title)}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Navigate</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 280, borderRadius: 18, overflow: 'hidden', marginVertical: 12 },
  map: { flex: 1 },
  navigate: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#1B6EF3', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 999 },
  marker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1B6EF3' },
  markerText: { color: '#1B6EF3', fontWeight: '700' },
  markerHighlight: { backgroundColor: '#1B6EF3', borderColor: '#fff' },
  markerHighlightText: { color: '#fff' },
  webPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FE', borderRadius: 18 },
  webText: { color: '#64748B', fontWeight: '600' }
});


export default TripMap;
