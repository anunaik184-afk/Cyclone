export const INDIA_DEFAULT_CENTER = {lat: 20.5937, lng: 78.9629};
export const INDIA_DEFAULT_ZOOM = 5;

export interface GpsLocationState {
  status: 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'unsupported';
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  insideIndia: boolean;
  errorMessage: string | null;
  updatedAt: string | null;
}

export function isInsideIndia(lat: number, lng: number): boolean {
  return lat >= 6.5 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface HelplineItem {
  number: string;
  service: string;
  coverage: string;
  description: string;
}

export const INDIA_HELPLINES: HelplineItem[] = [
  {
    number: '112',
    service: 'Emergency Response Support System (ERSS)',
    coverage: 'Pan-India (24x7)',
    description: 'Single pan-India emergency number for police, fire, ambulance, and disaster rescue.',
  },
  {
    number: '108',
    service: 'Emergency Medical & Ambulance Service',
    coverage: 'State Integrated',
    description: '24-hour emergency ambulance and trauma dispatch across Indian states.',
  },
  {
    number: '1078',
    service: 'NDMA Disaster Management Control Room',
    coverage: 'National',
    description: 'National Disaster Management Authority helpline for cyclones, floods, and earthquakes.',
  },
  {
    number: '1070',
    service: 'State Disaster Management Control Room',
    coverage: 'State-level',
    description: 'State relief commissioner and SDRF emergency coordination desk.',
  },
  {
    number: '100',
    service: 'Police Control Room',
    coverage: 'Pan-India',
    description: 'Immediate law enforcement, missing persons, and civic safety support.',
  },
  {
    number: '101',
    service: 'Fire & Rescue Brigade',
    coverage: 'Pan-India',
    description: 'Structural fire, industrial hazard, and trapped-person rescue response.',
  },
  {
    number: '1098',
    service: 'Childline Emergency Helpline',
    coverage: 'National',
    description: '24x7 protection and emergency assistance for separated or distressed children.',
  },
];

export interface SafetyProtocol {
  id: string;
  hazard: string;
  immediateActions: string[];
  preparednessChecklist: string[];
}

export const SAFETY_PROTOCOLS: SafetyProtocol[] = [
  {
    id: 'cyclone',
    hazard: 'Cyclones & Coastal Storm Surge',
    immediateActions: [
      'Evacuate low-lying coastal zones early when IMD/NDMA issues cyclone warnings.',
      'Stay inside sturdy interior rooms away from glass windows during landfall; do not step out during the calm eye.',
      'Keep battery-powered radio or charged phone active for official IMD bulletins.',
    ],
    preparednessChecklist: [
      'Secure loose roofing sheets, shutters, and outdoor objects before wind speeds rise.',
      'Store dry rations, first-aid kit, and backup medicines for at least 5 days.',
    ],
  },
];
