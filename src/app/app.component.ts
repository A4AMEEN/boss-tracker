// src/app/app.component.ts
import { Component, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from './services/trip.service';
import { UserService } from './services/user.service';
import { Trip, TripFilter, Stats } from './models/trip.model';
import { User } from './models/user.model';
import Swal from 'sweetalert2';

type ActiveTab = 'add' | 'list' | 'history' | 'users';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  activeTab      = signal<ActiveTab>('add');
  trips          = signal<Trip[]>([]);
  stats          = signal<Stats | null>(null);
  users          = signal<User[]>([]);
  availableYears = signal<number[]>([]);
  availableUsernames = signal<string[]>([]);
  loading        = signal(false);
  statsLoading   = signal(false);
  usersLoading   = signal(false);
  pdfLoading     = signal(false);
  isMobile       = signal(false);

  // ── Trip form ─────────────────────────────────────────────────────────────
  tripForm: Partial<Trip> = this.defaultTripForm();
  editingId: string | null = null;

  // ── User form ─────────────────────────────────────────────────────────────
  userForm: Partial<User> = this.defaultUserForm();
  editingUserId: string | null = null;
  showUserForm = false;

  // ── Filters ───────────────────────────────────────────────────────────────
  listFilter: any = { direction: '', year: '', month: '', username: '' };
  historyYear     = 'ALL';
  historyView: 'yearly' | 'monthly' = 'yearly';
  historyUsername = '';  // set after users load

  pdfFilter: any = { username: '', direction: '', year: '', startDate: '', endDate: '' };
  showPdfPanel   = false;

  months = [
    { value: '1',  label: 'January'   }, { value: '2',  label: 'February' },
    { value: '3',  label: 'March'     }, { value: '4',  label: 'April'    },
    { value: '5',  label: 'May'       }, { value: '6',  label: 'June'     },
    { value: '7',  label: 'July'      }, { value: '8',  label: 'August'   },
    { value: '9',  label: 'September' }, { value: '10', label: 'October'  },
    { value: '11', label: 'November'  }, { value: '12', label: 'December' },
  ];
  travelClasses = ['Economy', 'Premium Economy', 'Business', 'First'];
  currencies    = ['AED', 'INR', 'USD', 'GBP', 'EUR'];
  nationalities = ['Indian', 'Emirati', 'Pakistani', 'Filipino', 'British', 'American', 'Other'];
  currentYear   = new Date().getFullYear();

  constructor(
    private tripService: TripService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.checkMobile();
    this.loadUsers().then(() => {
      this.loadTrips();
      this.loadStats();
      this.loadYears();
    });
  }

  @HostListener('window:resize')
  checkMobile(): void { this.isMobile.set(window.innerWidth < 768); }

  // ── Default forms ─────────────────────────────────────────────────────────
  private defaultTripForm(): Partial<Trip> {
    return {
      username: '', designation: '',
      direction: 'UAE_TO_INDIA', departureDate: '', returnDate: '',
      issueDate: '', airline: '', travelClass: '', sector: '',
      fare: null, fareCurrency: 'AED', notes: '',
    };
  }

  private defaultUserForm(): Partial<User> {
    return { firstName: '', lastName: '', designation: '', email: '', phone: '', nationality: '', passportNo: '', notes: '', isActive: true };
  }

  // ── Tab switching ─────────────────────────────────────────────────────────
  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    if (tab === 'list')    this.loadTrips();
    if (tab === 'history') this.loadStats();
    if (tab === 'users')   this.loadUsers();
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  loadUsers(): Promise<void> {
    this.usersLoading.set(true);
    return new Promise(resolve => {
      this.userService.getUsers().subscribe({
        next: (res) => {
          this.users.set(res.data);
          const names = res.data.map(u => u.fullName || `${u.firstName} ${u.lastName}`);
          this.availableUsernames.set(names);
          // Set defaults for history and pdf filter to first user
          if (!this.historyUsername && names.length) {
            this.historyUsername = names[0];
            this.pdfFilter.username = names[0];
          }
          // Set default for trip form
          if (!this.tripForm.username && names.length) {
            this.onUserSelect(res.data[0]);
          }
          this.usersLoading.set(false);
          resolve();
        },
        error: () => { this.usersLoading.set(false); resolve(); },
      });
    });
  }

  onUserSelect(user: User): void {
    const fullName = user.fullName || `${user.firstName} ${user.lastName}`;
    this.tripForm = { ...this.tripForm, username: fullName, designation: user.designation };
  }

  onTripUserChange(fullName: string): void {
    const user = this.users().find(u => (u.fullName || `${u.firstName} ${u.lastName}`) === fullName);
    if (user) this.tripForm.designation = user.designation;
  }

  openUserForm(user?: User): void {
    if (user) {
      this.editingUserId = user._id!;
      this.userForm = { ...user };
    } else {
      this.editingUserId = null;
      this.userForm = this.defaultUserForm();
    }
    this.showUserForm = true;
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  cancelUserForm(): void { this.showUserForm = false; this.editingUserId = null; this.userForm = this.defaultUserForm(); }

  async submitUser(): Promise<void> {
    if (!this.userForm.firstName?.trim() || !this.userForm.lastName?.trim() || !this.userForm.designation?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'First name, last name and designation are required.' });
      return;
    }
    this.usersLoading.set(true);
    const op = this.editingUserId
      ? this.userService.updateUser(this.editingUserId, this.userForm)
      : this.userService.createUser(this.userForm);
    op.subscribe({
      next: () => {
        this.usersLoading.set(false);
        Swal.fire({ icon: 'success', title: this.editingUserId ? 'Updated!' : 'User Added!', timer: 1600, showConfirmButton: false });
        this.cancelUserForm();
        this.loadUsers();
      },
      error: (err) => {
        this.usersLoading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to save user' });
      },
    });
  }

  async deleteUser(user: User): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning', title: 'Delete user?',
      html: `<p>Delete <strong>${user.fullName || user.firstName + ' ' + user.lastName}</strong>? Their trip records will remain.</p>`,
      showCancelButton: true, confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel', confirmButtonColor: '#e74c3c',
    });
    if (result.isConfirmed) {
      this.userService.deleteUser(user._id!).subscribe({
        next: () => { Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1400, showConfirmButton: false }); this.loadUsers(); },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete user' }),
      });
    }
  }

  // ── Trips ─────────────────────────────────────────────────────────────────
  loadTrips(): void {
    this.loading.set(true);
    const filter: any = {};
    if (this.listFilter.direction) filter.direction = this.listFilter.direction;
    if (this.listFilter.year)      filter.year      = this.listFilter.year;
    if (this.listFilter.month && this.listFilter.year) filter.month = this.listFilter.month;
    if (this.listFilter.username?.trim()) filter.username = this.listFilter.username.trim();
    this.tripService.getTrips(filter).subscribe({
      next: (res) => { this.trips.set(res.data); this.loading.set(false); },
      error: () => { this.loading.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load trips', timer: 2000 }); },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    const year     = this.historyYear === 'ALL' ? undefined : this.historyYear;
    const username = this.historyUsername === 'ALL' ? undefined : this.historyUsername;
    this.tripService.getStats(year, username).subscribe({
      next: (res) => { this.stats.set(res.data); this.statsLoading.set(false); },
      error: () => { this.statsLoading.set(false); },
    });
  }

  loadYears(): void {
    this.tripService.getAvailableYears().subscribe({
      next: (res) => {
        const d = res.data as any;
        this.availableYears.set(d.years || d || []);
      },
    });
  }

  resetForm(): void {
    this.tripForm = this.defaultTripForm();
    // Re-apply first user default
    if (this.users().length) this.onUserSelect(this.users()[0]);
    this.editingId = null;
  }

  async submitTrip(): Promise<void> {
    if (!this.tripForm.username?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Select a person', text: 'Please select a traveller from the dropdown.' });
      return;
    }
    if (!this.tripForm.departureDate || !this.tripForm.returnDate) {
      Swal.fire({ icon: 'warning', title: 'Missing dates', text: 'Please select departure and return dates.' });
      return;
    }
    if (new Date(this.tripForm.returnDate as string) < new Date(this.tripForm.departureDate as string)) {
      Swal.fire({ icon: 'warning', title: 'Invalid dates', text: 'Return date cannot be before departure date.' });
      return;
    }
    this.loading.set(true);
    const fareVal = this.tripForm.fare;
    const payload: any = {
      username:      this.tripForm.username,
      designation:   this.tripForm.designation || '',
      direction:     this.tripForm.direction,
      departureDate: this.tripForm.departureDate,
      returnDate:    this.tripForm.returnDate,
      notes:         this.tripForm.notes || '',
      issueDate:     this.tripForm.issueDate && (this.tripForm.issueDate as string).trim() ? this.tripForm.issueDate : null,
      airline:       this.tripForm.airline       || '',
      travelClass:   this.tripForm.travelClass   || '',
      sector:        this.tripForm.sector        || '',
      fare:          (fareVal !== null && fareVal !== undefined && (fareVal as any) !== '') ? Number(fareVal) : null,
      fareCurrency:  this.tripForm.fareCurrency  || 'AED',
    };
    const op = this.editingId
      ? this.tripService.updateTrip(this.editingId, payload)
      : this.tripService.createTrip(payload);
    op.subscribe({
      next: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'success', title: this.editingId ? 'Updated!' : 'Trip Added!', timer: 1800, showConfirmButton: false });
        this.resetForm(); this.loadTrips(); this.loadYears();
        if (this.editingId) this.activeTab.set('list');
      },
      error: (err) => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to save trip' });
      },
    });
  }

  editTrip(trip: Trip): void {
    this.editingId = trip._id!;
    this.tripForm = {
      username:      trip.username,
      designation:   trip.designation,
      direction:     trip.direction,
      departureDate: this.formatDateForInput(trip.departureDate),
      returnDate:    this.formatDateForInput(trip.returnDate),
      issueDate:     trip.issueDate ? this.formatDateForInput(trip.issueDate) : '',
      airline:       trip.airline      || '',
      travelClass:   trip.travelClass  || '',
      sector:        trip.sector       || '',
      fare:          trip.fare !== null && trip.fare !== undefined ? Number(trip.fare) : null,
      fareCurrency:  trip.fareCurrency || 'AED',
      notes:         trip.notes        || '',
    };
    this.activeTab.set('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteTrip(trip: Trip): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning', title: 'Delete trip?',
      html: `<p>Delete trip from <strong>${this.formatDate(trip.departureDate)}</strong> to <strong>${this.formatDate(trip.returnDate)}</strong>?</p>`,
      showCancelButton: true, confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel', confirmButtonColor: '#e74c3c',
    });
    if (result.isConfirmed) {
      this.tripService.deleteTrip(trip._id!).subscribe({
        next: () => { Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false }); this.loadTrips(); this.loadStats(); },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete trip' }),
      });
    }
  }

  applyListFilter(): void  { this.loadTrips(); }
  clearListFilter(): void  { this.listFilter = { direction: '', year: '', month: '', username: '' }; this.loadTrips(); }
  applyHistoryFilter(): void { this.loadStats(); }
  togglePdfPanel(): void   { this.showPdfPanel = !this.showPdfPanel; }

  // ── PDF Generation ────────────────────────────────────────────────────────
