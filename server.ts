import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';

import { db } from './src/db/index.ts';
import { 
  users, shifts, notes, proposals, marketOffers, 
  controlEvents, deletedEvents, coordinatorReports 
} from './src/db/schema.ts';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import { authGuard, AuthRequest } from './src/lib/auth-middleware.ts';

const app = express();
app.use(express.json());

const PORT = 3000;

// Helper password hasher: SHA256 (Simple and native)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Default Data Seed
const DEFAULT_USERS = [
  {
    id: 1,
    email: 'admin@grafik.pl',
    passwordHash: hashPassword('admin123'),
    fullName: 'Robert Admin',
    role: 'admin',
    hourlyRatePln: 35.00,
    taxPercent: 12.0
  },
  {
    id: 2,
    email: 'coord@grafik.pl',
    passwordHash: hashPassword('coord123'),
    fullName: 'Michał Koordynator',
    role: 'coordinator',
    hourlyRatePln: 30.00,
    taxPercent: 12.0
  },
  {
    id: 3,
    email: 'user@grafik.pl',
    passwordHash: hashPassword('user123'),
    fullName: 'Jan Nowak',
    role: 'user',
    hourlyRatePln: 28.10,
    taxPercent: 12.0
  },
  {
    id: 4,
    email: 'tomasz@grafik.pl',
    passwordHash: hashPassword('user123'),
    fullName: 'Tomasz Kowalski',
    role: 'user',
    hourlyRatePln: 28.10,
    taxPercent: 12.0
  },
  {
    id: 5,
    email: 'anna@grafik.pl',
    passwordHash: hashPassword('user123'),
    fullName: 'Anna Wiśniewska',
    role: 'user',
    hourlyRatePln: 29.00,
    taxPercent: 12.0
  }
];

