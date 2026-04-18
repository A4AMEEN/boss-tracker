export interface Trip {
  _id?: string;
  username: string;
  designation: string;
  direction: 'UAE_TO_INDIA' | 'INDIA_TO_UAE';
  departureDate: string | Date;
  returnDate: string | Date;
  daysCount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripFilter {
  direction?: string;
  year?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

export interface Stats {
  totalTrips: number;
  tripsToIndia: number;
  tripsToUAE: number;
  daysInIndia: number;
  daysInUAE: number;
  totalDays: number;
  monthly: MonthlyBreakdown[];
  yearly: YearlyBreakdown[];
  availableYears: number[];
}

export interface MonthlyBreakdown {
  month: string;
  india: number;
  uae: number;
  tripsToIndia: number;
  tripsToUAE: number;
}

export interface YearlyBreakdown {
  year: string;
  india: number;
  uae: number;
  tripsToIndia: number;
  tripsToUAE: number;
}
