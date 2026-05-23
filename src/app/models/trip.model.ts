// src/app/models/trip.model.ts

export interface Trip {
  _id?:           string;

  // Who
  username:       string;
  designation:    string;

  // Ticket
  issueDate?:     string | Date | null;
  airline?:       string;
  sector?:        string;           // "COK/DXB/TRV"
  travelClass?:   string;

  // Travel dates
  travelDateText?: string | null;   // "In UAE" | "In India" | null
  travelDate?:     string | Date | null;
  returnDate?:     string | Date | null;

  // Times
  exitTime?:      string;           // "4:30 AM"
  entryTime?:     string;           // "3:10 AM"

  // Days (manually entered)
  inIndiaDays:    number;
  inUAEDays:      number;

  // Notes
  notes?:         string;

  // Timestamps
  createdAt?:     string;
  updatedAt?:     string;
}

export interface TripFilter {
  username?:   string;
  year?:       string | number;
  month?:      string | number;
  startDate?:  string;
  endDate?:    string;
}

export interface YearlyStats {
  year:   string;
  india:  number;
  uae:    number;
  trips:  number;
}

export interface MonthlyStats {
  month:  string;
  india:  number;
  uae:    number;
  trips:  number;
}

export interface Stats {
  daysInIndia:              number;
  daysInUAE:                number;
  totalDays:                number;
  totalTrips:               number;
  yearly:                   YearlyStats[];
  monthly:                  MonthlyStats[];
  availableYears:           number[];
  availableFinancialYears:  string[];
  availableUsernames:       string[];
}