generatePdfReport(): void {
  if (this.pdfLoading()) return; // 🔥 prevent double click

  this.pdfLoading.set(true);

  const filter: any = {};

  if (this.pdfFilter.username) filter.username = this.pdfFilter.username;
  if (this.pdfFilter.direction) filter.direction = this.pdfFilter.direction;
  if (this.pdfFilter.year) filter.year = this.pdfFilter.year;
  if (this.pdfFilter.startDate) filter.startDate = this.pdfFilter.startDate;
  if (this.pdfFilter.endDate) filter.endDate = this.pdfFilter.endDate;

  this.tripService.getTrips(filter).subscribe({
    next: (res) => {
      if (!res.data.length) {
        this.pdfLoading.set(false); // ✅ IMPORTANT
        return;
      }

      this.loadJsPDF()
        .then(jsPDF => {
          this.buildTravelSummaryPdf(res.data, jsPDF);
        })
        .catch(() => {
          console.error('PDF load failed');
        })
        .finally(() => {
          this.pdfLoading.set(false); // ✅ ALWAYS RESET
        });
    },

    error: () => {
      this.pdfLoading.set(false); // ✅ IMPORTANT
    }
  });
}

private loadJsPDF(): Promise<any> {
  const win = window as any;

  // ✅ Already loaded → reuse
  if (win.jspdf?.jsPDF) {
    return Promise.resolve(win.jspdf.jsPDF);
  }

  return new Promise((resolve, reject) => {
    let script = document.getElementById('jspdf-script') as HTMLScriptElement;

    if (script) {
      script.onload = () => resolve(win.jspdf.jsPDF);
      return;
    }

    script = document.createElement('script');
    script.id = 'jspdf-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;

    script.onload = () => resolve(win.jspdf.jsPDF);
    script.onerror = () => reject();

    document.head.appendChild(script);
  });
}

