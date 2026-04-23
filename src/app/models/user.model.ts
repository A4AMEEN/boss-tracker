// src/app/models/user.model.ts
export interface User {
  _id?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  designation: string;
  email?: string;
  phone?: string;
  nationality?: string;
  passportNo?: string;
  isActive?: boolean;
  notes?: string;
  // Computed trip stats (returned by GET /api/users)
  tripCount?: number;
  daysInIndia?: number;
  daysInUAE?: number;
  totalDays?: number;
  createdAt?: string;
  updatedAt?: string;
}