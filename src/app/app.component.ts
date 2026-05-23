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
  isMobile           = signal(false);

  // ── Trip form ────────────────────────────────────────────────────────────
  tripForm: Partial<Trip> = this.defaultTripForm();
  editingId: string | null = null;

  // Controls whether Travel Date is a text label or a real date
  travelDateMode: 'date' | 'in_uae' | 'in_india' = 'date';

  // ── User form ────────────────────────────────────────────────────────────
  userForm: Partial<User> = this.defaultUserForm();
  editingUserId: string | null = null;
  showUserForm = false;

  // ── Filters ──────────────────────────────────────────────────────────────
  listFilter: any    = { year: '', month: '', username: '' };
  historyYear        = 'ALL';
  historyView: 'yearly' | 'monthly' = 'yearly';
  historyUsername    = '';
  pdfFilter: any     = { username: '', year: '', startDate: '', endDate: '' };
  showPdfPanel       = false;

  months = [
    { value: '1',  label: 'January'   }, { value: '2',  label: 'February'  },
    { value: '3',  label: 'March'     }, { value: '4',  label: 'April'     },
    { value: '5',  label: 'May'       }, { value: '6',  label: 'June'      },
    { value: '7',  label: 'July'      }, { value: '8',  label: 'August'    },
    { value: '9',  label: 'September' }, { value: '10', label: 'October'   },
    { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
  ];
  travelClasses = ['Economy', 'Premium Economy', 'Business', 'First'];
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
      username:       '',
      designation:    '',
      issueDate:      '',
      airline:        '',
      sector:         '',
      travelClass:    '',
      travelDateText: null,
      travelDate:     '',
      returnDate:     '',
      exitTime:       '',
      entryTime:      '',
      inIndiaDays:    0,
      inUAEDays:      0,
      notes:          '',
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

  // ── Travel date mode ──────────────────────────────────────────────────────
  setTravelDateMode(mode: 'date' | 'in_uae' | 'in_india'): void {
    this.travelDateMode = mode;
    if (mode === 'in_uae') {
      this.tripForm.travelDateText = 'In UAE';
      this.tripForm.travelDate     = '';
    } else if (mode === 'in_india') {
      this.tripForm.travelDateText = 'In India';
      this.tripForm.travelDate     = '';
    } else {
      this.tripForm.travelDateText = null;
    }
  }

  getTravelDateDisplay(trip: Trip): string {
    if (trip.travelDateText) return trip.travelDateText;
    if (trip.travelDate)     return this.formatDate(trip.travelDate);
    return '—';
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
          if (!this.historyUsername && names.length) {
            this.historyUsername    = names[0];
            this.pdfFilter.username = names[0];
          }
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

  cancelUserForm(): void {
    this.showUserForm  = false;
    this.editingUserId = null;
    this.userForm      = this.defaultUserForm();
  }

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
      html: `<p>Delete <strong>${user.fullName || user.firstName + ' ' + user.lastName}</strong>? Their records will remain.</p>`,
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
    if (this.listFilter.year)              filter.year     = this.listFilter.year;
    if (this.listFilter.month && this.listFilter.year) filter.month = this.listFilter.month;
    if (this.listFilter.username?.trim())  filter.username = this.listFilter.username.trim();
    this.tripService.getTrips(filter).subscribe({
      next: (res) => { this.trips.set(res.data); this.loading.set(false); },
      error: () => { this.loading.set(false); Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load trips', timer: 2000 }); },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    const year     = this.historyYear     === 'ALL' ? undefined : this.historyYear;
    const username = this.historyUsername === 'ALL' ? undefined : this.historyUsername;
    this.tripService.getStats(year, username).subscribe({
      next: (res) => { this.stats.set(res.data); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
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
    this.tripForm       = this.defaultTripForm();
    this.travelDateMode = 'date';
    if (this.users().length) this.onUserSelect(this.users()[0]);
    this.editingId = null;
  }

  async submitTrip(): Promise<void> {
    if (!this.tripForm.username?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Select a person', text: 'Please select a traveller.' });
      return;
    }

    // returnDate is the most required field
    if (!this.tripForm.returnDate) {
      Swal.fire({ icon: 'warning', title: 'Missing return date', text: 'Return date is required.' });
      return;
    }

    this.loading.set(true);

    const payload: any = {
      username:       this.tripForm.username,
      designation:    this.tripForm.designation || '',
      issueDate:      this.tripForm.issueDate   || null,
      airline:        this.tripForm.airline     || '',
      sector:         this.tripForm.sector      || '',
      travelClass:    this.tripForm.travelClass || '',
      returnDate:     this.tripForm.returnDate,
      exitTime:       this.tripForm.exitTime    || '',
      entryTime:      this.tripForm.entryTime   || '',
      inIndiaDays:    Number(this.tripForm.inIndiaDays) || 0,
      inUAEDays:      Number(this.tripForm.inUAEDays)   || 0,
      notes:          this.tripForm.notes       || '',
    };

    // Travel date
    if (this.travelDateMode === 'in_uae') {
      payload.travelDateText = 'In UAE';
      payload.travelDate     = null;
    } else if (this.travelDateMode === 'in_india') {
      payload.travelDateText = 'In India';
      payload.travelDate     = null;
    } else {
      payload.travelDateText = null;
      payload.travelDate     = this.tripForm.travelDate || null;
    }

    const op = this.editingId
      ? this.tripService.updateTrip(this.editingId, payload)
      : this.tripService.createTrip(payload);

    op.subscribe({
      next: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'success', title: this.editingId ? 'Updated!' : 'Record Added!', timer: 1800, showConfirmButton: false });
        this.resetForm();
        this.loadTrips();
        this.loadYears();
        if (this.editingId) this.activeTab.set('list');
      },
      error: (err) => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to save record' });
      },
    });
  }

  editTrip(trip: Trip): void {
    this.editingId = trip._id!;

    // Determine travel date mode
    if (trip.travelDateText === 'In UAE') {
      this.travelDateMode = 'in_uae';
    } else if (trip.travelDateText === 'In India') {
      this.travelDateMode = 'in_india';
    } else {
      this.travelDateMode = 'date';
    }

    this.tripForm = {
      username:       trip.username,
      designation:    trip.designation,
      issueDate:      trip.issueDate  ? this.formatDateForInput(trip.issueDate)  : '',
      airline:        trip.airline    || '',
      sector:         trip.sector     || '',
      travelClass:    trip.travelClass || '',
      travelDateText: trip.travelDateText || null,
      travelDate:     trip.travelDate ? this.formatDateForInput(trip.travelDate) : '',
      returnDate:     trip.returnDate ? this.formatDateForInput(trip.returnDate) : '',
      exitTime:       trip.exitTime   || '',
      entryTime:      trip.entryTime  || '',
      inIndiaDays:    trip.inIndiaDays ?? 0,
      inUAEDays:      trip.inUAEDays  ?? 0,
      notes:          trip.notes      || '',
    };

    this.activeTab.set('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteTrip(trip: Trip): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning', title: 'Delete record?',
      html: `<p>Delete record for <strong>${trip.username}</strong> — ${trip.sector || 'no sector'}?</p>`,
      showCancelButton: true, confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel', confirmButtonColor: '#e74c3c',
    });
    if (result.isConfirmed) {
      this.tripService.deleteTrip(trip._id!).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
          this.loadTrips();
          this.loadStats();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete record' }),
      });
    }
  }

  applyListFilter():    void { this.loadTrips(); }
  clearListFilter():    void { this.listFilter = { year: '', month: '', username: '' }; this.loadTrips(); }
  applyHistoryFilter(): void { this.loadStats(); }
  togglePdfPanel():     void { this.showPdfPanel = !this.showPdfPanel; }

  // ── PDF Generation ────────────────────────────────────────────────────────
  generatePdfReport(): void {
    if (this.pdfLoading()) return;
    this.pdfLoading.set(true);

    const filter: any = {};
    if (this.pdfFilter.username)  filter.username  = this.pdfFilter.username;
    if (this.pdfFilter.year)      filter.year       = this.pdfFilter.year;
    if (this.pdfFilter.startDate) filter.startDate  = this.pdfFilter.startDate;
    if (this.pdfFilter.endDate)   filter.endDate    = this.pdfFilter.endDate;

    this.tripService.getTrips(filter).subscribe({
      next: (res) => {
        if (!res.data.length) {
          Swal.fire({ icon: 'info', title: 'No data', text: 'No records found for selected filters.', timer: 2000 });
          this.pdfLoading.set(false);
          return;
        }
        this.loadJsPDF()
          .then(jsPDF => this.buildTravelSummaryPdf(res.data, jsPDF))
          .catch(() => Swal.fire({ icon: 'error', title: 'PDF Error', text: 'Failed to load PDF library.' }))
          .finally(() => this.pdfLoading.set(false));
      },
      error: () => this.pdfLoading.set(false),
    });
  }

  private loadJsPDF(): Promise<any> {
    const win = window as any;
    if (win.jspdf?.jsPDF) return Promise.resolve(win.jspdf.jsPDF);
    return new Promise((resolve, reject) => {
      let script = document.getElementById('jspdf-script') as HTMLScriptElement;
      if (script) { script.onload = () => resolve(win.jspdf.jsPDF); return; }
      script = document.createElement('script');
      script.id  = 'jspdf-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async  = true;
      script.onload  = () => resolve(win.jspdf.jsPDF);
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }

  private buildTravelSummaryPdf(trips: Trip[], jsPDFCtor: any): void {
    const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // A4 landscape: 297 × 210 mm
    const PW = 297, PH = 210, ML = 6, MR = 6, MT = 10;
    const TW = PW - ML - MR;

    type RGB = [number, number, number];
    const NAVY:    RGB = [26,  51, 102];
    const YELBG:   RGB = [255, 235, 156];
    const WHITE:   RGB = [255, 255, 255];
    const TOTALBG: RGB = [189, 215, 238];
    const GRIDC:   RGB = [180, 180, 180];
    const BLACK:   RGB = [0,   0,   0];
    const GREEN:   RGB = [0,   100, 0];
    const BLUE:    RGB = [26,  86,  180];

    // Sort by returnDate ascending
    const sorted = [...trips].sort((a, b) => {
      const da = a.returnDate ? new Date(a.returnDate as string).getTime() : 0;
      const db = b.returnDate ? new Date(b.returnDate as string).getTime() : 0;
      return da - db;
    });

    const personName  = this.pdfFilter.username?.trim() || '';
    const yearLabel   = this.pdfFilter.year || '';

    let dateRangeStr = 'All Dates';
    if (this.pdfFilter.startDate && this.pdfFilter.endDate) {
      dateRangeStr = `${this.formatDateOrdinal(this.pdfFilter.startDate)} to ${this.formatDateOrdinal(this.pdfFilter.endDate)}`;
    } else if (yearLabel) {
      // Financial year display: Apr 1 to Mar 31
      dateRangeStr = `1st April ${yearLabel} to 31st March ${Number(yearLabel) + 1}`;
    } else if (sorted.length) {
      const first = sorted[0].returnDate || sorted[0].travelDate;
      const last  = sorted[sorted.length - 1].returnDate || sorted[sorted.length - 1].travelDate;
      if (first && last) dateRangeStr = `${this.formatDateOrdinal(first as string)} to ${this.formatDateOrdinal(last as string)}`;
    }

    const reportTitle = `Travel Summary ${dateRangeStr}${personName ? ' (' + personName + ')' : ''}`;

    // ── Column definitions ───────────────────────────────────────────────────
    //  No. | Issue Date | Name | Airlines | Sector | Class | Travel Date | Return Date | In India | In UAE/Abroad | EXIT TIME | ENTRY TIME | Remarks
    const cols = [
      { h: 'No.',          w: 8,  align: 'center' as const },
      { h: 'Issue Date',   w: 20, align: 'center' as const },
      { h: 'Name',         w: 35, align: 'left'   as const },
      { h: 'Airlines',     w: 20, align: 'left'   as const },
      { h: 'Sector',       w: 28, align: 'center' as const },
      { h: 'Class',        w: 18, align: 'center' as const },
      { h: 'Travel Date',  w: 22, align: 'center' as const },
      { h: 'Return Date',  w: 22, align: 'center' as const },
      { h: 'In India',     w: 14, align: 'center' as const },
      { h: 'In\nUAE/Abroad', w: 16, align: 'center' as const },
      { h: 'EXIT TIME',    w: 20, align: 'center' as const },
      { h: 'ENTRY TIME',   w: 20, align: 'center' as const },
      { h: 'Remarks',      w: 14, align: 'left'   as const },
    ];

    const ROW_H  = 7;
    const HEAD_H = 9;
    const GRP_H  = 6;
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
      const tx = al === 'center' ? x + cw / 2 : x + 1.5;
      doc.text(String(text ?? ''), tx, y + rh / 2 + 2.2, { align: al as any, maxWidth: cw - 2 });
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
        doc.text(cols[i].h, x + cw / 2, curY + HEAD_H / 2 + 1.5, { align: 'center', maxWidth: cw - 1 });
        if (i > 0) { doc.setDrawColor(...GRIDC); doc.line(x, curY, x, curY + HEAD_H); }
      }
      doc.setDrawColor(...GRIDC);
      doc.rect(ML, curY, TW, HEAD_H);
      curY += HEAD_H;
    };

    const drawGroupHeader = (label: string) => {
      doc.setFillColor(...YELBG);
      doc.rect(ML, curY, TW, GRP_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text(label, ML + TW / 2, curY + GRP_H / 2 + 1.8, { align: 'center' });
      doc.setDrawColor(...GRIDC);
      doc.rect(ML, curY, TW, GRP_H);
      curY += GRP_H;
    };

    const drawDataRow = (trip: Trip, rowNum: number) => {
      // Check page overflow
      if (curY + ROW_H > PH - 12) {
        doc.addPage();
        curY = MT;
        drawColHeaders();
      }

      doc.setFillColor(...WHITE);
      doc.rect(ML, curY, TW, ROW_H, 'F');
      const ry = curY;

      cellText(rowNum.toString(),                                 0, ry, ROW_H);
      cellText(trip.issueDate ? this.formatDateShort(trip.issueDate) : '', 1, ry, ROW_H);
      cellText(trip.username,                                     2, ry, ROW_H);
      cellText(trip.airline || '',                                3, ry, ROW_H);
      cellText(trip.sector  || '',                                4, ry, ROW_H);
      cellText(trip.travelClass || '',                            5, ry, ROW_H);
      cellText(this.getTravelDateDisplayForPdf(trip),             6, ry, ROW_H);
      cellText(trip.returnDate ? this.formatDateShort(trip.returnDate) : '', 7, ry, ROW_H);

      // In India — green, bold if non-zero
      const india = trip.inIndiaDays || 0;
      const uae   = trip.inUAEDays   || 0;
      cellText(india ? india.toString() : '', 8, ry, ROW_H, india > 0, india > 0 ? GREEN : BLACK);
      cellText(uae   ? uae.toString()   : '', 9, ry, ROW_H, uae   > 0, uae   > 0 ? BLUE  : BLACK);

      cellText(trip.exitTime  || '', 10, ry, ROW_H);
      cellText(trip.entryTime || '', 11, ry, ROW_H);
      cellText(trip.notes     || '', 12, ry, ROW_H);

      doc.setDrawColor(...GRIDC);
      doc.rect(ML, ry, TW, ROW_H);
      curY += ROW_H;
    };

    const drawTotalRow = (totalIndia: number, totalUAE: number) => {
      if (curY + ROW_H > PH - 10) { doc.addPage(); curY = MT; }

      doc.setFillColor(...TOTALBG);
      doc.rect(ML, curY, TW, ROW_H, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text('Total Days', ML + 90, curY + ROW_H / 2 + 2.2, { align: 'center' });

      cellText(totalIndia.toString(),                8, curY, ROW_H, true, GREEN);
      cellText(totalUAE.toString(),                  9, curY, ROW_H, true, BLUE);
      cellText((totalIndia + totalUAE).toString(),  12, curY, ROW_H, true);

      doc.setDrawColor(...GRIDC);
      doc.rect(ML, curY, TW, ROW_H);
      curY += ROW_H;
    };

    // ── Draw ─────────────────────────────────────────────────────────────────
    drawTitle();
    drawColHeaders();
    drawGroupHeader(yearLabel
      ? `1st April ${yearLabel} to 31st March ${Number(yearLabel) + 1}`
      : 'All Records');

    let totalIndia = 0;
    let totalUAE   = 0;

    sorted.forEach((trip, i) => {
      totalIndia += trip.inIndiaDays || 0;
      totalUAE   += trip.inUAEDays   || 0;
      drawDataRow(trip, i + 1);
    });

    drawTotalRow(totalIndia, totalUAE);

    // ── Save ─────────────────────────────────────────────────────────────────
    const safeUser = (this.pdfFilter.username || 'All_Users').replace(/\s+/g, '_');
    let fileName   = `Travel_Summary_${safeUser}`;
    if (yearLabel) fileName += `_FY${yearLabel}`;
    if (this.pdfFilter.startDate && this.pdfFilter.endDate) {
      fileName += `_${this.pdfFilter.startDate}_to_${this.pdfFilter.endDate}`;
    }
    fileName += '.pdf';
    doc.save(fileName);
  }

  private getTravelDateDisplayForPdf(trip: Trip): string {
    if (trip.travelDateText) return trip.travelDateText;
    if (trip.travelDate)     return this.formatDateShort(trip.travelDate);
    return '';
  }

  // ── NRI Warning ───────────────────────────────────────────────────────────
  get nriWarning(): string | null {
    const s = this.stats();
    if (!s) return null;
    // Check current financial year India days
    const now  = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    // Find from monthly data
    const fyMonths = [
      ...Array.from({ length: 9 }, (_, i) => `${fyStart}-${String(i + 4).padStart(2, '0')}`),
      ...Array.from({ length: 3 }, (_, i) => `${fyStart + 1}-${String(i + 1).padStart(2, '0')}`),
    ];
    const fyIndia = (s.monthly || [])
      .filter(m => fyMonths.includes(m.month))
      .reduce((sum, m) => sum + m.india, 0);
    const remaining = 181 - fyIndia;
    if (fyIndia >= 182) return `⚠️ NRI status at risk! ${fyIndia} days in India in FY ${fyStart}-${fyStart + 1} (limit: 181)`;
    if (remaining <= 30) return `⚠️ Only ${remaining} more days allowed in India this FY before NRI status is affected`;
    return null;
  }

  // ── Date helpers ──────────────────────────────────────────────────────────
  private formatDateOrdinal(d: string | Date): string {
    if (!d) return '';
    const dt = new Date(d as string);
    if (isNaN(dt.getTime())) return String(d);
    const day = dt.getUTCDate();
    const suf = day === 1 || day === 21 || day === 31 ? 'st'
              : day === 2 || day === 22              ? 'nd'
              : day === 3 || day === 23              ? 'rd' : 'th';
    const mon = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${day}${suf} ${mon[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
  }

  private formatDateShort(date: string | Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date as string);
    if (isNaN(d.getTime())) return '';
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getUTCDate()).padStart(2, '0')}-${mon[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
  }

  formatDate(date: string | Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date as string);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
  }

  formatDateForInput(date: string | Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date as string);
    if (isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  formatMonth(s: string): string {
    const [y, m] = s.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  getIndiaPct(india: number, uae: number): number { const t = india + uae; return t ? Math.round(india / t * 100) : 0; }
  getUaePct  (india: number, uae: number): number { const t = india + uae; return t ? Math.round(uae   / t * 100) : 0; }
  getIndiaNriPct(india: number): number { return Math.min(100, india / 182 * 100); }

  getUserInitials(user: User): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }

  get yearOptions(): number[] {
    const y: number[] = [];
    for (let i = this.currentYear; i >= 2015; i--) y.push(i);
    return y;
  }
}