private buildTravelSummaryPdf(trips: Trip[], jsPDFCtor: any): void {
  const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297, ML = 8, MR = 8, MT = 12, TW = PW - ML - MR;

  type RGB = [number, number, number];
  const BLACK: RGB = [0, 0, 0];
  const NAVY: RGB = [26, 51, 102];
  const YELBG: RGB = [255, 235, 156];
  const WHITE: RGB = [255, 255, 255];
  const TOTALBG: RGB = [189, 215, 238];
  const GRIDC: RGB = [150, 150, 150];

  const sorted = [...trips].sort(
    (a, b) => new Date(a.departureDate as string).getTime() - new Date(b.departureDate as string).getTime()
  );

  const personName = this.pdfFilter.username?.trim() || '';

  let dateRangeStr = 'All Dates';
  if (this.pdfFilter.startDate && this.pdfFilter.endDate)
    dateRangeStr = `${this.formatDateOrdinal(this.pdfFilter.startDate)} to ${this.formatDateOrdinal(this.pdfFilter.endDate)}`;
  else if (this.pdfFilter.year)
    dateRangeStr = `1st January ${this.pdfFilter.year} to 31st December ${this.pdfFilter.year}`;
  else if (sorted.length)
    dateRangeStr = `${this.formatDateOrdinal(sorted[0].departureDate as string)} to ${this.formatDateOrdinal(sorted[sorted.length - 1].returnDate as string)}`;

  const reportTitle = `Travel Summary ${dateRangeStr}${personName ? ' (' + personName + ')' : ''}`;

  const cols = [
    { h: 'No.', w: 8, align: 'center' as const },
    { h: 'Issue Date', w: 20, align: 'center' as const },
    { h: 'Name', w: 31, align: 'left' as const },
    { h: 'Airlines', w: 19, align: 'left' as const },
    { h: 'Sector', w: 22, align: 'center' as const },
    { h: 'Class', w: 16, align: 'center' as const },
    { h: 'Travel Date', w: 20, align: 'center' as const },
    { h: 'Return Date', w: 20, align: 'center' as const },
    { h: 'In India', w: 11, align: 'center' as const },
    { h: 'In UAE/\nAbroad', w: 13, align: 'center' as const },
    { h: 'Remarks', w: 14, align: 'left' as const },
  ];

  const ROW_H = 7, HEAD_H = 9, GRP_H = 6.5;

  let curY = MT;

  const colX = (i: number) => {
    let x = ML;
    for (let j = 0; j < i; j++) x += cols[j].w;
    return x;
  };

  const cellText = (text: string, ci: number, y: number, rh: number, bold = false, color: RGB = BLACK) => {
    const x = colX(ci), cw = cols[ci].w, al = cols[ci].align;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...color);
    const tx = al === 'center' ? x + cw / 2 : x + 1;
    doc.text(String(text), tx, y + rh / 2 + 2.2, { align: al as any, maxWidth: cw - 1.5 });
  };

  const drawTitle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(reportTitle, PW / 2, curY + 5, { align: 'center' });
    curY += 12;
  };

  const drawColHeaders = () => {
    doc.setFillColor(...NAVY);
    doc.rect(ML, curY, TW, HEAD_H, 'F');

    for (let i = 0; i < cols.length; i++) {
      const x = colX(i), cw = cols[i].w;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);

      doc.text(cols[i].h, x + cw / 2, curY + HEAD_H / 2 + 1.5, {
        align: 'center',
        maxWidth: cw - 1
      });

      if (i > 0) doc.line(x, curY, x, curY + HEAD_H);
    }

    doc.setDrawColor(...GRIDC);
    doc.rect(ML, curY, TW, HEAD_H);
    curY += HEAD_H;
  };

  const drawGroupHeader = (label: string) => {
    doc.setFillColor(...YELBG);
    doc.rect(ML, curY, TW, GRP_H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...NAVY);
    doc.text(label, ML + TW / 2, curY + GRP_H / 2 + 1.8, { align: 'center' });

    doc.rect(ML, curY, TW, GRP_H);
    curY += GRP_H;
  };

  const drawDataRow = (trip: Trip, rowNum: number, inIndia: number, inUAE: number) => {
    doc.setFillColor(...WHITE);
    doc.rect(ML, curY, TW, ROW_H, 'F');

    const ry = curY;

    cellText(rowNum.toString(), 0, ry, ROW_H);
    cellText(trip.issueDate ? this.formatDateShort(trip.issueDate) : '', 1, ry, ROW_H);
    cellText(trip.username, 2, ry, ROW_H);
    cellText(trip.airline || '', 3, ry, ROW_H);
    cellText(trip.sector || '', 4, ry, ROW_H);
    cellText(trip.travelClass || '', 5, ry, ROW_H);
    cellText(this.formatDateShort(trip.departureDate), 6, ry, ROW_H);
    cellText(this.formatDateShort(trip.returnDate), 7, ry, ROW_H);

    cellText(inIndia ? inIndia.toString() : '', 8, ry, ROW_H, true, [0, 100, 0]);
    cellText(inUAE ? inUAE.toString() : '', 9, ry, ROW_H, true, [26, 86, 180]);

    cellText(trip.notes || '', 10, ry, ROW_H);

    doc.setDrawColor(...GRIDC);
    doc.rect(ML, ry, TW, ROW_H);

    curY += ROW_H;
  };

  const drawTotalRow = (india: number, uae: number) => {
    const total = india + uae;

    doc.setFillColor(...TOTALBG);
    doc.rect(ML, curY, TW, ROW_H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);

    doc.text('Total Days', ML + 50, curY + ROW_H / 2 + 2, { align: 'center' });

    cellText(india.toString(), 8, curY, ROW_H, true, [0, 100, 0]);
    cellText(uae.toString(), 9, curY, ROW_H, true, [26, 86, 180]);
    cellText(total.toString(), 10, curY, ROW_H, true);

    doc.rect(ML, curY, TW, ROW_H);
    curY += ROW_H;
  };

  // ✅ DRAW START
  drawTitle();
  drawColHeaders();
  drawGroupHeader('Trips');

  const MS_DAY = 86400000;

  let totalIndia = 0;
  let totalUAE = 0;
  let rowNum = 1;

  for (let i = 0; i < sorted.length; i++) {
    const trip = sorted[i];
    const days = trip.daysCount || 0;

    let inIndia = 0;
    let inUAE = 0;

    if (trip.direction === 'UAE_TO_INDIA') {
      inIndia = days;

      if (i < sorted.length - 1) {
        const nextTrip = sorted[i + 1];

        const gapMs =
          new Date(nextTrip.departureDate as string).getTime() -
          new Date(trip.returnDate as string).getTime() -
          MS_DAY;

        if (gapMs > 0) {
          inUAE += Math.round(gapMs / MS_DAY);
        }
      }
    }

    if (trip.direction === 'INDIA_TO_UAE') {
      inUAE += days;
    }

    totalIndia += inIndia;
    totalUAE += inUAE;

    drawDataRow(trip, rowNum++, inIndia, inUAE);
  }

  drawTotalRow(totalIndia, totalUAE);

