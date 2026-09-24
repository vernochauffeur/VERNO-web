// Google Maps Distance Matrix wrapper (browser only).
//
// The Maps JavaScript API is loaded by the <script> tag in index.html. Results
// are cached per origin/destination pair for the page session, so changing only
// the pickup time re-prices instantly without another API request.

const cache = new Map();

export function isDistanceServiceReady() {
  return typeof window !== "undefined" && !!window.google?.maps?.DistanceMatrixService;
}

function requestDistanceKm(origin, destination) {
  return new Promise((resolve) => {
    if (!isDistanceServiceReady()) { resolve(null); return; }
    try {
      const { maps } = window.google;
      new maps.DistanceMatrixService().getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: maps.TravelMode.DRIVING,
        unitSystem: maps.UnitSystem.METRIC,
      }, (response, status) => {
        const element = status === "OK" ? response?.rows?.[0]?.elements?.[0] : null;
        resolve(element?.status === "OK" ? element.distance.value / 1000 : null);
      });
    } catch (e) {
      console.error("Distance Matrix error:", e);
      resolve(null);
    }
  });
}

/** Driving distance in km, or null when the route can't be calculated. Never rejects. */
export function getDrivingDistanceKm(origin, destination) {
  if (!origin || !destination) return Promise.resolve(null);
  const key = `${origin}\u0000${destination}`;
  if (!cache.has(key)) {
    const pending = requestDistanceKm(origin, destination).then((km) => {
      if (km === null) cache.delete(key); // allow a retry after a failure
      return km;
    });
    cache.set(key, pending);
  }
  return cache.get(key);
}