// Helper to generate a full month of initial mock shifts for June 2026
function generateMockShifts(): any[] {
  const generated: any[] = [];
  const year = 2026;
  const month = 6; // June

  for (let day = 1; day <= 30; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-06-${dayStr}`;

    DEFAULT_USERS.forEach((u, index) => {
      const rotationIndex = (day + index * 3) % 6;
      if (rotationIndex < 4) {
        const isMorning = (day + index) % 2 === 0;
        const code = isMorning ? '1' : '2';
        
        const isBar = index === 3 || (index === 4 && !isMorning);
        const isCoord = u.role === 'coordinator' || (u.role === 'admin' && isMorning);
        const isZmiwak = index === 2 && !isMorning;

        generated.push({
          userId: u.id,
          shiftDate: dateStr,
          shiftCode: code + (isBar ? '/B' : ''),
          isBarToday: isBar,
          isCoordinator: isCoord,
          isZmiwaka: isZmiwak,
          lounge: isMorning ? 'mazurek' : 'polonez',
          coordLounge: isCoord ? (isMorning ? 'mazurek' : 'polonez') : '',
          scheduledHours: 8.0,
          startTime: isMorning ? '06:00' : '14:00',
          endTime: isMorning ? '14:00' : '22:00'
        });
      }
    });
  }
  return generated;
}

// Seed function
async function seedDBIfEmpty() {
  try {
    const checkUsers = await db.select().from(users).limit(1);
    if (checkUsers.length === 0) {
      console.log('[Database Seeding] Seeding default users...');
      
      // Insert users with explicit IDs
      for (const u of DEFAULT_USERS) {
        await db.insert(users).values({
          id: u.id,
          email: u.email,
          passwordHash: u.passwordHash,
          fullName: u.fullName,
          role: u.role,
          hourlyRatePln: u.hourlyRatePln,
          taxPercent: u.taxPercent
        });
      }

      // Sync sequence in Postgres
      await db.execute(sql`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));`);
      console.log('[Database Seeding] Users seeded successfully!');

      // Populate Mock Shifts
      const mockShifts = generateMockShifts();
      console.log(`[Database Seeding] Seeding ${mockShifts.length} mock shifts for June 2026...`);
      for (const s of mockShifts) {
        await db.insert(shifts).values(s);
      }
      console.log('[Database Seeding] Shifts seeded successfully!');

      // Add one default note
      await db.insert(notes).values({
        date: '2026-06-16',
        text: 'Wszyscy barmani na stanowiskach. Czysto i super frekwencja dzisiaj!',
        author: 'Robert Admin',
        authorId: 1,
        createdAt: new Date().toISOString()
      });
      console.log('[Database Seeding] Main note seeded.');
    } else {
      console.log('[Database Seeding] Database is already initialized.');
    }
  } catch (error) {
    console.error('[Database Seeding Error] Seeding failed:', error);
  }
}

// Run Seeder
seedDBIfEmpty();


/* ================== API ENDPOINTS ================== */

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Authentication: Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Proszę podać email i hasło' });
    }
    
    const matchedUsers = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (matchedUsers.length === 0) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    const user = matchedUsers[0];
    if (user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Create custom simplified token
    const tokenPayload = {
      user_id: user.id,
      sub: String(user.id),
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 1 day
    };
    const access_token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    res.json({ access_token, user: { id: user.id, full_name: user.fullName, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd logowania: ' + err.message });
  }
});

// Authentication: Register
app.post('/api/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Wszystkie pola są wymagane' });
    }

    const checkExists = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (checkExists.length > 0) {
      return res.status(400).json({ error: 'Użytkownik o takim adresie email już istnieje' });
    }

    await db.insert(users).values({
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      fullName: full_name.trim(),
      role: 'user',
      hourlyRatePln: 28.10,
      taxPercent: 12.0
    });

    res.json({ success: true, message: 'Konto zostało utworzone. Zaloguj się.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd rejestracji: ' + err.message });
  }
});

// Password change directly inside auth page before logging in
app.post('/api/password/change-before-login', async (req, res) => {
  try {
    const { email, stare_haslo, nowe_haslo } = req.body;
    if (!email || !stare_haslo || !nowe_haslo) {
      return res.status(400).json({ error: 'Wszystkie pola są wymagane' });
    }

    const checkUser = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (checkUser.length === 0) {
      return res.status(404).json({ error: 'Nieprawidłowy adres email' });
    }

    const user = checkUser[0];
    if (user.passwordHash !== hashPassword(stare_haslo)) {
      return res.status(400).json({ error: 'Błędne dotychczasowe hasło' });
    }

    await db.update(users).set({ passwordHash: hashPassword(nowe_haslo) }).where(eq(users.id, user.id));
    res.json({ success: true, message: 'Hasło zostało zmienione.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zmiany hasła: ' + err.message });
  }
});

// Password change inside profile (Auth protected)
app.post('/api/password/change', authGuard, async (req: AuthRequest, res) => {
  try {
    const { stare_haslo, nowe_haslo } = req.body;
    const user = req.user;
    if (!stare_haslo || !nowe_haslo) {
      return res.status(400).json({ error: 'Proszę podać stare i nowe hasło' });
    }

    if (user.passwordHash !== hashPassword(stare_haslo)) {
      return res.status(400).json({ error: 'Błędne stare hasło' });
    }

    await db.update(users).set({ passwordHash: hashPassword(nowe_haslo) }).where(eq(users.id, user.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zmiany hasła: ' + err.message });
  }
});

// Users List for dropdowns
app.get('/api/users', authGuard, async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.select().from(users);
    const list = allUsers.map(u => ({ id: u.id, full_name: u.fullName, role: u.role }));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania użytkowników: ' + err.message });
  }
});

// Get User stats configurations
app.get('/api/me/settings', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    res.json({
      hourly_rate_pln: user.hourlyRatePln || 28.10,
      tax_percent: user.taxPercent || 12.0
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania ustawień: ' + err.message });
  }
});

// Update User stats rate/tax config
app.post('/api/me/settings', authGuard, async (req: AuthRequest, res) => {
  try {
    const { hourly_rate_pln, tax_percent } = req.body;
    const user = req.user;

    const updates: any = {};
    if (hourly_rate_pln != null) updates.hourlyRatePln = Number(hourly_rate_pln);
    if (tax_percent != null) updates.taxPercent = Number(tax_percent);

    await db.update(users).set(updates).where(eq(users.id, user.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu ustawień: ' + err.message });
  }
});

// Get context shifts for logged-in user
app.get('/api/my-shifts', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const userShifts = await db.select().from(shifts).where(eq(shifts.userId, user.id));
    
    // Map with backward-compatible camelCase to snake_case structure
    const mapped = userShifts.map(s => ({
      id: s.id,
      user_id: s.userId,
      shift_date: s.shiftDate,
      shift_code: s.shiftCode,
      is_bar_today: s.isBarToday,
      is_coordinator: s.isCoordinator,
      is_zmiwaka: s.isZmiwaka,
      lounge: s.lounge,
      coord_lounge: s.coordLounge,
      scheduled_hours: s.scheduledHours,
      worked_hours: s.workedHours,
      start_time: s.startTime,
      end_time: s.endTime,
      note: s.note
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania zmian: ' + err.message });
  }
});

// Get brief detail summary for month
app.get('/api/my-shifts-brief', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { month } = req.query; // YYYY-MM
    if (!month) {
      return res.status(400).json({ error: 'Brak parametru month' });
    }

    const monthShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, user.id),
        like(shifts.shiftDate, `${month}%`)
      )
    );

    const list = monthShifts.map(s => ({
      id: s.id,
      date: s.shiftDate,
      code: s.shiftCode,
      scheduled_hours: s.scheduledHours,
      worked_hours: s.workedHours ?? s.scheduledHours,
      note: s.note
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania skrótu zmian: ' + err.message });
  }
});

// Single shift detail by id
app.get('/api/my-shift/:id', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(shifts).where(eq(shifts.id, id));
    if (results.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono zmiany' });
    }

    const shift = results[0];
    const code = shift.shiftCode;
    let default_start = '06:00';
    let default_end = '14:00';
    if (code.startsWith('2')) {
      default_start = '14:00';
      default_end = '22:00';
    }

    res.json({
      id: shift.id,
      date: shift.shiftDate,
      shift_code: shift.shiftCode,
      default_start,
      default_end,
      worked_hours: shift.workedHours ?? shift.scheduledHours,
      note: shift.note
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd szczegółów zmiany: ' + err.message });
  }
});

// Log custom hours or shift notes
app.post('/api/my-shift/:id/worklog', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { start_time, end_time, worked_hours, note } = req.body;

    const updates: any = {};
    if (start_time !== undefined) updates.startTime = start_time;
    if (end_time !== undefined) updates.endTime = end_time;
    if (worked_hours !== undefined) updates.workedHours = Number(worked_hours);
    if (note !== undefined) updates.note = String(note);

    const result = await db.update(shifts).set(updates).where(eq(shifts.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu logu pracy: ' + err.message });
  }
});

// Get complete day schedule (morning and evening lists)
app.get('/api/day-shifts', authGuard, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const dayShifts = await db.select().from(shifts).where(eq(shifts.shiftDate, String(date)));
    const allUsers = await db.select().from(users);
    const usersMap = new Map(allUsers.map(u => [u.id, u.fullName]));

    const mapShiftWithUserName = (s: any) => {
      return {
        id: s.id,
        user_id: s.userId,
        full_name: usersMap.get(s.userId) || 'Nieznany',
        shift_code: s.shiftCode,
        is_bar_today: s.isBarToday,
        is_coordinator: s.isCoordinator,
        is_zmiwaka: s.isZmiwaka,
        lounge: s.lounge,
        coord_lounge: s.coordLounge
      };
    };

    const morning = dayShifts.filter(s => s.shiftCode.startsWith('1')).map(mapShiftWithUserName);
    const evening = dayShifts.filter(s => s.shiftCode.startsWith('2')).map(mapShiftWithUserName);

    res.json({ morning, evening });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd harmonogramu dobowego: ' + err.message });
  }
});

// Get month schedule in bulk ladder dictionary view
app.get('/api/month-shifts', authGuard, async (req: AuthRequest, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and Month are required' });
    }

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthShifts = await db.select().from(shifts).where(like(shifts.shiftDate, `${monthPrefix}%`));
    
    const allUsers = await db.select().from(users);
    const usersMap = new Map(allUsers.map(u => [u.id, u.fullName]));

    const result: { [date: string]: { morning: any[]; evening: any[] } } = {};

    monthShifts.forEach(s => {
      const dt = s.shiftDate;
      if (!result[dt]) {
        result[dt] = { morning: [], evening: [] };
      }
      const mapped = {
        id: s.id,
        user_id: s.userId,
        full_name: usersMap.get(s.userId) || 'Nieznany',
        shift_code: s.shiftCode,
        is_bar_today: s.isBarToday,
        is_coordinator: s.isCoordinator,
        is_zmiwaka: s.isZmiwaka,
        lounge: s.lounge,
        coord_lounge: s.coordLounge
      };

      if (s.shiftCode.startsWith('1')) {
        result[dt].morning.push(mapped);
      } else if (s.shiftCode.startsWith('2')) {
        result[dt].evening.push(mapped);
      }
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd harmonogramu miesięcznego: ' + err.message });
  }
});

// Day notes log for start screen (Today Notes)
app.get('/api/day-notes', authGuard, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    const dayNotes = await db.select().from(notes).where(eq(notes.date, String(date)));
    res.json(dayNotes);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania notatek: ' + err.message });
  }
});

app.post('/api/day-notes', authGuard, async (req: AuthRequest, res) => {
  try {
    const { date, text } = req.body;
    const user = req.user;
    if (!date || !text) {
      return res.status(400).json({ error: 'Brak daty lub tekstu notatki' });
    }

    const inserted = await db.insert(notes).values({
      date: String(date),
      text: String(text).trim(),
      author: user.fullName,
      authorId: user.id,
      createdAt: new Date().toISOString()
    }).returning();

    res.json(inserted[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu notatki: ' + err.message });
  }
});

app.delete('/api/day-notes/:id', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const matchedNote = await db.select().from(notes).where(eq(notes.id, id));
    if (matchedNote.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono notatki' });
    }

    const noteRecord = matchedNote[0];
    if (noteRecord.authorId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień do usunięcia notatki' });
    }

    await db.delete(notes).where(eq(notes.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd usuwania notatki: ' + err.message });
  }
});

// Proposals Swap Panel (Incoming, Outgoing, Manager Approval Lists)
app.get('/api/proposals', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const allProposals = await db.select().from(proposals);
    const allUsers = await db.select().from(users);
    const usersMap = new Map(allUsers.map(u => [u.id, { full_name: u.fullName, email: u.email }]));

    const populateProposal = (p: any) => {
      const reqU = usersMap.get(p.requesterId);
      const tarU = usersMap.get(p.targetUserId);
      return {
        id: p.id,
        requester_id: p.requesterId,
        target_user_id: p.targetUserId,
        my_date: p.myDate,
        their_date: p.theirDate,
        status: p.status,
        created_at: p.createdAt,
        give_code: p.giveCode,
        take_code: p.takeCode,
        requester: reqU,
        target_user: tarU
      };
    };

    const incoming = allProposals.filter(p => p.targetUserId === user.id).map(populateProposal);
    const outgoing = allProposals.filter(p => p.requesterId === user.id).map(populateProposal);
    
    // Managers or Admins approve swaps
    const for_approval = (user.role === 'admin' || user.role === 'coordinator')
      ? allProposals.filter(p => p.status === 'accepted').map(populateProposal)
      : [];

    res.json({ incoming, outgoing, for_approval, to_approve: for_approval });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania giełdy zamian: ' + err.message });
  }
});

// Post a new swap proposal request
app.post('/api/proposals', authGuard, async (req: AuthRequest, res) => {
  try {
    const { target_user_id, my_date, their_date } = req.body;
    const user = req.user;

    if (!target_user_id || !my_date || !their_date) {
      return res.status(400).json({ error: 'Wszystkie dane do wymiany są wymagane' });
    }

    // Find users shifts in SQL
    const myShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, user.id),
        eq(shifts.shiftDate, String(my_date))
      )
    );
    const theirShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, Number(target_user_id)),
        eq(shifts.shiftDate, String(their_date))
      )
    );

    if (myShifts.length === 0) {
      return res.status(400).json({ error: 'Nie masz zarejestrowanej własnej zmiany w podanym dniu' });
    }
    if (theirShifts.length === 0) {
      return res.status(400).json({ error: 'Pracownik docelowy nie ma zmiany w podanym dniu' });
    }

    const inserted = await db.insert(proposals).values({
      requesterId: user.id,
      targetUserId: Number(target_user_id),
      myDate: String(my_date),
      theirDate: String(their_date),
      status: 'pending',
      createdAt: new Date().toISOString(),
      giveCode: myShifts[0].shiftCode,
      takeCode: theirShifts[0].shiftCode
    }).returning();

    res.json({
      id: inserted[0].id,
      requester_id: inserted[0].requesterId,
      target_user_id: inserted[0].targetUserId,
      my_date: inserted[0].myDate,
      their_date: inserted[0].theirDate,
      status: inserted[0].status,
      created_at: inserted[0].createdAt,
      give_code: inserted[0].giveCode,
      take_code: inserted[0].takeCode
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu wymiany: ' + err.message });
  }
});

// Proposals state actions
app.post('/api/proposals/:id/accept', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;
    await db.update(proposals).set({ status: 'accepted' }).where(
      and(
        eq(proposals.id, id),
        eq(proposals.targetUserId, user.id)
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd akceptacji: ' + err.message });
  }
});

app.post('/api/proposals/:id/decline', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;
    await db.update(proposals).set({ status: 'declined' }).where(
      and(
        eq(proposals.id, id),
        eq(proposals.targetUserId, user.id)
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd odrzucenia: ' + err.message });
  }
});

app.post('/api/proposals/:id/cancel', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;
    await db.update(proposals).set({ status: 'canceled' }).where(
      and(
        eq(proposals.id, id),
        eq(proposals.requesterId, user.id)
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd anulowania: ' + err.message });
  }
});

// Swap executions require Manager Approvals! When approved, shifts are swapped in DB
app.post('/api/proposals/:id/approve', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;
    if (user.role !== 'admin' && user.role !== 'coordinator') {
      return res.status(403).json({ error: 'Tylko Robert lub Michał mogą zatwierdzić zamiany' });
    }

    const matchedProps = await db.select().from(proposals).where(eq(proposals.id, id));
    if (matchedProps.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono propozycji' });
    }

    const proposal = matchedProps[0];
    if (proposal.status !== 'accepted') {
      return res.status(400).json({ error: 'Zamiana nie została jeszcze zaakceptowana przez adresata' });
    }

    // SWAP THE SHIFTS! Load shift documents
    const myShiftsArr = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, proposal.requesterId),
        eq(shifts.shiftDate, proposal.myDate)
      )
    );
    const theirShiftsArr = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, proposal.targetUserId),
        eq(shifts.shiftDate, proposal.theirDate)
      )
    );

    if (myShiftsArr.length > 0 && theirShiftsArr.length > 0) {
      // Cross swap user IDs inside shifts
      await db.update(shifts).set({ userId: proposal.targetUserId }).where(eq(shifts.id, myShiftsArr[0].id));
      await db.update(shifts).set({ userId: proposal.requesterId }).where(eq(shifts.id, theirShiftsArr[0].id));
    }

    await db.update(proposals).set({ status: 'approved' }).where(eq(proposals.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zatwierdzenia zamiany: ' + err.message });
  }
});

app.post('/api/proposals/:id/reject', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;
    if (user.role !== 'admin' && user.role !== 'coordinator') {
      return res.status(403).json({ error: 'Brak uprawnień menedżerskich' });
    }

    await db.update(proposals).set({ status: 'rejected' }).where(eq(proposals.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd odrzucenia zamiany: ' + err.message });
  }
});


// Shift Trade Market: View Offers
app.get('/api/market/offers', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const allOffers = await db.select().from(marketOffers);
    const allUsers = await db.select().from(users);
    const usersMap = new Map(allUsers.map(u => [u.id, u.fullName]));

    const populateOffer = (o: any) => {
      return {
        id: o.id,
        shift_id: o.shiftId,
        owner_id: o.ownerId,
        candidate_id: o.candidateId,
        date: o.date,
        code: o.code,
        status: o.status,
        created_at: o.createdAt,
        owner: { full_name: usersMap.get(o.ownerId) || 'Nieznany' },
        candidate: o.candidateId ? { full_name: usersMap.get(o.candidateId) || 'Nieznany' } : undefined
      };
    };

    const open = allOffers.filter(o => o.ownerId !== user.id).map(populateOffer);
    const mine = allOffers.filter(o => o.ownerId === user.id).map(populateOffer);

    res.json({ open, mine });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania ofert z rynku: ' + err.message });
  }
});

// Shift Trade Market: Publish shift to market
app.post('/api/market/offers/:shiftId', authGuard, async (req: AuthRequest, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const user = req.user;

    const matchedShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.userId, user.id)
      )
    );
    if (matchedShifts.length === 0) {
      return res.status(400).json({ error: 'Brak Twojej zmiany o podanym ID' });
    }

    const shift = matchedShifts[0];

    // Prevent posting duplicates
    const duplicates = await db.select().from(marketOffers).where(
      and(
        eq(marketOffers.shiftId, shiftId),
        or(
          eq(marketOffers.status, 'open'),
          eq(marketOffers.status, 'requested')
        )
      )
    );
    if (duplicates.length > 0) {
      return res.status(400).json({ error: 'Ta zmiana jest już wystawiona na rynku' });
    }

    await db.insert(marketOffers).values({
      shiftId: shiftId,
      ownerId: user.id,
      date: shift.shiftDate,
      code: shift.shiftCode,
      status: 'open',
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd publikacji giełdowej: ' + err.message });
  }
});

// Shift Trade Market: Claim another user's shift
app.post('/api/market/offers/:id/claim', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const matchedOffers = await db.select().from(marketOffers).where(
      and(
        eq(marketOffers.id, id),
        eq(marketOffers.status, 'open')
      )
    );
    if (matchedOffers.length === 0) {
      return res.status(404).json({ error: 'Oferta giełdowa nie jest dłużej otwarta' });
    }
    
    const offer = matchedOffers[0];
    if (offer.ownerId === user.id) {
      return res.status(400).json({ error: 'Nie możesz odebrać własnej zmiany' });
    }

    // Ensure candidate does not already work on this date
    const candidateShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, user.id),
        eq(shifts.shiftDate, offer.date)
      )
    );
    if (candidateShifts.length > 0) {
      return res.status(400).json({ error: 'Przykro nam, w tym dniu pracujesz już na innej zmianie' });
    }

    await db.update(marketOffers).set({
      candidateId: user.id,
      status: 'requested'
    }).where(eq(marketOffers.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd rezerwacji giełdowej: ' + err.message });
  }
});

// Shift Trade Market: Cancel offer
app.post('/api/market/offers/:id/cancel', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const result = await db.update(marketOffers).set({ status: 'canceled' }).where(
      and(
        eq(marketOffers.id, id),
        eq(marketOffers.ownerId, user.id)
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd anulowania oferty: ' + err.message });
  }
});

// Shift Trade Market: Approve shift collection
app.post('/api/market/offers/:id/approve', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const matchedOffers = await db.select().from(marketOffers).where(
      and(
        eq(marketOffers.id, id),
        eq(marketOffers.ownerId, user.id)
      )
    );
    if (matchedOffers.length === 0) {
      return res.status(404).json({ error: 'Brak praw do zatwierdzenia tej umowy' });
    }

    const offer = matchedOffers[0];
    if (offer.status !== 'requested' || !offer.candidateId) {
      return res.status(400).json({ error: 'Brak zgłoszenia chętnych na tę zmianę' });
    }

    // Execute shift assignment mapping in shifts table
    await db.update(shifts).set({ userId: offer.candidateId }).where(eq(shifts.id, offer.shiftId));
    await db.update(marketOffers).set({ status: 'completed' }).where(eq(marketOffers.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zatwierdzenia umowy giełdowej: ' + err.message });
  }
});

app.post('/api/market/offers/:id/reject', authGuard, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    await db.update(marketOffers).set({
      status: 'open',
      candidateId: null
    }).where(
      and(
        eq(marketOffers.id, id),
        eq(marketOffers.ownerId, user.id)
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd odrzucenia oferty giełdowej: ' + err.message });
  }
});


// Statistics Calculations
app.get('/api/my-stats', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { month } = req.query; // YYYY-MM
    if (!month) {
      return res.status(400).json({ error: 'Brak miesiąca' });
    }

    const rate = user.hourlyRatePln || 28.10;
    const tax = user.taxPercent || 12.0;

    const monthPrefix = String(month);
    const userShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, user.id),
        like(shifts.shiftDate, `${monthPrefix}%`)
      )
    );

    // Partition worked vs scheduled
    const todayISO = new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' }).split('.').reverse().join('-');

    let hours_done = 0;
    let hours_left = 0;

    const daily = userShifts.map(s => {
      const isDone = s.shiftDate <= todayISO;
      const hrs = s.workedHours ?? s.scheduledHours;
      if (isDone) {
        hours_done += hrs;
      } else {
        hours_left += hrs;
      }
      return {
        date: s.shiftDate.substring(s.shiftDate.length - 2) + '.' + s.shiftDate.substring(5, 7),
        hours: hrs,
        done: isDone
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Custom extra events from control panel
    const customEventsList = await db.select().from(controlEvents).where(
      and(
        eq(controlEvents.userId, user.id),
        like(controlEvents.date, `${monthPrefix}%`)
      )
    );

    customEventsList.forEach(e => {
      if (e.kind === 'extra' && e.hours) {
        hours_done += e.hours;
      } else if (e.kind === 'late' && e.delayMinutes) {
        hours_done -= (e.delayMinutes / 60);
      } else if (e.kind === 'absence') {
        hours_done = Math.max(0, hours_done - 8);
      }
    });

    const total_net_done = hours_done * rate * (1 - tax / 100);
    const total_net_all = (hours_done + hours_left) * rate * (1 - tax / 100);

    res.json({
      hours_done: Number(hours_done.toFixed(2)),
      hours_left: Number(hours_left.toFixed(2)),
      net_done: Number(total_net_done.toFixed(2)),
      net_all: Number(total_net_all.toFixed(2)),
      daily
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd statystyk: ' + err.message });
  }
});

// User aggregated notes summaries for stats tab
app.get('/api/my-notes', authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { month } = req.query; // YYYY-MM
    const matchedShifts = await db.select().from(shifts).where(
      and(
        eq(shifts.userId, user.id),
        like(shifts.shiftDate, `${month}%`)
      )
    );
    const notesList = matchedShifts
      .filter(s => s.note)
      .map(s => ({ date: s.shiftDate, note: s.note }));
    res.json(notesList);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania notatek: ' + err.message });
  }
});


// Coordinator Reports endpoints
app.get('/api/coord-panel/report', authGuard, async (req: AuthRequest, res) => {
  try {
    const { lounge, shift_type, date } = req.query;
    if (!lounge || !shift_type || !date) {
      return res.status(400).json({ error: 'Wszystkie filtry raportu są wymagane' });
    }
    const rId = `${lounge}_${shift_type}_${date}`;
    const results = await db.select().from(coordinatorReports).where(eq(coordinatorReports.id, rId));
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.json({
        id: rId,
        lounge,
        shift_type,
        shift_date: date,
        bars: { bar0: '', bar1: '', bar2: '', 'bar-elita': '', zmiwak: '', barman: '' },
        times: { arrived: '', left: '' },
        notes: { past: '', missing: '', passengers: '' }
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd pobierania raportu koordynatora: ' + err.message });
  }
});

app.post('/api/coord-panel/report', authGuard, async (req: AuthRequest, res) => {
  try {
    const { lounge, shift_type, shift_date, bars, times, notes: reportNotes } = req.body;
    if (!lounge || !shift_type || !shift_date) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    const rId = `${lounge}_${shift_type}_${shift_date}`;

    const reportVal = {
      id: rId,
      lounge,
      shiftType: shift_type,
      shiftDate: shift_date,
      bars: bars || { bar0: '', bar1: '', bar2: '', 'bar-elita': '', zmiwak: '', barman: '' },
      times: times || { arrived: '', left: '' },
      notes: reportNotes || { past: '', missing: '', passengers: '' }
    };

    await db.insert(coordinatorReports).values(reportVal).onConflictDoUpdate({
      target: coordinatorReports.id,
      set: {
        bars: reportVal.bars,
        times: reportVal.times,
        notes: reportVal.notes
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu raportu koordynatora: ' + err.message });
  }
});


// Control view - Summary of events and attendance metrics
app.get('/api/control/summary', authGuard, async (req: AuthRequest, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    if (!month) {
      return res.status(400).json({ error: 'Parametr month jest wymagany' });
    }
    const monthStr = String(month);

    const monthEvents = await db.select().from(controlEvents).where(like(controlEvents.date, `${monthStr}%`));
    const allUsers = await db.select().from(users);
    const usersMap = new Map(allUsers.map(u => [u.id, u.fullName]));

    const eventsResult = monthEvents.map(e => {
      return {
        id: e.id,
        kind: e.kind,
        user: usersMap.get(e.userId) || 'Nieznany',
        date: e.date,
        reason: e.reason,
        delay_minutes: e.delayMinutes,
        hours: e.hours,
        time_from: e.timeFrom,
        time_to: e.timeTo
      };
    }).sort((a, b) => b.id - a.id); // Recent first

    // Staffing coverage count vs target 12
    const monthYear = monthStr.split('-');
    const y = Number(monthYear[0]), m = Number(monthYear[1]);
    const lastDay = new Date(y, m, 0).getDate();
    const staffing: any[] = [];

    const monthShifts = await db.select().from(shifts).where(like(shifts.shiftDate, `${monthStr}%`));

    for (let d = 1; d <= lastDay; d++) {
      const dStr = String(d).padStart(2, '0');
      const fullDate = `${monthStr}-${dStr}`;

      const activeShifts = monthShifts.filter(s => s.shiftDate === fullDate);
      const morningCount = activeShifts.filter(s => s.shiftCode.startsWith('1')).length;
      const eveningCount = activeShifts.filter(s => s.shiftCode.startsWith('2')).length;

      staffing.push({
        date: `${dStr}.${String(m).padStart(2, '0')}`,
        morning: morningCount,
        morning_delta: morningCount - 12,
        evening: eveningCount,
        evening_delta: eveningCount - 12
      });
    }

    res.json({ events: eventsResult, staffing });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd podsumowania kontroli: ' + err.message });
  }
});

// Control extra log details for deleted items
app.get('/api/control/deleted', authGuard, async (req: AuthRequest, res) => {
  try {
    const deleted = await db.select().from(deletedEvents);
    res.json(deleted);
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd logów usuwania: ' + err.message });
  }
});

app.get('/api/control/deleted/:event_id', authGuard, async (req: AuthRequest, res) => {
  try {
    const eventId = Number(req.params.event_id);
    const results = await db.select().from(deletedEvents).where(eq(deletedEvents.eventId, eventId));
    if (results.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono audytu usuwania' });
    }
    
    // Backward compatibility JSON mapping
    const log = results[0];
    res.json({
      id: log.id,
      event_id: log.eventId,
      user_name: log.userName,
      reason: log.reason,
      deleted_by_name: log.deletedByName,
      deleted_date: log.deletedDate,
      kind: log.kind,
      event_date: log.eventDate,
      time_from: log.timeFrom,
      time_to: log.timeTo,
      hours: log.hours
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd audytu usuwania: ' + err.message });
  }
});

// Log event: Lateness (lateness)
app.post('/api/control/late', authGuard, async (req: AuthRequest, res) => {
  try {
    const { user_id, date, reason, delay_minutes, time_from, time_to } = req.body;
    if (!user_id || !date || !delay_minutes) {
      return res.status(400).json({ error: 'Uzupełnij wymagane pola' });
    }

    await db.insert(controlEvents).values({
      userId: Number(user_id),
      date: String(date),
      kind: 'late',
      reason: String(reason || ''),
      delayMinutes: Number(delay_minutes),
      timeFrom: time_from || null,
      timeTo: time_to || null,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu spóźnienia: ' + err.message });
  }
});

// Log event: Extra Hours
app.post('/api/control/extra', authGuard, async (req: AuthRequest, res) => {
  try {
    const { user_id, date, reason, hours } = req.body;
    if (!user_id || !date || !hours) {
      return res.status(400).json({ error: 'Uzupełnij wymagane pola' });
    }

    await db.insert(controlEvents).values({
      userId: Number(user_id),
      date: String(date),
      kind: 'extra',
      reason: String(reason || ''),
      hours: Number(hours),
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu nadgodzin: ' + err.message });
  }
});

// Log event: Absence (absence)
app.post('/api/control/absence', authGuard, async (req: AuthRequest, res) => {
  try {
    const { user_id, date, reason } = req.body;
    if (!user_id || !date) {
      return res.status(400).json({ error: 'Uzupełnij wymagane pola' });
    }

    await db.insert(controlEvents).values({
      userId: Number(user_id),
      date: String(date),
      kind: 'absence',
      reason: String(reason || ''),
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd zapisu nieobecności: ' + err.message });
  }
});

// Log event: Custom Manual Shift Adds
app.post('/api/control/add-shift', authGuard, async (req: AuthRequest, res) => {
  try {
    const { user_id, date, reason, from, to } = req.body;
    if (!user_id || !date || !from || !to) {
      return res.status(400).json({ error: 'Uzupełnij wymagane pola' });
    }

    await db.insert(controlEvents).values({
      userId: Number(user_id),
      date: String(date),
      kind: 'manual_shift',
      reason: String(reason || ''),
      timeFrom: from,
      timeTo: to,
      createdAt: new Date().toISOString()
    });
    
    // Append a new custom Shift
    const parsedStartHours = Number(from.split(':')[0]);
    const isMorning = parsedStartHours < 12;

    await db.insert(shifts).values({
      userId: Number(user_id),
      shiftDate: String(date),
      shiftCode: isMorning ? '1/M' : '2/M',
      isBarToday: false,
      isCoordinator: false,
      isZmiwaka: false,
      scheduledHours: 8.0,
      startTime: from,
      endTime: to,
      note: `Dodana manualnie: ${reason}`
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd ręcznego dodawania zmiany: ' + err.message });
  }
});

// Delete controlled log with audit note
app.post('/api/control/delete', authGuard, async (req: AuthRequest, res) => {
  try {
    const { id, reason } = req.body;
    const user = req.user;

    if (!id || !reason) {
      return res.status(400).json({ error: 'Podaj powód usunięcia' });
    }

    const matchedEvents = await db.select().from(controlEvents).where(eq(controlEvents.id, Number(id)));
    if (matchedEvents.length === 0) {
      return res.status(404).json({ error: 'Nie odnaleziono zdarzenia' });
    }

    const event = matchedEvents[0];
    const resultsUsers = await db.select().from(users).where(eq(users.id, event.userId));
    const targetUserName = resultsUsers.length > 0 ? resultsUsers[0].fullName : 'Nieznany';

    // Append Audit log
    await db.insert(deletedEvents).values({
      eventId: event.id,
      userName: targetUserName,
      reason: String(reason),
      deletedByName: user.fullName,
      deletedDate: new Date().toISOString(),
      kind: event.kind,
      eventDate: event.date,
      timeFrom: event.timeFrom,
      timeTo: event.timeTo,
      hours: event.hours
    });

    await db.delete(controlEvents).where(eq(controlEvents.id, event.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd usuwania logu: ' + err.message });
  }
});


// Parser imports: Paste raw schedule text list
app.post('/api/upload-text', authGuard, async (req: AuthRequest, res) => {
  try {
    const { text, month, year } = req.body;
    if (!text || !month || !year) {
      return res.status(400).json({ error: 'Uzupełnij tekst, miesiąc i rok' });
    }

    const lines = String(text).split('\n');
    let importedCount = 0;
    const created_users: string[] = [];

    const allUsers = await db.select().from(users);
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      let name = parts[0];
      let shiftsStartIdx = 1;
      if (parts[1] && isNaN(Number(parts[1][0])) && !parts[1].startsWith('/') && !['1','2','B','Z','K','C'].includes(parts[1])) {
        name = parts[0] + ' ' + parts[1];
        shiftsStartIdx = 2;
      }

      let user = allUsers.find(u => u.fullName.toLowerCase() === name.toLowerCase());
      if (!user) {
        const insertUser = await db.insert(users).values({
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@grafik.pl`,
          passwordHash: hashPassword('user123'),
          fullName: name,
          role: 'user',
          hourlyRatePln: 28.10,
          taxPercent: 12.0
        }).returning();
        
        user = insertUser[0];
        allUsers.push(user);
        created_users.push(name);
      }

      const mStr = String(month).padStart(2, '0');
      let dayCursor = 1;

      for (let i = shiftsStartIdx; i < parts.length; i++) {
        const code = parts[i].trim();
        if (!code || code === '-' || code.toLowerCase() === 'wolne') {
          dayCursor++;
          continue;
        }

        const isMorning = code.startsWith('1');
        const isEvening = code.startsWith('2');
        if (!isMorning && !isEvening) {
          dayCursor++;
          continue;
        }

        const dayStr = String(dayCursor).padStart(2, '0');
        const isoDate = `${year}-${mStr}-${dayStr}`;

        const looksBar = /(^|[\/\s])B($|[\/\s])/i.test(code);
        const isZmiwak = code.toLowerCase().includes('z') || name.toLowerCase().includes('zmywak');
        const isCoord = code.toLowerCase().includes('k') || code.toLowerCase().includes('c');

        await db.insert(shifts).values({
          userId: user.id,
          shiftDate: isoDate,
          shiftCode: code,
          isBarToday: looksBar,
          isCoordinator: isCoord,
          isZmiwaka: isZmiwak,
          lounge: isMorning ? 'mazurek' : 'polonez',
          coordLounge: isCoord ? (isMorning ? 'mazurek' : 'polonez') : '',
          scheduledHours: 8.0
        });

        importedCount++;
        dayCursor++;
      }
    }

    res.json({ success: true, imported: importedCount, created_users });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd importu tekstu: ' + err.message });
  }
});