const user = this.pdfFilter.username?.trim() || 'All Users';
const year = this.pdfFilter.year || 'All';
const from = this.pdfFilter.startDate ? this.formatDateShort(this.pdfFilter.startDate) : '';
const to   = this.pdfFilter.endDate ? this.formatDateShort(this.pdfFilter.endDate) : '';

// clean filename (no spaces issues)
const safeUser = user.replace(/\s+/g, '_');

let fileName = `Travel_Summary_of_${safeUser}`;

if (this.pdfFilter.year) {
  fileName += `_Year_${year}`;
}

if (from && to) {
  fileName += `_${from}_to_${to}`;
}

fileName += '.pdf';

doc.save(fileName);
}

  // ── Date helpers ──────────────────────────────────────────────────────────
  private formatDateOrdinal(d: string|Date): string {
    if(!d)return'';const dt=new Date(d as string);if(isNaN(dt.getTime()))return String(d);
    const day=dt.getUTCDate(),suf=day===1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th';
    const mon=['January','February','March','April','May','June','July','August','September','October','November','December'];
    return`${day}${suf} ${mon[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
  }
  private formatDateShort(date:string|Date|null|undefined):string{
    if(!date)return'';const d=new Date(date as string);if(isNaN(d.getTime()))return'';
    const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return`${String(d.getUTCDate()).padStart(2,'0')}-${mon[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
  }

  formatDate(date:string|Date|null|undefined):string{
    if(!date)return'';const d=new Date(date as string);if(isNaN(d.getTime()))return'';
    return`${String(d.getUTCDate()).padStart(2,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${d.getUTCFullYear()}`;
  }
  formatDateForInput(date:string|Date|null|undefined):string{
    if(!date)return'';const d=new Date(date as string);if(isNaN(d.getTime()))return'';
    return`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  formatMonth(s:string):string{const[y,m]=s.split('-');return new Date(+y,+m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});}

  getDirectionLabel(d:string):string{return d==='UAE_TO_INDIA'?'UAE → India':'India → UAE';}
  getDirectionBadgeClass(d:string):string{return d==='UAE_TO_INDIA'?'badge-india':'badge-uae';}
  getIndiaPct(india:number,uae:number):number{const t=india+uae;return t?Math.round(india/t*100):0;}
  getUaePct(india:number,uae:number):number{const t=india+uae;return t?Math.round(uae/t*100):0;}
  getDurationPreview():number{
    if(!this.tripForm.departureDate||!this.tripForm.returnDate)return 0;
    return Math.max(1,Math.round((new Date(this.tripForm.returnDate as string).getTime()-new Date(this.tripForm.departureDate as string).getTime())/86400000)+1);
  }
  get yearOptions():number[]{const y:number[]=[];for(let i=this.currentYear;i>=2015;i--)y.push(i);return y;}

  getUserInitials(user: User): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
}