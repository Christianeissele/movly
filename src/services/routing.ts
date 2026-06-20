export interface LatLng { latitude: number; longitude: number; }

export interface RouteResult {
  coords:   LatLng[];
  distance: number; // meters
  duration: number; // seconds
}

export interface GeocodingResult {
  name:      string;
  address:   string;
  latitude:  number;
  longitude: number;
}

export const geocode = async (query: string): Promise<GeocodingResult[]> => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=de&addressdetails=1`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'Movly/1.0' } });
  const json = await res.json();
  return json.map((r: any) => ({
    name:      r.name || r.display_name.split(',')[0],
    address:   r.display_name,
    latitude:  parseFloat(r.lat),
    longitude: parseFloat(r.lon),
  }));
};

export const fetchRoute = async (
  start:   LatLng,
  end:     LatLng,
  profile: 'cycling' | 'foot' = 'cycling',
): Promise<RouteResult> => {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
    `?overview=full&geometries=geojson`;

  const res  = await fetch(url);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.[0]) throw new Error('Keine Route gefunden');

  const r = json.routes[0];
  // OSRM cycling duration is unrealistic (~66 km/h) — use realistic avg speeds
  const avgSpeedMs = profile === 'cycling' ? (18 / 3.6) : (4.5 / 3.6);
  const realisticDuration = r.distance / avgSpeedMs;
  return {
    distance: r.distance,
    duration: realisticDuration,
    coords: (r.geometry.coordinates as [number, number][]).map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
  };
};
