// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = 'https://tracker-backend-self.vercel.app/api/users';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<{ success: boolean; data: User[]; count: number }> {
    return this.http.get<{ success: boolean; data: User[]; count: number }>(this.apiUrl);
  }

  createUser(user: Partial<User>): Observable<{ success: boolean; data: User }> {
    return this.http.post<{ success: boolean; data: User }>(this.apiUrl, user);
  }

  updateUser(id: string, user: Partial<User>): Observable<{ success: boolean; data: User }> {
    return this.http.put<{ success: boolean; data: User }>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }
}