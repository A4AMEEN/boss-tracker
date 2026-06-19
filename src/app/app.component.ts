// src/app/app.component.ts
import { Component, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from './services/trip.service';
import { UserService } from './services/user.service';
import { Trip, Stats } from './models/trip.model';
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
  activeTab          = signal<ActiveTab>('add');
  trips              = signal<Trip[]>([]);
  stats              = signal<Stats | null>(null);
  users              = signal<User[]>([]);
  availableYears     = signal<number[]>([]);
  availableUsernames = signal<string[]>([]);
  loading            = signal(false);
  statsLoading       = signal(false);
  usersLoading       = signal(false);
  pdfLoading         = signal(false);
  calcLoading        = signal(false);
  isMobile           = signal(false);

  tripForm: Partial<Trip> = this.defaultTripForm();
  editingId: string | null = null;
  daysAutoCalced = false; // flag — shows when days were auto-filled
financialYearMode = false;
  userForm: Partial<User> = this.defaultUserForm();
  editingUserId: string | null = null;
  showUserForm = false;

  listFilter:  any = { username: '', year: '' };
  historyYear      = 'ALL';
  historyView: 'yearly' | 'monthly' = 'yearly';
  historyUsername  = '';
  pdfFilter:   any = { username: '', year: '', startDate: '', endDate: '' };
  showPdfPanel     = false;

  travelClasses = ['Economy', 'Premium Economy', 'Business', 'First'];
  currencies    = ['AED', 'INR', 'USD', 'GBP', 'EUR'];
  nationalities = ['Indian', 'Emirati', 'Pakistani', 'Filipino', 'British', 'American', 'Other'];
  months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' },   { value: '4', label: 'April' },
    { value: '5', label: 'May' },     { value: '6', label: 'June' },
    { value: '7', label: 'July' },    { value: '8', label: 'August' },
    { value: '9', label: 'September'},{ value: '10', label: 'October' },
    { value: '11', label: 'November'},{ value: '12', label: 'December' },
  ];
  currentYear = new Date().getFullYear();

  constructor(
    private tripService: TripService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.checkMobile();
    this.loadUsers().then(() => { this.loadTrips(); this.loadStats(); this.loadYears(); });
  }

  @HostListener('window:resize')
  checkMobile(): void { this.isMobile.set(window.innerWidth < 768); }

  private defaultTripForm(): Partial<Trip> {
    return {
      username: '', designation: '',
      startingLocation: '',
      issueDate: '', airline: 'Emirates', travelClass: '', sector: '',
      travelDate: '', returnDate: '',
      exitTime: '', entryTime: '',
      inIndiaDays: 0, inUAEDays: 0,
      fare: null, fareCurrency: 'AED', notes: '',
    };
  }
  private defaultUserForm(): Partial<User> {
    return { firstName: '', lastName: '', designation: '', email: '', phone: '', nationality: '', passportNo: '', notes: '', isActive: true };
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    if (tab === 'list')    this.loadTrips();
    if (tab === 'history') this.loadStats();
    if (tab === 'users')   this.loadUsers();
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  loadUsers(): Promise<void> {
    this.usersLoading.set(true);
    return new Promise(resolve => {
      this.userService.getUsers().subscribe({
        next: (res) => {
          this.users.set(res.data);
          const names = res.data.map(u => u.fullName || `${u.firstName} ${u.lastName}`);
          this.availableUsernames.set(names);
          if (!this.historyUsername && names.length) this.historyUsername = names[0];
          if (!this.pdfFilter.username && names.length) this.pdfFilter.username = names[0];
          if (!this.tripForm.username && res.data.length) this.onUserSelect(res.data[0]);
          this.usersLoading.set(false);
          resolve();
        },
        error: () => { this.usersLoading.set(false); resolve(); },
      });
    });
  }

  onUserSelect(user: User): void {
    const fn = user.fullName || `${user.firstName} ${user.lastName}`;
    this.tripForm = { ...this.tripForm, username: fn, designation: user.designation };
  }

  onTripUserChange(fullName: string): void {
    const u = this.users().find(u => (u.fullName || `${u.firstName} ${u.lastName}`) === fullName);
    if (u) {
      this.tripForm.designation = u.designation;
      this.triggerAutoCalc();
    }
  }

  openUserForm(user?: User): void {
    this.editingUserId = user?._id || null;
    this.userForm = user ? { ...user } : this.defaultUserForm();
    this.showUserForm = true;
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }
  cancelUserForm(): void { this.showUserForm = false; this.editingUserId = null; this.userForm = this.defaultUserForm(); }

  async submitUser(): Promise<void> {
    if (!this.userForm.firstName?.trim() || !this.userForm.lastName?.trim() || !this.userForm.designation?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'First name, last name and designation are required.' }); return;
    }
    this.usersLoading.set(true);
    const op = this.editingUserId
      ? this.userService.updateUser(this.editingUserId, this.userForm)
      : this.userService.createUser(this.userForm);
    op.subscribe({
      next: () => { this.usersLoading.set(false); Swal.fire({ icon: 'success', title: this.editingUserId ? 'Updated!' : 'User Added!', timer: 1600, showConfirmButton: false }); this.cancelUserForm(); this.loadUsers(); },
      error: (err) => { this.usersLoading.set(false); Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to save user' }); },
    });
  }

  async deleteUser(user: User): Promise<void> {
    const r = await Swal.fire({ icon: 'warning', title: 'Delete user?', html: `<p>Delete <strong>${user.fullName}</strong>? Their trip records will remain.</p>`, showCancelButton: true, confirmButtonText: 'Yes, delete', confirmButtonColor: '#e74c3c' });
    if (r.isConfirmed) {
      this.userService.deleteUser(user._id!).subscribe({
        next: () => { Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1400, showConfirmButton: false }); this.loadUsers(); },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete user' }),
      });
    }
  }
  getUserInitials(u: User): string { return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(); }

  // ── Auto-calculate days ────────────────────────────────────────────────────
  /**
   * Called whenever travelDate, returnDate, or username changes.
   *
   * UAE FORMULA (exact, confirmed):
   *   inUAEDays = returnDate - travelDate - 1
   *   (excludes both the departure day and the arrival-back day)
   *
   * INDIA FORMULA (suggested, user can override):
   *   inIndiaDays = gap between previous trip's returnDate and this travelDate - 1
   *   (days in India between coming back from previous trip and leaving again)
   *
   * For "In UAE" / "In India" starting rows (no travelDate):
   *   inUAEDays is manually entered (e.g. days from period start until returnDate)
   *   inIndiaDays = 0
   */
  // Replace the entire triggerAutoCalc() method with this:
// Replace the entire triggerAutoCalc() method with this:
triggerAutoCalc(): void {
  const travelDate = (this.tripForm.travelDate as string)?.trim();
  const returnDate = (this.tripForm.returnDate as string)?.trim();

  // UAE days: client-side calculation
  if (travelDate && returnDate) {
    const dep = new Date(travelDate).getTime();
    const ret = new Date(returnDate).getTime();
    if (!isNaN(dep) && !isNaN(ret) && ret > dep) {
      const uaeDays = Math.max(0, Math.round((ret - dep) / 86400000) - 1);
      this.tripForm = { ...this.tripForm, inUAEDays: uaeDays };
    }
  }

  // India days: server-calculated
  const username = this.tripForm.username?.trim();
  if (travelDate && username) {
    this.calcLoading.set(true);
    this.tripService.calculateDays({
      username,
      travelDate,
      returnDate: returnDate || undefined,
      tripId: this.editingId || undefined,
    }).subscribe({
      next: (res) => {
        this.calcLoading.set(false);
        // ← REMOVED the "if (res.data.inIndiaDays > 0)" guard
        // Always update India days from server — it knows the previous trip context
        this.tripForm = { ...this.tripForm, inIndiaDays: res.data.inIndiaDays ?? 0 };
        this.daysAutoCalced = true;
      },
      error: () => { this.calcLoading.set(false); },
    });
  }
}
onTravelDateChange(): void {
  this.daysAutoCalced = false;
  setTimeout(() => this.triggerAutoCalc(), 0);   // ← let ngModel flush first
}