// Parser imports: Handle complex Excel sheets parsing directly using xlsx
app.post('/api/upload-xlsx', authGuard, express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  const monthHeader = req.headers['x-month'] || req.query.month;
  const yearHeader = req.headers['x-year'] || req.query.year;

  if (!monthHeader || !yearHeader) {
    return res.status(400).json({ error: 'Miesiąc i rok są nagłówkami obowiązkowymi: x-month i x-year' });
  }

  const month = Number(monthHeader);
  const year = Number(yearHeader);

  try {
    const workbook = XLSX.read(req.body, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    let importedCount = 0;
    const created_users: string[] = [];

    let dayColumnIndices: { [day: number]: number } = {};
    let namesColumnIndex = -1;
    let headerRowIdx = -1;

    for (let rIdx = 0; rIdx < Math.min(jsonData.length, 12); rIdx++) {
      const row = jsonData[rIdx];
      if (!row) continue;
      
      const nums = row.map((c, idx) => ({ val: Number(c), idx })).filter(o => !isNaN(o.val) && o.val >= 1 && o.val <= 31);
      if (nums.length >= 10) {
        headerRowIdx = rIdx;
        nums.forEach(o => {
          dayColumnIndices[o.val] = o.idx;
        });
        namesColumnIndex = row.findIndex(c => String(c).toLowerCase().includes('imię') || String(c).toLowerCase().includes('osoba') || String(c).toLowerCase().includes('pracownik'));
        if (namesColumnIndex === -1) {
          namesColumnIndex = 0;
        }
        break;
      }
    }

    if (headerRowIdx === -1) {
      return res.status(400).json({ error: 'Nie odnaleziono wiersza nagłówkowego z dniami miesiąca (1-31) w arkuszu.' });
    }

    const allUsers = await db.select().from(users);

    for (let rIdx = headerRowIdx + 1; rIdx < jsonData.length; rIdx++) {
      const row = jsonData[rIdx];
      if (!row || !row[namesColumnIndex]) continue;

      const nameRaw = String(row[namesColumnIndex]).trim();
      if (nameRaw.length < 3 || nameRaw.toLowerCase().includes('suma') || nameRaw.toLowerCase().includes('godzin')) continue;

      let user = allUsers.find(u => u.fullName.toLowerCase() === nameRaw.toLowerCase());
      if (!user) {
        const insertUser = await db.insert(users).values({
          email: `${nameRaw.toLowerCase().replace(/\s+/g, '.')}@grafik.pl`,
          passwordHash: hashPassword('user123'),
          fullName: nameRaw,
          role: 'user',
          hourlyRatePln: 28.10,
          taxPercent: 12.0
        }).returning();
        
        user = insertUser[0];
        allUsers.push(user);
        created_users.push(nameRaw);
      }

      const mStr = String(month).padStart(2, '0');
      for (let day = 1; day <= 31; day++) {
        const dCol = dayColumnIndices[day];
        if (dCol === undefined || row[dCol] === undefined) continue;

        const code = String(row[dCol]).trim();
        if (!code || code === '-' || code.toLowerCase() === 'wolne') continue;

        const isMorning = code.startsWith('1');
        const isEvening = code.startsWith('2');
        if (!isMorning && !isEvening) continue;

        const dayStr = String(day).padStart(2, '0');
        const isoDate = `${year}-${mStr}-${dayStr}`;

        const looksBar = /(^|[\/\s])B($|[\/\s])/i.test(code);
        const isZmiwak = code.toLowerCase().includes('z') || nameRaw.toLowerCase().includes('zmywak');
        const isCoord = code.toLowerCase().includes('k') || code.toLowerCase().includes('c');

        await db.insert(shifts).values({
          userId: user.id,
          shiftDate: isoDate,
          shiftCode: code,
          isBarToday: looksBar,
          isCoordinator: isCoord,
          isZmiwaka: isZmiwak,
          lounge: isMorning ? 'mazurek' : 'polonez',
          coordLounge: isCoord ? (isMorning ? 'mazurek' : 'polonez') : '',
          scheduledHours: 8.0
        });

        importedCount++;
      }
    }

    res.json({ success: true, imported: importedCount, created_users });
  } catch (err: any) {
    res.status(500).json({ error: 'Błąd przetwarzania Excel XLSX: ' + err.message });
  }
});


// Serve static assets and handle routing via Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express Backend] Server running on port ${PORT}`);
  });
}

startServer();
