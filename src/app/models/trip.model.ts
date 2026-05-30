// src/app/models/trip.model.ts
export interface Trip {
  _id?: string;
  username: string;
  designation?: string;
  issueDate?: string | Date | null;
  airline?: string;
  travelClass?: string;
  sector?: string;
  startingLocation?: string;   // 'IN_UAE' | 'IN_INDIA' | ''
  travelDate?: string | Date | null;
  returnDate?: string | Date | null;
  exitTime?: string;
  entryTime?: string;
  inIndiaDays?: number;
  inUAEDays?: number;
  fare?: number | null;
  fareCurrency?: string;
  notes?: string;
  direction?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripFilter {
  username?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
}

export interface MonthlyStats {
  month: string; india: number; uae: number; tripsToIndia: number; tripsToUAE: number;
}
export interface YearlyStats {
  year: string; india: number; uae: number; tripsToIndia: number; tripsToUAE: number;
}
export interface Stats {
  totalTrips: number; tripsToIndia: number; tripsToUAE: number;
  daysInIndia: number; daysInUAE: number; totalDays: number;
  monthly: MonthlyStats[]; yearly: YearlyStats[];
  availableYears: number[]; availableUsernames?: string[]; note?: string;
}