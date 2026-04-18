import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from './services/trip.service';
import { Trip, TripFilter, Stats } from './models/trip.model';
import Swal from 'sweetalert2';

type ActiveTab = 'add' | 'list' | 'history';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  activeTab = signal<ActiveTab>('add');
  trips = signal<Trip[]>([]);
  stats = signal<Stats | null>(null);
  availableYears = signal<number[]>([]);
  loading = signal(false);
  statsLoading = signal(false);

  // Form state
  tripForm: Partial<Trip> = {
    username: 'Sajeev PK',
    designation: 'Managing Director',
    direction: 'UAE_TO_INDIA',
    departureDate: '',
    returnDate: '',
    notes: '',
  };
  editingId: string | null = null;

  // Filters - list
  listFilter: TripFilter = { direction: '', year: '', month: '' };

  // Filters - history
  historyYear = 'ALL';
  historyView: 'yearly' | 'monthly' = 'yearly';

  months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  currentYear = new Date().getFullYear();

  constructor(private tripService: TripService) {}

  ngOnInit(): void {
    this.loadTrips();
    this.loadStats();
    this.loadYears();
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    if (tab === 'list') this.loadTrips();
    if (tab === 'history') this.loadStats();
  }

  loadTrips(): void {
    this.loading.set(true);
    const filter: TripFilter = {};
    if (this.listFilter.direction) filter.direction = this.listFilter.direction;
    if (this.listFilter.year) filter.year = this.listFilter.year;
    if (this.listFilter.month && this.listFilter.year) filter.month = this.listFilter.month;

    this.tripService.getTrips(filter).subscribe({
      next: (res) => {
        this.trips.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load trips', timer: 2000 });
      },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    const year = this.historyYear === 'ALL' ? undefined : this.historyYear;
    this.tripService.getStats(year).subscribe({
      next: (res) => {
        this.stats.set(res.data);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsLoading.set(false);
      },
    });
  }

  loadYears(): void {
    this.tripService.getAvailableYears().subscribe({
      next: (res) => this.availableYears.set(res.data),
    });
  }

  resetForm(): void {
    this.tripForm = {
      username: 'Sajeev PK',
      designation: 'Managing Director',
      direction: 'UAE_TO_INDIA',
      departureDate: '',
      returnDate: '',
      notes: '',
    };
    this.editingId = null;
  }

  async submitTrip(): Promise<void> {
    if (!this.tripForm.departureDate || !this.tripForm.returnDate) {
      Swal.fire({ icon: 'warning', title: 'Missing dates', text: 'Please select both departure and return dates.' });
      return;
    }

    const dep = new Date(this.tripForm.departureDate as string);
    const ret = new Date(this.tripForm.returnDate as string);
    if (ret < dep) {
      Swal.fire({ icon: 'warning', title: 'Invalid dates', text: 'Return date cannot be before departure date.' });
      return;
    }

    this.loading.set(true);

    if (this.editingId) {
      this.tripService.updateTrip(this.editingId, this.tripForm).subscribe({
        next: () => {
          this.loading.set(false);
          Swal.fire({ icon: 'success', title: 'Updated!', text: 'Trip updated successfully.', timer: 1800, showConfirmButton: false });
          this.resetForm();
          this.loadTrips();
          this.loadYears();
          this.activeTab.set('list');
        },
        error: (err) => {
          this.loading.set(false);
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to update trip' });
        },
      });
    } else {
      this.tripService.createTrip(this.tripForm).subscribe({
        next: () => {
          this.loading.set(false);
          Swal.fire({
            icon: 'success',
            title: 'Trip Added!',
            html: `<p style="font-size:15px">Your trip has been recorded successfully.</p>`,
            timer: 2000,
            showConfirmButton: false,
          });
          this.resetForm();
          this.loadTrips();
          this.loadYears();
        },
        error: (err) => {
          this.loading.set(false);
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to add trip' });
        },
      });
    }
  }

  editTrip(trip: Trip): void {
    this.editingId = trip._id!;
    this.tripForm = {
      username: trip.username,
      designation: trip.designation,
      direction: trip.direction,
      departureDate: this.formatDateForInput(trip.departureDate),
      returnDate: this.formatDateForInput(trip.returnDate),
      notes: trip.notes || '',
    };
    this.activeTab.set('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteTrip(trip: Trip): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete trip?',
      html: `<p>This will permanently delete the trip from <strong>${this.formatDate(trip.departureDate)}</strong> to <strong>${this.formatDate(trip.returnDate)}</strong>.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e74c3c',
    });

    if (result.isConfirmed) {
      this.tripService.deleteTrip(trip._id!).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
          this.loadTrips();
          this.loadStats();
          this.loadYears();
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete trip' });
        },
      });
    }
  }

  applyListFilter(): void {
    this.loadTrips();
  }

  clearListFilter(): void {
    this.listFilter = { direction: '', year: '', month: '' };
    this.loadTrips();
  }

  applyHistoryFilter(): void {
    this.loadStats();
  }

  // Display format: DD-MM-YYYY  e.g. 01-05-2026
  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  // HTML <input type="date"> always needs YYYY-MM-DD internally (browser requirement)
  formatDateForInput(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  getDirectionLabel(direction: string): string {
    return direction === 'UAE_TO_INDIA' ? 'UAE → India' : 'India → UAE';
  }

  getDirectionBadgeClass(direction: string): string {
    return direction === 'UAE_TO_INDIA' ? 'badge-india' : 'badge-uae';
  }

  getIndiaPct(india: number, uae: number): number {
    const total = india + uae;
    return total ? Math.round((india / total) * 100) : 0;
  }

  getUaePct(india: number, uae: number): number {
    const total = india + uae;
    return total ? Math.round((uae / total) * 100) : 0;
  }

  getDurationPreview(): number {
    if (!this.tripForm.departureDate || !this.tripForm.returnDate) return 0;
    const dep = new Date(this.tripForm.departureDate as string);
    const ret = new Date(this.tripForm.returnDate as string);
    const diff = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }

  get yearOptions(): number[] {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current; y >= 2015; y--) years.push(y);
    return years;
  }

  
}