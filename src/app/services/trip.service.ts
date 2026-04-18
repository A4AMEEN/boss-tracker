import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Trip, TripFilter, Stats } from '../models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private apiUrl = 'https://tracker-backend-self.vercel.app/api';


  constructor(private http: HttpClient) {}

  getTrips(filter?: TripFilter): Observable<{ success: boolean; data: Trip[]; count: number }> {
    let params = new HttpParams();
    if (filter) {
      if (filter.direction) params = params.set('direction', filter.direction);
      if (filter.year) params = params.set('year', filter.year);
      if (filter.month) params = params.set('month', filter.month);
      if (filter.startDate) params = params.set('startDate', filter.startDate);
      if (filter.endDate) params = params.set('endDate', filter.endDate);
    }
    return this.http.get<{ success: boolean; data: Trip[]; count: number }>(
      `${this.apiUrl}/trips`, { params }
    );
  }

  createTrip(trip: Partial<Trip>): Observable<{ success: boolean; data: Trip }> {
    return this.http.post<{ success: boolean; data: Trip }>(`${this.apiUrl}/trips`, trip);
  }

  updateTrip(id: string, trip: Partial<Trip>): Observable<{ success: boolean; data: Trip }> {
    return this.http.put<{ success: boolean; data: Trip }>(`${this.apiUrl}/trips/${id}`, trip);
  }

  deleteTrip(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/trips/${id}`);
  }

  getStats(year?: string): Observable<{ success: boolean; data: Stats }> {
    let params = new HttpParams();
    if (year) params = params.set('year', year);
    return this.http.get<{ success: boolean; data: Stats }>(`${this.apiUrl}/stats/summary`, { params });
  }

  getAvailableYears(): Observable<{ success: boolean; data: number[] }> {
    return this.http.get<{ success: boolean; data: number[] }>(`${this.apiUrl}/stats/years`);
  }
}
