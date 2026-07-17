import storageService from './storageService';

const EXCHANGE_RATES_KEY = 'WB_EXCHANGE_RATES';
const EXCHANGE_RATES_DATE_KEY = 'WB_EXCHANGE_RATES_DATE';
const API_KEY = 'cfcf0d32f2cc27c6b4742eac';
const BASE_URL = 'https://v6.exchangerate-api.com/v6';

export interface ExchangeRates {
  rates: {
    [currency: string]: number;
  };
  lastUpdated: string;
}

const DEFAULT_RATES: ExchangeRates = {
  rates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.50,
    CAD: 1.36,
    AUD: 1.52,
  },
  lastUpdated: new Date().toISOString(),
};

const exchangeRateService = {
  async fetchRates(): Promise<ExchangeRates> {
    try {
      const response = await fetch(`${BASE_URL}/${API_KEY}/latest/USD`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      
      const data = await response.json();
      
      if (data.result === 'error') {
        throw new Error(data['error-type'] || 'API error');
      }
      
      const rates: ExchangeRates = {
        rates: {
          USD: 1,
          EUR: data.conversion_rates.EUR || 0.92,
          GBP: data.conversion_rates.GBP || 0.79,
          JPY: data.conversion_rates.JPY || 149.50,
          CAD: data.conversion_rates.CAD || 1.36,
          AUD: data.conversion_rates.AUD || 1.52,
        },
        lastUpdated: new Date().toISOString(),
      };
      
      // Cache the rates
      await storageService.save(EXCHANGE_RATES_KEY, rates);
      await storageService.save(EXCHANGE_RATES_DATE_KEY, new Date().toDateString());
      
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      // Return cached rates or defaults
      return this.getCachedRates();
    }
  },

  async getCachedRates(): Promise<ExchangeRates> {
    try {
      const cached = await storageService.load(EXCHANGE_RATES_KEY);
      const lastFetchDate = await storageService.load(EXCHANGE_RATES_DATE_KEY);
      
      // If we have cached rates from today, return them
      if (cached && lastFetchDate === new Date().toDateString()) {
        return cached;
      }
      
      // If no cache or old cache, try to fetch fresh rates
      return this.fetchRates();
    } catch (error) {
      console.error('Error getting cached rates:', error);
      return DEFAULT_RATES;
    }
  },

  async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    const rates = await this.getCachedRates();
    
    // Convert from source to USD first, then to target
    const inUSD = amount / (rates.rates[fromCurrency] || 1);
    return inUSD * (rates.rates[toCurrency] || 1);
  },

  getGreeting(): string {
    const hour = new Date().getHours();
    
    if (hour < 12) {
      return 'Good morning';
    } else if (hour < 17) {
      return 'Good afternoon';
    } else if (hour < 21) {
      return 'Good evening';
    } else {
      return 'Good night';
    }
  },
};

export default exchangeRateService;