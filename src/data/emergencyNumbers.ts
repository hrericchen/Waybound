export type EmergencyNumbers = {
  code: string;       // ISO country code
  name: string;       // Country name
  flag: string;       // Flag emoji
  general: string;    // Universal / dispatcher number
  police: string;
  ambulance: string;
  fire: string;
  notes?: string;
};

/**
 * ~30 of the most popular / commonly-traveled countries.
 * Numbers are the commonly-dialed emergency services numbers for each.
 * In many countries all three services share a single number (shown in every field).
 */
export const EMERGENCY_NUMBERS: EmergencyNumbers[] = [
  { code: 'US',  name: 'United States',        flag: '🇺🇸', general: '911',   police: '911',   ambulance: '911',   fire: '911' },
  { code: 'CA',  name: 'Canada',              flag: '🇨🇦', general: '911',   police: '911',   ambulance: '911',   fire: '911' },
  { code: 'MX',  name: 'Mexico',              flag: '🇲🇽', general: '911',   police: '911',   ambulance: '911',   fire: '911' },
  { code: 'GB',  name: 'United Kingdom',      flag: '🇬🇧', general: '999',   police: '999',   ambulance: '999',   fire: '999' },
  { code: 'IE',  name: 'Ireland',             flag: '🇮🇪', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'DE',  name: 'Germany',             flag: '🇩🇪', general: '112',   police: '110',   ambulance: '112',   fire: '112' },
  { code: 'FR',  name: 'France',              flag: '🇫🇷', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'IT',  name: 'Italy',               flag: '🇮🇹', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'ES',  name: 'Spain',               flag: '🇪🇸', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'PT',  name: 'Portugal',            flag: '🇵🇹', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'NL',  name: 'Netherlands',         flag: '🇳🇱', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'BE',  name: 'Belgium',             flag: '🇧🇪', general: '112',   police: '101',   ambulance: '112',   fire: '112' },
  { code: 'CH',  name: 'Switzerland',         flag: '🇨🇭', general: '112',   police: '117',   ambulance: '1414',  fire: '118' },
  { code: 'AT',  name: 'Austria',             flag: '🇦🇹', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'SE',  name: 'Sweden',              flag: '🇸🇪', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'NO',  name: 'Norway',              flag: '🇮🇴', general: '112',   police: '113',   ambulance: '119',   fire: '110' },
  { code: 'DK',  name: 'Denmark',             flag: '🇩🇰', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'FI',  name: 'Finland',             flag: '🇫🇮', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'PL',  name: 'Poland',              flag: '🇵🇱', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'CZ',  name: 'Czech Republic',      flag: '🇨🇿', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'GR',  name: 'Greece',              flag: '🇬🇷', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'JP',  name: 'Japan',               flag: '🇯🇵', general: '119',   police: '110',   ambulance: '119',   fire: '119' },
  { code: 'KR',  name: 'South Korea',         flag: '🇰🇷', general: '119',   police: '112',   ambulance: '119',   fire: '119' },
  { code: 'CN',  name: 'China',               flag: '🇨🇳', general: '120',   police: '110',   ambulance: '120',   fire: '119' },
  { code: 'IN',  name: 'India',               flag: '🇮🇳', general: '112',   police: '100',   ambulance: '108',   fire: '101' },
  { code: 'AU',  name: 'Australia',           flag: '🇦🇺', general: '000',   police: '000',   ambulance: '000',   fire: '000' },
  { code: 'NZ',  name: 'New Zealand',         flag: '🇳🇿', general: '111',   police: '111',   ambulance: '111',   fire: '111' },
  { code: 'BR',  name: 'Brazil',              flag: '🇧🇷', general: '193',   police: '190',   ambulance: '192',   fire: '193' },
  { code: 'ZA',  name: 'South Africa',        flag: '🇿🇦', general: '112',   police: '112',   ambulance: '112',   fire: '112' },
  { code: 'RU',  name: 'Russia',              flag: '🇷🇺', general: '112',   police: '101',   ambulance: '112',   fire: '112' },
];

export default EMERGENCY_NUMBERS;
