// Coarse, city-level place names for map coordinates (Mapbox reverse
// geocoding). Coordinates are rounded to ~1 km before lookup, so we never
// send anything more precise than what's already on the map.

type GeocodeResponse = {
  features?: {
    properties?: {
      name?: string;
      context?: { country?: { name?: string } };
    };
  }[];
};

const cache = new Map<string, Promise<string | null>>();

export function placeKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function lookupPlace(
  lat: number,
  lng: number,
  token: string,
): Promise<string | null> {
  const key = placeKey(lat, lng);
  const hit = cache.get(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    longitude: lng.toFixed(2),
    latitude: lat.toFixed(2),
    types: "place,region,country",
    limit: "1",
    language: "en",
    access_token: token,
  });
  const request = fetch(
    `https://api.mapbox.com/search/geocode/v6/reverse?${params}`,
  )
    .then((res) => (res.ok ? (res.json() as Promise<GeocodeResponse>) : null))
    .then((data) => {
      const props = data?.features?.[0]?.properties;
      if (!props?.name) return null;
      const country = props.context?.country?.name;
      return country && country !== props.name
        ? `${props.name}, ${country}`
        : props.name;
    })
    .catch(() => {
      cache.delete(key); // transient failure — allow a retry later
      return null;
    });

  cache.set(key, request);
  return request;
}

export function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lng).toFixed(1)}°${ew}`;
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
