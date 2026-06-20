import * as Location from 'expo-location';
import { RoutePoint } from '../types/workout';

export const requestLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;
  // Background is optional — don't block on it
  try { await Location.requestBackgroundPermissionsAsync(); } catch {}
  return true;
};

export const startLocationTracking = (
  onLocation: (point: RoutePoint) => void
): Promise<Location.LocationSubscription> =>
  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 5,
    },
    (loc) => {
      onLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude ?? 0,
        timestamp: new Date(loc.timestamp),
        speed: Math.max(0, loc.coords.speed ?? 0),
      });
    }
  );

export const calculateDistance = (points: RoutePoint[]): number => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1], points[i]);
  }
  return total;
};

const haversine = (a: RoutePoint, b: RoutePoint): number => {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
