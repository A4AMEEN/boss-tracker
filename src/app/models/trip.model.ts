export interface Trip {
  _id?: string;
  username: string;
  designation: string;
  direction: 'UAE_TO_INDIA' | 'INDIA_TO_UAE';
  departureDate: string | Date;
  returnDate: string | Date;
  daysCount?: number;
  notes?: string;
  issueDate?: string | Date | null;
  airline?: string;
  travelClass?: 'Economy' | 'Business' | 'First' | 'Premium Economy' | '';
  sector?: string;
  fare?: number | null;
  fareCurrency?: string;
  createdAt?: string;
  updatedAt?: string;
   arrivalTime?:   string | null;   // "HH:MM" IST — UAE→India
  departureTime?: string | null;   // "HH:MM" IST — India→UAE
}

export interface TripFilter {
  direction?: string;
  year?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  username?: string;
  airline?: string;
  travelClass?: string;
}

export interface MonthlyStats { month: string; india: number; uae: number; tripsToIndia: number; tripsToUAE: number; }
export interface YearlyStats  { year: string;  india: number; uae: number; tripsToIndia: number; tripsToUAE: number; }

export interface Stats {
  totalTrips: number;
  tripsToIndia: number;
  tripsToUAE: number;
  daysInIndia: number;
  daysInUAE: number;
  totalDays: number;
  monthly: MonthlyStats[];
  yearly: YearlyStats[];
  availableYears: number[];
  availableFinancialYears?: string[];
  availableUsernames?: string[];
  note?: string;
}