onReturnDateChange(): void {
  this.daysAutoCalced = false;
  setTimeout(() => this.triggerAutoCalc(), 0);   // ← let ngModel flush first
}
  onStartingLocChange(): void {
    // If "In UAE" or "In India", clear travelDate
    if (this.tripForm.startingLocation === 'IN_UAE' || this.tripForm.startingLocation === 'IN_INDIA') {
      this.tripForm.travelDate = '';
      this.tripForm.inIndiaDays = 0;
    } else {
      this.tripForm.startingLocation = '';
    }
  }

  // ── Trips ──────────────────────────────────────────────────────────────────
  loadTrips(): void {
    this.loading.set(true);
    const f: any = {};
    if (this.listFilter.username?.trim()) f.username = this.listFilter.username.trim();
    if (this.listFilter.year)             f.year     = this.listFilter.year;
    this.tripService.getTrips(f).subscribe({
next: (res) => {
  // Show most recently added records first
  // If data has _id (MongoDB ObjectId), newest _id = newest record
  const sorted = [...res.data].reverse();
  this.trips.set(sorted);
  this.loading.set(false);
},
      error: () => { this.loading.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load trips', timer: 2000 }); },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    const year = this.historyYear === 'ALL' ? undefined : this.historyYear;
    const user = this.historyUsername === 'ALL' ? undefined : this.historyUsername;
    this.tripService.getStats(year, user).subscribe({
      next: (res) => {   console.log('Stats raw:', res.data);this.stats.set(res.data); this.statsLoading.set(false); },
      error: () => { this.statsLoading.set(false); },
    });
  }

  loadYears(): void {
    this.tripService.getAvailableYears().subscribe({
      next: (res) => { const d = res.data as any; this.availableYears.set(d.years || d || []); },
    });
  }

  resetForm(): void {
    this.tripForm = this.defaultTripForm();
    this.daysAutoCalced = false;
    if (this.users().length) this.onUserSelect(this.users()[0]);
    this.editingId = null;
  }

  async submitTrip(): Promise<void> {
    if (!this.tripForm.username?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Select a person', text: 'Please select a traveller.' }); return;
    }
    this.loading.set(true);
    const b = this.tripForm;
    const payload: any = {
      username:         b.username?.trim(),
      designation:      b.designation      || '',
      startingLocation: b.startingLocation || '',
      issueDate:        b.issueDate   && (b.issueDate   as string).trim() ? b.issueDate   : null,
      airline:          b.airline          || '',
      travelClass:      b.travelClass      || '',
      sector:           b.sector           || '',
      travelDate:       b.travelDate  && (b.travelDate  as string).trim() ? b.travelDate  : null,
      returnDate:       b.returnDate  && (b.returnDate  as string).trim() ? b.returnDate  : null,
      exitTime:         b.exitTime         || '',
      entryTime:        b.entryTime        || '',
      inIndiaDays:      Number(b.inIndiaDays) || 0,
      inUAEDays:        Number(b.inUAEDays)   || 0,
      fare:             b.fare != null && (b.fare as any) !== '' ? Number(b.fare) : null,
      fareCurrency:     b.fareCurrency     || 'AED',
      notes:            b.notes            || '',
    };
    const op = this.editingId
      ? this.tripService.updateTrip(this.editingId, payload)
      : this.tripService.createTrip(payload);
    op.subscribe({
 next: () => {
  this.loading.set(false);
  Swal.fire({ icon: 'success', title: this.editingId ? 'Updated!' : 'Record Saved!', timer: 1800, showConfirmButton: false });
  this.resetForm(); this.loadTrips(); this.loadYears();
  this.activeTab.set('list');  // ← Always redirect to All Trips
},
      error: (err) => { this.loading.set(false); Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to save' }); },
    });
  }

  editTrip(trip: Trip): void {
    this.editingId = trip._id!;
    this.daysAutoCalced = false;
    this.tripForm = {
      username:         trip.username,
      designation:      trip.designation      || '',
      startingLocation: trip.startingLocation || '',
      issueDate:        trip.issueDate    ? this.toInputDate(trip.issueDate)   : '',
      airline:          trip.airline          || '',
      travelClass:      trip.travelClass      || '',
      sector:           trip.sector           || '',
      travelDate:       trip.travelDate   ? this.toInputDate(trip.travelDate)  : '',
      returnDate:       trip.returnDate   ? this.toInputDate(trip.returnDate)  : '',
      exitTime:         trip.exitTime         || '',
      entryTime:        trip.entryTime        || '',
      inIndiaDays:      trip.inIndiaDays      ?? 0,
      inUAEDays:        trip.inUAEDays        ?? 0,
      fare:             trip.fare             ?? null,
      fareCurrency:     trip.fareCurrency     || 'AED',
      notes:            trip.notes            || '',
    };
    this.activeTab.set('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteTrip(trip: Trip): Promise<void> {
    const r = await Swal.fire({
      icon: 'warning', title: 'Delete record?',
      html: `<p>Delete <strong>${trip.username}</strong>'s record for sector <strong>${trip.sector || '—'}</strong>?</p>`,
      showCancelButton: true, confirmButtonText: 'Yes, delete', confirmButtonColor: '#e74c3c',
    });
    if (r.isConfirmed) {
      this.tripService.deleteTrip(trip._id!).subscribe({
        next: () => { Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false }); this.loadTrips(); this.loadStats(); },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete' }),
      });
    }
  }

  applyListFilter(): void    { this.loadTrips(); }
  clearListFilter(): void    { this.listFilter = { username: '', year: '' }; this.loadTrips(); }
  applyHistoryFilter(): void { this.loadStats(); }
  togglePdfPanel(): void     { this.showPdfPanel = !this.showPdfPanel; }

  // ── PDF ────────────────────────────────────────────────────────────────────
  generatePdfReport(): void {
    this.pdfLoading.set(true);
    const f: any = {};
    if (this.pdfFilter.username)  f.username  = this.pdfFilter.username;
    if (this.pdfFilter.year)      f.year      = this.pdfFilter.year;
    if (this.pdfFilter.startDate) f.startDate = this.pdfFilter.startDate;
    if (this.pdfFilter.endDate)   f.endDate   = this.pdfFilter.endDate;
    this.tripService.getTrips(f).subscribe({
      next: (res) => {
        if (!res.data.length) { this.pdfLoading.set(false); Swal.fire({ icon: 'info', title: 'No data', text: 'No trips match selected filters.' }); return; }
        this.loadJsPDF()
          .then(ctor => { this.pdfLoading.set(false); this.buildPdf(res.data, ctor); })
          .catch(() => { this.pdfLoading.set(false); Swal.fire({ icon: 'error', title: 'PDF Error', text: 'Could not load PDF library. Check internet connection.' }); });
      },
      error: () => { this.pdfLoading.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch trips.' }); },
    });
  }

  private loadJsPDF(): Promise<any> {
    const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    const win = window as any;
    const stale = document.getElementById('jspdf-script');
    if (stale) stale.remove();
    delete win.jspdf;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 20000);
      const s = document.createElement('script');
      s.id = 'jspdf-script'; s.src = CDN + '?v=' + Date.now(); s.async = true;
      s.onload  = () => { clearTimeout(timer); win.jspdf?.jsPDF ? resolve(win.jspdf.jsPDF) : reject(new Error('missing')); };
      s.onerror = () => { clearTimeout(timer); reject(new Error('load error')); };
      document.head.appendChild(s);
    });
  }

  private buildPdf(trips: Trip[], jsPDFCtor: any): void {
    const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const PW = 297, PH = 210, ML = 8, MR = 8, MT = 10, TW = PW - ML - MR;
    type RGB = [number, number, number];
    const NAVY: RGB=[26,51,102], WHITE: RGB=[255,255,255], YELBG: RGB=[255,235,156];
    const LTBLUE: RGB=[197,217,241], TOTALBG: RGB=[189,215,238], GRIDC: RGB=[160,160,170];
    const BLACK: RGB=[0,0,0];

    const sorted = [...trips].sort((a, b) => {
      const nc = (a.username||'').localeCompare(b.username||'');
      if (nc !== 0) return nc;
      const da = a.travelDate ? new Date(a.travelDate as string).getTime() : 0;
      const db = b.travelDate ? new Date(b.travelDate as string).getTime() : 0;
      return da - db;
    });

    const personName = this.pdfFilter.username?.trim() || '';
    let dateRangeStr = 'All Dates';
    if (this.pdfFilter.startDate && this.pdfFilter.endDate)
      dateRangeStr = `${this.ordinal(this.pdfFilter.startDate)} to ${this.ordinal(this.pdfFilter.endDate)}`;
    else if (this.pdfFilter.year)
      dateRangeStr = `1st January ${this.pdfFilter.year} to 31st December ${this.pdfFilter.year}`;
    else if (sorted.length) {
      const first = sorted.find(t => t.travelDate)?.travelDate;
      const last  = sorted.slice().reverse().find(t => t.returnDate)?.returnDate;
      if (first && last) dateRangeStr = `${this.ordinal(first as string)} to ${this.ordinal(last as string)}`;
    }
    const reportTitle = `Travel Summary ${dateRangeStr}${personName ? ' (' + personName + ')' : ''}`;

    // Columns — total = 281mm (297 - 8 - 8)
    const cols = [
      { h: 'No.',         w: 8,  al: 'center' as const },
      { h: 'Issue\nDate', w: 18, al: 'center' as const },
      { h: 'Name',        w: 34, al: 'left'   as const },
      { h: 'Airlines',    w: 22, al: 'left'   as const },
      { h: 'Sector',      w: 26, al: 'center' as const },
      { h: 'Class',       w: 18, al: 'center' as const },
      { h: 'Travel\nDate',w: 20, al: 'center' as const },
      { h: 'Return\nDate',w: 20, al: 'center' as const },
      { h: 'In\nIndia',   w: 14, al: 'center' as const },
      { h: 'In UAE/\nAbroad',w:14,al: 'center' as const },
      { h: 'Exit\nTime',  w: 18, al: 'center' as const },
      { h: 'Entry\nTime', w: 18, al: 'center' as const },
      { h: 'Remarks',     w: 31, al: 'left'   as const },
    ]; // 8+18+34+22+26+18+20+20+14+14+18+18+31 = 281 ✓

    const ROW_H = 7, HEAD_H = 10, GRP_H = 6.5;
    let page = 1, curY = MT;
    const colX = (i: number) => { let x = ML; for (let j=0;j<i;j++) x+=cols[j].w; return x; };

    const cell = (text: string, ci: number, y: number, rh: number, bold=false, clr: RGB=BLACK) => {
      const x=colX(ci), cw=cols[ci].w, al: string=cols[ci].al;
      doc.setFont('helvetica', bold?'bold':'normal'); doc.setFontSize(6.5); doc.setTextColor(...clr);
      const tx = al==='center' ? x+cw/2 : x+1.5;
      doc.text(String(text), tx, y+rh/2+2.2, { align: al as any, maxWidth: cw-2 });
    };

    const drawTitle = () => {
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...NAVY);
      doc.text(reportTitle, PW/2, curY+5, { align:'center', maxWidth: TW }); curY+=13;
    };

    const drawHeaders = () => {
      doc.setFillColor(...NAVY); doc.rect(ML,curY,TW,HEAD_H,'F');
      for (let i=0;i<cols.length;i++) {
        const parts=cols[i].h.split('\n'),x=colX(i),cw=cols[i].w,al=cols[i].al;
        doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...WHITE);
        const tx=al==='center'?x+cw/2:x+1.5, ha=al==='center'?'center':'left';
        if (parts.length===2) { doc.text(parts[0],tx,curY+3.2,{align:ha,maxWidth:cw-1}); doc.text(parts[1],tx,curY+7,{align:ha,maxWidth:cw-1}); }
        else doc.text(parts[0],tx,curY+HEAD_H/2+1.5,{align:ha,maxWidth:cw-1});
        if (i>0){doc.setDrawColor(...WHITE);doc.setLineWidth(0.12);doc.line(x,curY,x,curY+HEAD_H);}
      }
      doc.setDrawColor(...GRIDC); doc.setLineWidth(0.3); doc.rect(ML,curY,TW,HEAD_H); curY+=HEAD_H;
    };

    const drawBanner = (label: string) => {
      if (curY+GRP_H>PH-14) newPage();
      doc.setFillColor(...YELBG); doc.rect(ML,curY,TW,GRP_H,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...NAVY);
      doc.text(label, ML+TW/2, curY+GRP_H/2+1.8, {align:'center'});
      doc.setDrawColor(...GRIDC); doc.setLineWidth(0.25); doc.rect(ML,curY,TW,GRP_H); curY+=GRP_H;
    };

    const drawRow = (trip: Trip, rowNum: number, alt: boolean) => {
      if (curY+ROW_H>PH-14) newPage();
      doc.setFillColor(...(alt?LTBLUE:WHITE)); doc.rect(ML,curY,TW,ROW_H,'F');
      const ry=curY;
      const travelLabel = trip.startingLocation==='IN_UAE' ? 'IN UAE' : trip.startingLocation==='IN_INDIA' ? 'IN INDIA' : trip.travelDate ? this.fmtDateShort(trip.travelDate) : 'IN UAE';
      cell(rowNum.toString(),0,ry,ROW_H,false,NAVY);
      cell(this.fmtDateShort(trip.issueDate),1,ry,ROW_H);
      cell(trip.username,2,ry,ROW_H,true);
      cell(trip.airline||'',3,ry,ROW_H);
      cell(trip.sector||'',4,ry,ROW_H,true);
      cell(trip.travelClass||'',5,ry,ROW_H);
      cell(travelLabel,6,ry,ROW_H);
      cell(this.fmtDateShort(trip.returnDate),7,ry,ROW_H);
      cell((trip.inIndiaDays||0)>0?String(trip.inIndiaDays):'0',8,ry,ROW_H,true,[0,120,0] as RGB);
      cell((trip.inUAEDays||0)>0?String(trip.inUAEDays):'',9,ry,ROW_H,true,[26,86,180] as RGB);
      cell(trip.exitTime||'',10,ry,ROW_H);
      cell(trip.entryTime||'',11,ry,ROW_H);
      cell(trip.notes||'',12,ry,ROW_H);
      doc.setDrawColor(...GRIDC); doc.setLineWidth(0.12);
      for (let i=1;i<cols.length;i++){const x=colX(i);doc.line(x,ry,x,ry+ROW_H);}
      doc.setLineWidth(0.25); doc.rect(ML,ry,TW,ROW_H); curY+=ROW_H;
    };

    const drawSubtotal = (label: string, india: number, uae: number) => {
      if (curY+ROW_H>PH-14) newPage();
      doc.setFillColor(...TOTALBG); doc.rect(ML,curY,TW,ROW_H,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...NAVY);
      doc.text(`Subtotal — ${label}`, ML+(colX(8)-ML)/2, curY+ROW_H/2+2, {align:'center'});
      cell(india.toString(),8,curY,ROW_H,true,[0,120,0] as RGB);
      cell(uae.toString(),9,curY,ROW_H,true,[26,86,180] as RGB);
      doc.setFontSize(6.5); doc.setTextColor(...NAVY);
      doc.text(`Total: ${india+uae}`, colX(12)+2, curY+ROW_H/2+2);
      doc.setDrawColor(...GRIDC); doc.setLineWidth(0.3); doc.rect(ML,curY,TW,ROW_H);
      for (let i=8;i<=12;i++){doc.setLineWidth(0.18);doc.line(colX(i),curY,colX(i),curY+ROW_H);}
      curY+=ROW_H;
    };

    const drawGrandTotal = (india: number, uae: number) => {
      if (curY+ROW_H+2>PH-8) newPage();
      doc.setFillColor(...NAVY); doc.rect(ML,curY,TW,ROW_H+1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...WHITE);
      doc.text('TOTAL DAYS', ML+(colX(8)-ML)/2, curY+(ROW_H+1)/2+2.2, {align:'center'});
      cell(india.toString(),8,curY,ROW_H+1,true,[100,230,120] as RGB);
      cell(uae.toString(),9,curY,ROW_H+1,true,[140,200,255] as RGB);
      doc.setFontSize(7); doc.setTextColor(240,200,100);
      doc.text(
  String(india + uae),
  colX(12) + 4,
  curY + (ROW_H + 1) / 2 + 2.2
);
      doc.setDrawColor(...GRIDC); doc.setLineWidth(0.3); doc.rect(ML,curY,TW,ROW_H+1);
      for (let i=8;i<=12;i++) doc.line(colX(i),curY,colX(i),curY+ROW_H+1);
      curY+=ROW_H+1;
    };

    const drawFooter = () => {
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(120,120,120);
      doc.text(`Page ${page}`, PW-MR, PH-4, {align:'right'});
      doc.text('Travel Tracker — Confidential', ML, PH-4);
    };
    const newPage = () => { drawFooter(); doc.addPage(); page++; curY=MT; drawHeaders(); };

    const byPerson = new Map<string, Trip[]>();
    for (const t of sorted) {
      const n = t.username||'Unknown';
      if (!byPerson.has(n)) byPerson.set(n, []);
      byPerson.get(n)!.push(t);
    }

    drawTitle(); drawHeaders();
    let grandIndia=0, grandUAE=0, rowNum=1, alt=false;
    for (const [name, pTrips] of byPerson) {
      drawBanner(`${name}${pTrips[0]?.designation?' — '+pTrips[0].designation:''}`);
      let pI=0, pU=0;
      for (const t of pTrips) { drawRow(t,rowNum++,alt); alt=!alt; pI+=t.inIndiaDays||0; pU+=t.inUAEDays||0; }
      grandIndia+=pI; grandUAE+=pU;
      drawSubtotal(name, pI, pU);
    }
    drawGrandTotal(grandIndia, grandUAE);
    drawFooter();
    doc.save(`travel-summary${personName?'-'+personName.replace(/\s+/g,'_'):''}-${this.pdfFilter.year||'all'}-${Date.now()}.pdf`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private ordinal(d: string|Date): string {
    if (!d) return ''; const dt=new Date(d as string); if (isNaN(dt.getTime())) return String(d);
    const day=dt.getUTCDate(), suf=day===1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th';
    const mon=['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${day}${suf} ${mon[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
  }
  private fmtDateShort(d: string|Date|null|undefined): string {
    if (!d) return ''; const dt=new Date(d as string); if (isNaN(dt.getTime())) return '';
    const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(dt.getUTCDate()).padStart(2,'0')}-${mon[dt.getUTCMonth()]}-${String(dt.getUTCFullYear()).slice(-2)}`;
  }
  toInputDate(d: string|Date|null|undefined): string {
    if (!d) return ''; const dt=new Date(d as string); if (isNaN(dt.getTime())) return '';
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
  }
  formatDate(d: string|Date|null|undefined): string {
    if (!d) return ''; const dt=new Date(d as string); if (isNaN(dt.getTime())) return '';
    return `${String(dt.getUTCDate()).padStart(2,'0')}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${dt.getUTCFullYear()}`;
  }
  formatMonth(s: string): string {
    const [y,m]=s.split('-'); return new Date(+y,+m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  }
  getIndiaPct(india: number, uae: number): number { const t=india+uae; return t?Math.round(india/t*100):0; }
  getUaePct(india: number, uae: number): number   { const t=india+uae; return t?Math.round(uae/t*100):0; }
  get yearOptions(): number[] { const y: number[]=[]; for (let i=this.currentYear;i>=2015;i--) y.push(i); return y; }
}