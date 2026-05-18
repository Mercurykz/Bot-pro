require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const db = require('./database');
const crypto = require('crypto');

const XLSX = require('xlsx');
const app = express();

const MERCURY_THEME = `
:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --secondary: #8b5cf6;
  --secondary-hover: #7c3aed;
  --success: #10b981;
  --success-hover: #059669;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --warning: #f59e0b;
  --warning-hover: #d97706;
  --bg-dark: #070913;
  --bg-darker: #030408;
  --card-dark: rgba(17, 24, 39, 0.45);
  --border-color: rgba(255, 255, 255, 0.08);
  --text-light: #f8fafc;
  --text-muted: #94a3b8;
  --font-family: 'Poppins', sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  background: radial-gradient(circle at top right, #131735 0%, var(--bg-dark) 70%) !important;
  color: var(--text-light) !important;
  min-height: 100vh;
  display: flex;
  overflow-x: hidden;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-darker);
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Sidebar Design */
.sidebar {
  width: 280px;
  background: rgba(3, 4, 8, 0.85);
  backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-color);
  padding: 30px 20px;
  height: 100vh;
  position: fixed;
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.sidebar h2 {
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 20px;
}

.nav-menu {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-menu li {
  margin: 0 !important;
  background: transparent !important;
  padding: 0 !important;
  border-bottom: none !important;
}

.nav-menu a {
  display: flex !important;
  align-items: center;
  gap: 12px;
  padding: 14px 18px !important;
  color: var(--text-muted) !important;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-left: 3px solid transparent !important;
  background: transparent !important;
  border-bottom: none !important;
}

.nav-menu a:hover {
  background: rgba(255, 255, 255, 0.03) !important;
  color: var(--text-light) !important;
  border-left-color: var(--primary) !important;
  transform: translateX(4px);
}

.nav-menu a.active {
  background: rgba(99, 102, 241, 0.1) !important;
  color: var(--text-light) !important;
  border-left-color: var(--primary) !important;
  font-weight: 600;
}

/* User Info Sidebar */
.user-info {
  background: rgba(255, 255, 255, 0.02);
  padding: 15px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--primary);
  margin-bottom: 10px;
}

.user-info p {
  margin: 0 !important;
  color: var(--text-light) !important;
}

.user-info p:first-child {
  font-weight: 600;
  margin-bottom: 5px !important;
}

.user-info p:last-child {
  font-size: 11px;
  display: inline-block;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white !important;
  padding: 4px 12px;
  border-radius: 20px;
  margin-top: 5px !important;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Content Wrapper */
.content {
  margin-left: 280px;
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 20px;
  margin-bottom: 0 !important;
}

.topbar h1 {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffffff, #cbd5e1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.topbar p {
  color: var(--text-muted) !important;
  font-size: 14px;
  margin-top: 4px;
}

/* Cards Design with Glassmorphism */
.card {
  background: var(--card-dark) !important;
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color) !important;
  padding: 28px !important;
  border-radius: 16px !important;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 0 !important;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.6);
  border-color: rgba(255, 255, 255, 0.12) !important;
}

.card h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px !important;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Lists in Cards */
ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

li {
  padding: 16px 20px !important;
  background: rgba(5, 7, 12, 0.3) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 12px !important;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0 !important;
  transition: all 0.2s ease;
}

li:hover {
  background: rgba(5, 7, 12, 0.5) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

/* Inputs, Forms and Selects */
form {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin-bottom: 0 !important;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 0;
  width: 100%;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input[type="text"],
input[type="date"],
select {
  padding: 14px 18px !important;
  background: rgba(5, 7, 12, 0.5) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-light) !important;
  border-radius: 10px !important;
  font-family: var(--font-family) !important;
  font-size: 14px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

input[type="text"]:focus,
input[type="date"]:focus,
select:focus {
  outline: none !important;
  border-color: var(--primary) !important;
  background: rgba(5, 7, 12, 0.8) !important;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.18) !important;
}

/* Buttons Design */
button, .btn {
  padding: 14px 28px !important;
  background: linear-gradient(135deg, var(--primary), var(--secondary)) !important;
  color: white !important;
  border: none !important;
  border-radius: 10px !important;
  cursor: pointer !important;
  font-weight: 600 !important;
  font-family: var(--font-family) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-size: 14px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  text-decoration: none !important;
}

button:hover, .btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.35) !important;
}

button:active, .btn:active {
  transform: translateY(0) !important;
}

button.btn-danger, .btn-danger {
  background: linear-gradient(135deg, var(--danger), #be123c) !important;
}
button.btn-danger:hover, .btn-danger:hover {
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.35) !important;
}

.btn-export-all {
  background: linear-gradient(135deg, var(--success), #047857) !important;
}
.btn-export-all:hover {
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.35) !important;
}

/* Tables Design */
table {
  width: 100%;
  border-collapse: separate !important;
  border-spacing: 0 8px !important;
  margin-top: 10px !important;
}

thead {
  background: transparent !important;
}

th {
  padding: 12px 20px !important;
  text-align: left !important;
  font-weight: 600 !important;
  color: var(--text-muted) !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  border-bottom: none !important;
}

td {
  padding: 16px 20px !important;
  background: rgba(5, 7, 12, 0.25) !important;
  border-top: 1px solid var(--border-color) !important;
  border-bottom: 1px solid var(--border-color) !important;
  color: #e2e8f0 !important;
  font-size: 14px !important;
}

td:first-child {
  border-left: 1px solid var(--border-color) !important;
  border-top-left-radius: 12px !important;
  border-bottom-left-radius: 12px !important;
}

td:last-child {
  border-right: 1px solid var(--border-color) !important;
  border-top-right-radius: 12px !important;
  border-bottom-right-radius: 12px !important;
}

tbody tr {
  transition: all 0.2s ease !important;
}

tbody tr:hover td {
  background: rgba(5, 7, 12, 0.45) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

/* Action Cells inside tables */
.action-cell {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-cell a,
.action-cell button {
  padding: 8px 16px !important;
  font-size: 12px !important;
  white-space: nowrap;
}

/* Status Badges */
.status-badge {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  padding: 6px 14px !important;
  border-radius: 20px !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  border: none !important;
}

.status-active, .badge-active {
  background: rgba(16, 185, 129, 0.15) !important;
  color: var(--success) !important;
}

.status-inactive, .badge-inactive {
  background: rgba(148, 163, 184, 0.15) !important;
  color: var(--text-muted) !important;
}

/* Back Link */
.back-link {
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
  margin-top: 10px !important;
  color: var(--text-muted) !important;
  font-size: 14px !important;
  text-decoration: none !important;
  transition: all 0.2s ease;
}

.back-link:hover {
  color: var(--text-light) !important;
  transform: translateX(-4px);
}

/* Theme Toggle Btn (kept for compatibility) */
.theme-btn {
  display: none !important;
}

/* Modals */
.modal {
  backdrop-filter: blur(10px) !important;
  background: rgba(0, 0, 0, 0.6) !important;
}

.modal-content {
  background: rgba(15, 23, 42, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 20px !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7) !important;
}

/* Layout Grids */
.grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
  gap: 20px !important;
  margin-bottom: 0 !important;
}

.metric h2 {
  font-size: 42px !important;
  font-weight: 800 !important;
  background: linear-gradient(135deg, var(--primary), var(--secondary)) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

.chart-container {
  background: var(--card-dark) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 16px !important;
  padding: 24px !important;
}

/* Home Login Page Centering */
body.login-page {
  align-items: center !important;
  justify-content: center !important;
}

.container {
  text-align: center;
  max-width: 500px;
  padding: 40px 20px;
  margin: auto;
}

.logo {
  font-size: 60px;
  margin-bottom: 20px;
  display: inline-block;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 40px;
  text-align: left;
}

.feature {
  display: flex;
  gap: 12px;
  align-items: center;
}

.feature-icon {
  font-size: 24px;
}

.feature-text {
  font-size: 14px;
  color: #cbd5e1;
}

.footer {
  margin-top: 40px;
  font-size: 12px;
  color: #475569;
}

/* Dashboard Specifics */
.active-subject {
  background: rgba(99, 102, 241, 0.2) !important;
  border-left-color: var(--primary) !important;
  color: var(--text-light) !important;
}

/* Responsive */
@media (max-width: 768px) {
  body {
    flex-direction: column !important;
  }
  .sidebar {
    width: 100% !important;
    height: auto !important;
    position: static !important;
    border-right: none !important;
    border-bottom: 1px solid var(--border-color) !important;
    padding: 20px !important;
  }
  .content {
    margin-left: 0 !important;
    padding: 20px !important;
  }
  .topbar {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 15px !important;
  }
}
`;


let attendanceSchemaCache = null;
const rateLimitStore = new Map();

function getRequestId() {
  return crypto.randomUUID();
}

function logStructured(level, message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  const output = JSON.stringify(payload);
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const rec = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + windowMs;
  }
  rec.count += 1;
  rateLimitStore.set(key, rec);
  return {
    allowed: rec.count <= limit,
    remaining: Math.max(0, limit - rec.count),
    resetAt: rec.resetAt
  };
}

function normalizeFullName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metros
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getAttendanceSchema() {
  if (!db) return { hasClassSessionId: false, hasClassId: false };
  if (attendanceSchemaCache) return attendanceSchemaCache;

  const cols = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendances'
  `);
  const set = new Set(cols.rows.map(r => r.column_name));
  attendanceSchemaCache = {
    hasClassSessionId: set.has('class_session_id'),
    hasClassId: set.has('class_id')
  };

  return attendanceSchemaCache;
}

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cria tabelas básicas se não existirem
(async function initDb() {
  if (!db) {
    console.error('DB não conectado. Configure DATABASE_URL.');
    return;
  }
  try {
    // Testa conexão
    await db.query('SELECT 1');
    console.log('✅ DB conectado com sucesso.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'aluno'
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        granted_by TEXT REFERENCES users(id),
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, role)
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        UNIQUE (role, resource, action)
      );

      CREATE TABLE IF NOT EXISTS user_2fa (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        secret_encrypted TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        last_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT UNIQUE,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS academic_terms (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        active BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        professor_id TEXT REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id),
        course_id INTEGER REFERENCES courses(id),
        term_id INTEGER REFERENCES academic_terms(id),
        class_code TEXT,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES users(id),
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id),
        term_id INTEGER REFERENCES academic_terms(id),
        status TEXT NOT NULL DEFAULT 'ativa',
        enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (student_id, class_id)
      );

      CREATE TABLE IF NOT EXISTS class_sessions (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT true,
        geofence_latitude NUMERIC(10,7),
        geofence_longitude NUMERIC(10,7),
        geofence_radius_meters INTEGER,
        geofence_source TEXT
      );

      CREATE TABLE IF NOT EXISTS attendances (
        id SERIAL PRIMARY KEY,
        class_session_id INTEGER REFERENCES class_sessions(id),
        student_id TEXT REFERENCES users(id),
        student_name TEXT,
        login_at TIMESTAMPTZ NOT NULL,
        UNIQUE (class_session_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        professor_id TEXT NOT NULL REFERENCES users(id),
        student_name TEXT NOT NULL,
        student_id TEXT REFERENCES users(id),
        attendance_date TIMESTAMPTZ NOT NULL,
        attendance_time TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS call_history (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        session_id INTEGER REFERENCES class_sessions(id),
        professor_id TEXT NOT NULL REFERENCES users(id),
        session_name TEXT NOT NULL,
        session_date DATE NOT NULL,
        session_start_time TIMESTAMPTZ NOT NULL,
        session_end_time TIMESTAMPTZ,
        total_students INT DEFAULT 0,
        total_present INT DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attendance_policies (
        id SERIAL PRIMARY KEY,
        term_id INTEGER REFERENCES academic_terms(id),
        course_id INTEGER REFERENCES courses(id),
        min_frequency_percent NUMERIC(5,2) NOT NULL DEFAULT 75.00,
        late_tolerance_minutes INTEGER NOT NULL DEFAULT 10,
        checkin_window_minutes INTEGER NOT NULL DEFAULT 20,
        geofence_enabled BOOLEAN NOT NULL DEFAULT false,
        ip_lock_enabled BOOLEAN NOT NULL DEFAULT false,
        device_lock_enabled BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS academic_calendar (
        id SERIAL PRIMARY KEY,
        term_id INTEGER REFERENCES academic_terms(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        event_date DATE NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT,
        is_lective BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attendance_justifications (
        id SERIAL PRIMARY KEY,
        attendance_id INTEGER REFERENCES attendances(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        attachment_url TEXT,
        status TEXT NOT NULL DEFAULT 'pendente',
        reviewed_by TEXT REFERENCES users(id),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        old_data JSONB,
        new_data JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS consent_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        consent_type TEXT NOT NULL,
        consent_version TEXT NOT NULL,
        granted BOOLEAN NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attendance_qr_tokens (
        id BIGSERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_by TEXT REFERENCES users(id),
        used_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS security_events (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        event_type TEXT NOT NULL,
        ip_address TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notification_queue (
        id BIGSERIAL PRIMARY KEY,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS api_tokens (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        scopes TEXT[] NOT NULL DEFAULT '{}',
        created_by TEXT REFERENCES users(id),
        active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS integration_connectors (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        base_url TEXT,
        api_key_encrypted TEXT,
        active BOOLEAN NOT NULL DEFAULT false,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        id BIGSERIAL PRIMARY KEY,
        import_type TEXT NOT NULL,
        file_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        summary JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS backup_registry (
        id BIGSERIAL PRIMARY KEY,
        backup_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        size_bytes BIGINT,
        verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Garante colunas do novo modelo de sessão
    console.log('📋 Verificando migração de colunas...');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)`);
    console.log('  ✓ classes.subject_id OK');

    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id)`);
    console.log('  ✓ classes.course_id OK');

    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS term_id INTEGER REFERENCES academic_terms(id)`);
    console.log('  ✓ classes.term_id OK');

    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_code TEXT`);
    console.log('  ✓ classes.class_code OK');

    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS campus_latitude NUMERIC(10,7)`);
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS campus_longitude NUMERIC(10,7)`);
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS campus_radius_meters INTEGER NOT NULL DEFAULT 150`);
    console.log('  ✓ classes geofence (campus_latitude/campus_longitude/campus_radius_meters) OK');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false`);
    console.log('  ✓ classes.active OK');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    console.log('  ✓ classes.started_at OK');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ`);
    console.log('  ✓ classes.end_time OK');

    await db.query(`ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS geofence_latitude NUMERIC(10,7)`);
    await db.query(`ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS geofence_longitude NUMERIC(10,7)`);
    await db.query(`ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER`);
    await db.query(`ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS geofence_source TEXT`);
    console.log('  ✓ class_sessions geofence por sessão OK');
    
    // Verificar se a coluna class_session_id existe antes de tentar usá-la
    const classSessionIdExists = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendances' AND column_name = 'class_session_id'
    `);
    
    if (!classSessionIdExists.rowCount) {
      console.log('  ⚠ Criando attendances.class_session_id...');
      await db.query(`ALTER TABLE attendances ADD COLUMN class_session_id INTEGER REFERENCES class_sessions(id)`);
      console.log('  ✓ attendances.class_session_id criada');
    } else {
      console.log('  ✓ attendances.class_session_id já existe');
    }
    
    // Verificar se a coluna student_name existe
    const studentNameExists = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendances' AND column_name = 'student_name'
    `);
    
    if (!studentNameExists.rowCount) {
      console.log('  ⚠ Criando attendances.student_name...');
      await db.query(`ALTER TABLE attendances ADD COLUMN student_name TEXT`);
      console.log('  ✓ attendances.student_name criada');
    } else {
      console.log('  ✓ attendances.student_name já existe');
    }

    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'presente'`);
    console.log('  ✓ attendances.status OK');

    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0`);
    console.log('  ✓ attendances.late_minutes OK');

    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS ip_address TEXT`);
    console.log('  ✓ attendances.ip_address OK');

    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS device_id TEXT`);
    console.log('  ✓ attendances.device_id OK');

    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`);
    console.log('  ✓ attendances.latitude OK');

    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`);
    console.log('  ✓ attendances.longitude OK');
    
    // Criar índices para attendances
    await db.query(`ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_class_id_student_id_key`);
    await db.query(`DROP INDEX IF EXISTS attendances_class_id_student_id_key`);
    console.log('  ✓ legado attendances_class_id_student_id_key removido');

    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS attendances_class_session_student_idx ON attendances (class_session_id, student_id)`);
    console.log('  ✓ attendances_class_session_student_idx OK');
    
    await db.query(`DROP INDEX IF EXISTS attendances_class_session_name_idx`);
    await db.query(`CREATE INDEX IF NOT EXISTS attendances_class_session_name_idx ON attendances (class_session_id, student_name)`);
    console.log('  ✓ attendances_class_session_name_idx ajustado para não-único (suporta homônimos)');

    // Criar índices para attendance_records
    await db.query(`CREATE INDEX IF NOT EXISTS attendance_records_session_idx ON attendance_records(session_id)`);
    console.log('  ✓ attendance_records_session_idx OK');
    
    await db.query(`CREATE INDEX IF NOT EXISTS attendance_records_professor_idx ON attendance_records(professor_id)`);
    console.log('  ✓ attendance_records_professor_idx OK');
    
    await db.query(`CREATE INDEX IF NOT EXISTS attendance_records_date_idx ON attendance_records(attendance_date)`);
    console.log('  ✓ attendance_records_date_idx OK');

    // Criar índices para call_history
    await db.query(`CREATE INDEX IF NOT EXISTS call_history_class_idx ON call_history(class_id)`);
    console.log('  ✓ call_history_class_idx OK');
    
    await db.query(`CREATE INDEX IF NOT EXISTS call_history_professor_idx ON call_history(professor_id)`);
    console.log('  ✓ call_history_professor_idx OK');
    
    await db.query(`CREATE INDEX IF NOT EXISTS call_history_session_date_idx ON call_history(session_date)`);
    console.log('  ✓ call_history_session_date_idx OK');

    await db.query(`CREATE INDEX IF NOT EXISTS enrollments_student_idx ON enrollments(student_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS enrollments_class_idx ON enrollments(class_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS calendar_term_date_idx ON academic_calendar(term_id, event_date)`);
    await db.query(`CREATE INDEX IF NOT EXISTS justifications_student_idx ON attendance_justifications(student_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at)`);
    await db.query(`CREATE INDEX IF NOT EXISTS qr_tokens_session_idx ON attendance_qr_tokens(session_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS security_events_user_idx ON security_events(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS notification_queue_status_idx ON notification_queue(status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS import_jobs_status_idx ON import_jobs(status)`);
    console.log('  ✓ índices institucionais OK');

    await db.query(`
      INSERT INTO role_permissions (role, resource, action)
      VALUES
        ('admin', '*', '*'),
        ('coordenacao', 'dashboard', 'read'),
        ('coordenacao', 'classes', 'read'),
        ('coordenacao', 'attendances', 'read'),
        ('coordenacao', 'reports', 'read'),
        ('professor', 'classes', 'manage'),
        ('professor', 'attendances', 'manage'),
        ('monitor', 'attendances', 'assist'),
        ('aluno', 'attendances', 'self_checkin')
      ON CONFLICT (role, resource, action) DO NOTHING
    `);
    console.log('  ✓ role_permissions padrão OK');

    // Migração de compatibilidade: vincula presenças antigas (class_id) em sessões (class_session_id)
    const legacyClassIdExists = await db.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'attendances'
        AND column_name = 'class_id'
      LIMIT 1
    `);

    const legacyNullSession = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM attendances
      WHERE class_session_id IS NULL
    `);
    const legacyCount = Number(legacyNullSession.rows[0]?.total || 0);

    if (legacyCount > 0 && legacyClassIdExists.rowCount) {
      console.log(`  ⚠ Encontradas ${legacyCount} presenças antigas sem class_session_id. Iniciando backfill...`);

      await db.query('BEGIN');
      try {
        // 1) Vincula presenças a sessões já existentes no mesmo dia/classe
        const linkedExisting = await db.query(`
          UPDATE attendances a
          SET class_session_id = s.id
          FROM class_sessions s
          WHERE a.class_session_id IS NULL
            AND a.class_id IS NOT NULL
            AND s.class_id = a.class_id
            AND DATE(s.start_time) = DATE(a.login_at)
        `);

        // 2) Cria sessões faltantes por classe+dia para o que ainda estiver sem vínculo
        await db.query(`
          INSERT INTO class_sessions (class_id, start_time, end_time, active)
          SELECT m.class_id, m.day_start, m.day_start + INTERVAL '1 hour', false
          FROM (
            SELECT DISTINCT a.class_id, DATE(a.login_at)::timestamptz AS day_start
            FROM attendances a
            WHERE a.class_session_id IS NULL
              AND a.class_id IS NOT NULL
          ) m
          LEFT JOIN class_sessions s
            ON s.class_id = m.class_id
           AND DATE(s.start_time) = DATE(m.day_start)
          WHERE s.id IS NULL
        `);

        // 3) Vincula novamente após criação das sessões faltantes
        const linkedAfterInsert = await db.query(`
          UPDATE attendances a
          SET class_session_id = s.id
          FROM class_sessions s
          WHERE a.class_session_id IS NULL
            AND a.class_id IS NOT NULL
            AND s.class_id = a.class_id
            AND DATE(s.start_time) = DATE(a.login_at)
        `);

        await db.query('COMMIT');
        console.log(`  ✓ Backfill concluído. Presenças vinculadas: ${linkedExisting.rowCount + linkedAfterInsert.rowCount}`);
      } catch (backfillErr) {
        await db.query('ROLLBACK');
        console.error('  ❌ Falha no backfill de presenças antigas:', backfillErr.message);
      }
    } else if (legacyCount > 0) {
      console.log('  ⚠ Há presenças sem class_session_id, mas attendances.class_id não existe. Backfill ignorado.');
    }
    
    attendanceSchemaCache = null;
    const schema = await getAttendanceSchema();
    console.log(`✅ DB initialized com sucesso! attendances.class_session_id=${schema.hasClassSessionId} attendances.class_id=${schema.hasClassId}`);
  } catch (err) {
    console.error('❌ Erro ao inicializar DB:', err.message);
    console.error(err);
  }
})();

app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.disable('x-powered-by');

app.use((req, res, next) => {
  req.requestId = getRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logStructured('info', 'http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
      userId: req.user?.id || null,
      role: req.user?.role || null
    });
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'server', time: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  if (!db) return res.status(500).json({ status: 'error', detail: 'DB não conectado' });
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', detail: err.message });
  }
});


// Diagnóstico do banco (apenas admin)
app.get('/admin/db-check', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.json({ error: 'DB não conectado' });
  
  try {
    // Verificar colunas da tabela attendances
    const attendancesSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'attendances' 
      ORDER BY ordinal_position
    `);
    
    // Verificar índices
    const indexes = await db.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'attendances'
    `);
    
    // Contar registros
    const counts = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM subjects) as subjects,
        (SELECT COUNT(*) FROM classes) as classes,
        (SELECT COUNT(*) FROM class_sessions) as sessions,
        (SELECT COUNT(*) FROM attendances) as attendances
    `);
    
    res.json({
      status: 'ok',
      attendances_columns: attendancesSchema.rows,
      indexes: indexes.rows,
      counts: counts.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      code: err.code,
      details: err.detail
    });
  }
});

app.get('/admin/institucional-status', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  try {
    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM academic_terms) AS terms,
        (SELECT COUNT(*) FROM courses) AS courses,
        (SELECT COUNT(*) FROM enrollments) AS enrollments,
        (SELECT COUNT(*) FROM attendance_policies) AS attendance_policies,
        (SELECT COUNT(*) FROM academic_calendar) AS calendar_events,
        (SELECT COUNT(*) FROM attendance_justifications) AS justifications,
        (SELECT COUNT(*) FROM audit_logs) AS audit_logs,
        (SELECT COUNT(*) FROM consent_logs) AS consent_logs,
        (SELECT COUNT(*) FROM attendance_qr_tokens) AS qr_tokens,
        (SELECT COUNT(*) FROM notification_queue) AS notifications,
        (SELECT COUNT(*) FROM api_tokens) AS api_tokens,
        (SELECT COUNT(*) FROM integration_connectors) AS integrations,
        (SELECT COUNT(*) FROM import_jobs) AS import_jobs,
        (SELECT COUNT(*) FROM backup_registry) AS backups
    `);

    res.json({
      status: 'ok',
      modules: counts.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function requireApiToken(req, res, next) {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  const rawToken = (req.headers['x-api-token'] || '').toString().trim();
  if (!rawToken) return res.status(401).json({ error: 'Token ausente' });

  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRes = await db.query(
      `SELECT id, name, scopes
       FROM api_tokens
       WHERE token_hash = $1
         AND active = true
       LIMIT 1`,
      [tokenHash]
    );
    if (!tokenRes.rowCount) return res.status(401).json({ error: 'Token inválido' });

    await db.query(`UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1`, [tokenRes.rows[0].id]);
    req.apiClient = tokenRes.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/bi/attendance-summary', requireApiToken, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;
    const summary = await db.query(
      `SELECT
         c.id AS class_id,
         c.name AS class_name,
         COUNT(a.id)::int AS total_checkins,
         COUNT(DISTINCT a.student_id)::int AS unique_students,
         COUNT(*) FILTER (WHERE a.status = 'atrasado')::int AS total_late,
         ROUND(
           (COUNT(*) FILTER (WHERE a.status = 'presente')::numeric / NULLIF(COUNT(a.id), 0)) * 100,
           2
         ) AS present_rate_percent
       FROM classes c
       LEFT JOIN attendances a ON a.class_id = c.id
       WHERE ($1::date IS NULL OR DATE(a.login_at) >= $1::date)
         AND ($2::date IS NULL OR DATE(a.login_at) <= $2::date)
       GROUP BY c.id, c.name
       ORDER BY c.name ASC`,
      [from, to]
    );

    res.json({
      status: 'ok',
      from,
      to,
      rows: summary.rows,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HOME
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mercury Class | Sistema de Presença Discord</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>
  <div class="container">
    <div class="logo">✨</div>
    <h1>Mercury Class</h1>
    <p>Sistema inteligente de presença integrado com Discord</p>
    
    <div class="features">
      <div class="feature">
        <div class="feature-icon">📊</div>
        <div class="feature-text">Controle de presença em tempo real</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🏫</div>
        <div class="feature-text">Gerenciamento de múltiplas salas</div>
      </div>
      <div class="feature">
        <div class="feature-icon">📋</div>
        <div class="feature-text">Relatórios e exportação em CSV/XLSX</div>
      </div>
      <div class="feature">
        <div class="feature-icon">👥</div>
        <div class="feature-text">Integração com Discord</div>
      </div>
    </div>

    <a href="/login" class="btn">Entrar com Discord</a>

    <div class="footer">
      <p>© 2026 Mercury Class. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
  `);
});

console.log('DATABASE_URL', process.env.DATABASE_URL);
console.log('NODE_ENV', process.env.NODE_ENV);
console.log('CALLBACK_URL', process.env.CALLBACK_URL);
console.log('CLIENT_ID defined:', !!process.env.CLIENT_ID);
console.log('CLIENT_SECRET defined:', !!process.env.CLIENT_SECRET);

// LOGIN
app.get('/login', passport.authenticate('discord'));


// CALLBACK
app.get('/callback',
  passport.authenticate('discord', { failureRedirect: '/', failureMessage: true }),
  (req, res) => {
    console.log('✅ OAuth callback sucesso:', req.user?.id);
    res.redirect('/dashboard');
  }
);

// Fallback para /auth/discord/callback (common convention)
app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/', failureMessage: true }),
  (req, res) => {
    console.log('✅ OAuth callback sucesso (alt route):', req.user?.id);
    res.redirect('/dashboard');
  }
);


// DASHBOARD
app.get('/dashboard', async (req, res) => {
  if (!req.user) return res.redirect('/');
  if (!db) return res.send('Erro: DB não conectado.');

  try {
    if (req.user.role === 'aluno') {
      const subjects = await db.query(`
        WITH student_classes AS (
          SELECT DISTINCT cs.class_id
          FROM attendances a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          WHERE a.student_id = $1
        ),
        subject_sessions AS (
          SELECT c.subject_id, COALESCE(s.name, 'Sem matéria') AS subject_name, cs.id AS session_id
          FROM class_sessions cs
          JOIN classes c ON c.id = cs.class_id
          LEFT JOIN subjects s ON s.id = c.subject_id
          WHERE cs.class_id IN (SELECT class_id FROM student_classes)
        ),
        student_presence AS (
          SELECT c.subject_id, a.class_session_id
          FROM attendances a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          JOIN classes c ON c.id = cs.class_id
          WHERE a.student_id = $1
        )
        SELECT
          ss.subject_id,
          ss.subject_name,
          COUNT(DISTINCT ss.session_id)::int AS total_sessions,
          COUNT(DISTINCT sp.class_session_id)::int AS attended_sessions
        FROM subject_sessions ss
        LEFT JOIN student_presence sp
          ON sp.class_session_id = ss.session_id
         AND sp.subject_id IS NOT DISTINCT FROM ss.subject_id
        GROUP BY ss.subject_id, ss.subject_name
        ORDER BY ss.subject_name ASC
      `, [req.user.id]);

      const subjectRows = subjects.rows.map(r => ({
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        total_sessions: Number(r.total_sessions) || 0,
        attended_sessions: Number(r.attended_sessions) || 0
      }));

      const totalAttendedRes = await db.query(
        `SELECT COUNT(DISTINCT class_session_id)::int AS total FROM attendances WHERE student_id = $1`,
        [req.user.id]
      );
      const totalAttended = Number(totalAttendedRes.rows[0]?.total || 0);
      const totalAvailable = subjectRows.reduce((sum, s) => sum + s.total_sessions, 0);
      const overallFrequency = totalAvailable > 0 ? ((totalAttended / totalAvailable) * 100) : 0;

      const selectedParam = typeof req.query.subject === 'string' ? req.query.subject : '';
      const selectedRow = subjectRows.find(s => {
        const key = s.subject_id === null ? 'none' : String(s.subject_id);
        return key === selectedParam;
      }) || subjectRows[0] || null;

      let historySql = `
        SELECT
          COALESCE(s.name, 'Sem matéria') AS subject_name,
          c.name AS class_name,
          cs.start_time,
          a.login_at
        FROM attendances a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN classes c ON c.id = cs.class_id
        LEFT JOIN subjects s ON s.id = c.subject_id
        WHERE a.student_id = $1
      `;
      const historyParams = [req.user.id];
      if (selectedRow) {
        if (selectedRow.subject_id === null) {
          historySql += ` AND c.subject_id IS NULL`;
        } else {
          historyParams.push(selectedRow.subject_id);
          historySql += ` AND c.subject_id = $2`;
        }
      }
      historySql += ` ORDER BY cs.start_time DESC LIMIT 50`;
      const history = await db.query(historySql, historyParams);

      const subjectMenu = subjectRows.map(s => {
        const key = s.subject_id === null ? 'none' : String(s.subject_id);
        const pct = s.total_sessions > 0 ? ((s.attended_sessions / s.total_sessions) * 100).toFixed(1) : '0.0';
        const isActive = selectedRow && ((selectedRow.subject_id === null && s.subject_id === null) || selectedRow.subject_id === s.subject_id);
        return `<li>
          <a href="/dashboard?subject=${key}" class="${isActive ? 'active-subject' : ''}">
            <span>📘 ${s.subject_name}</span>
            <strong>${pct}%</strong>
          </a>
        </li>`;
      }).join('');

      const selectedPct = selectedRow && selectedRow.total_sessions > 0
        ? ((selectedRow.attended_sessions / selectedRow.total_sessions) * 100).toFixed(1)
        : '0.0';

      const historyList = history.rows.map(h => `<li>
        <div>
          <strong>${h.class_name}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">📘 ${h.subject_name}</div>
        </div>
        <div style="text-align:right; color: var(--text-muted); font-size: 12px;">
          <div>🕒 Aula: ${new Date(h.start_time).toLocaleString('pt-BR')}</div>
          <div>✅ Presença: ${new Date(h.login_at).toLocaleString('pt-BR')}</div>
        </div>
      </li>`).join('');

      return res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mercury Class | Minha Frequência</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>${MERCURY_THEME}</style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Mercury Class</h2>
    <div class="user-info">
      <p>${req.user.username}</p>
      <p>👨‍🎓 Aluno</p>
    </div>
    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Minha Frequência</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>

  <div class="content">
    <div class="topbar">
      <div>
        <h1>Minha Frequência por Matéria</h1>
        <p style="color:var(--text-muted); margin-top:4px;">Acompanhe seu desempenho em cada disciplina.</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="grid">
      <div class="card metric">
        <h2>${totalAttended}</h2>
        <p>Chamadas com Presença</p>
      </div>
      <div class="card metric">
        <h2>${overallFrequency.toFixed(1)}%</h2>
        <p>Frequência Geral</p>
      </div>
      <div class="card metric">
        <h2>${selectedPct}%</h2>
        <p>Frequência na Matéria Selecionada</p>
      </div>
    </div>

    <div class="layout">
      <div class="card" id="materias">
        <h2 style="margin-bottom:14px;">📚 Menu de Matérias</h2>
        <ul class="subject-menu">${subjectMenu || '<li style="color:var(--text-muted);">Sem matérias com presença ainda.</li>'}</ul>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <h2 style="margin-bottom:10px;">📈 Frequência por Matéria</h2>
          <canvas id="freqChart" height="130"></canvas>
        </div>
        <div class="card">
          <h2 style="margin-bottom:10px;">🧾 Histórico (${selectedRow ? selectedRow.subject_name : 'Sem matéria'})</h2>
          <ul class="history">${historyList || '<li style="color:var(--text-muted);">Nenhuma presença registrada para esta matéria.</li>'}</ul>
        </div>
      </div>
    </div>
  </div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}

const labels = ${JSON.stringify(subjectRows.map(s => s.subject_name))};
const dataPct = ${JSON.stringify(subjectRows.map(s => s.total_sessions > 0 ? Number(((s.attended_sessions / s.total_sessions) * 100).toFixed(1)) : 0))};

const ctx = document.getElementById('freqChart');
if (ctx) {
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frequência (%)',
        data: dataPct,
        borderRadius: 8,
        backgroundColor: '#6366f1'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}
</script>
</body>
</html>
      `);
    }

    // 📊 gráfico
    const result = await db.query(`
  SELECT 
    DATE(login_at) as dia,
    COUNT(*) as total
  FROM attendances
  GROUP BY DATE(login_at)
  ORDER BY dia ASC
`);

    const rows = result.rows;
    const labels = rows.map(r => r.dia);
    const valores = rows.map(r => r.total);

    // 📈 total geral
    const totalResult = await db.query(`
      SELECT COUNT(*) as total FROM attendances
    `);

    const totalGeral = totalResult.rows[0] || { total: 0 };

    let professorClasses = null;
    let activeRooms = new Set();

    if (req.user.role === 'professor') {
      professorClasses = await db.query(`SELECT id, name FROM classes WHERE professor_id = $1 ORDER BY id DESC`, [req.user.id]);
      const activeSessions = await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      activeRooms = new Set(activeSessions.rows.map(r => r.class_id));
    }

    const classesDisponiveis = req.user.role === 'aluno' ? await db.query(
      `SELECT c.id, c.name, u.username as professor_name, MAX(s.start_time) as last_start_time
       FROM class_sessions s
       JOIN classes c ON c.id = s.class_id
       JOIN users u ON u.id = c.professor_id
       WHERE s.active = true
       GROUP BY c.id, c.name, u.username
       ORDER BY last_start_time DESC`)
      : null;

    const classesHtml = req.user.role === 'professor'
      ? professorClasses.rows.map(c => `<li><a href="/class/${c.id}">${c.name}</a> - ${activeRooms.has(c.id) ? 'Em chamada' : 'Disponível'}</li>`).join('')
      : (classesDisponiveis?.rows || []).map(c => `<li>${c.name} (Prof. ${c.professor_name}) <a href="/class/${c.id}">Entrar</a></li>`).join('');

    const classForm = req.user.role === 'professor'
      ? `<form method="POST" action="/class/start"> <input name="name" required placeholder="Nome da sala" /> <button>Iniciar chamada</button> </form>`
      : '';

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mercury Class | Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>${MERCURY_THEME}</style>
</head>

<body>

<div class="sidebar">
  <h2>✨ Mercury Class</h2>
  
  <div class="user-info">
    <p>${req.user.username}</p>
    <p>${req.user.role === 'professor' ? '👨‍🏫 Professor' : '👨‍🎓 Aluno'}</p>
  </div>

  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout" class="logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">

  <div class="topbar">
    <div>
      <h1>Bem-vindo, ${req.user.username}!</h1>
      <p style="color: var(--text-muted); margin-top: 5px;">Gerencie suas salas e presenças facilmente</p>
    </div>
    <button class="theme-btn" onclick="toggleTheme()">🌙</button>
  </div>

  <div class="grid">

    <div class="card metric">
      <h2>${totalGeral.total}</h2>
      <p>Total de Presenças</p>
    </div>

    <div class="card metric">
      <h2>${valores[valores.length - 1] || 0}</h2>
      <p>Presenças Hoje</p>
    </div>

  </div>

  <div class="card">
    <h2>🏫 Gerenciamento de Sala</h2>
    ${classForm}
    <ul>${classesHtml || '<li style="color: var(--text-muted);">Nenhuma sala disponível</li>'}</ul>
  </div>

  <div class="chart-container">
    <h2>📈 Presenças por dia</h2>
    <canvas id="chart"></canvas>
  </div>

</div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}

if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}

const ctx = document.getElementById('chart');
if (ctx) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ${JSON.stringify(labels)},
      datasets: [{
        label: 'Presenças',
        data: ${JSON.stringify(valores)},
        tension: 0.4,
        fill: true,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          ticks: {
            color: 'var(--text-muted)'
          },
          grid: {
            color: 'var(--border-color)'
          }
        },
        x: {
          ticks: {
            color: 'var(--text-muted)'
          },
          grid: {
            color: 'var(--border-color)'
          }
        }
      }
    }
  });
}
</script>

</body>
</html>
    `);

  } catch (err) {
    console.error('Erro no dashboard:', err.message);
    console.error(err.stack);
    res.send('Erro no dashboard: ' + err.message);
  }
});


app.get('/minhas-materias', ensureAuthenticated, ensureAluno, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');

  try {
    const subjects = await db.query(`
      WITH student_classes AS (
        SELECT DISTINCT cs.class_id
        FROM attendances a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        WHERE a.student_id = $1
      ),
      subject_sessions AS (
        SELECT c.subject_id, COALESCE(s.name, 'Sem matéria') AS subject_name, cs.id AS session_id
        FROM class_sessions cs
        JOIN classes c ON c.id = cs.class_id
        LEFT JOIN subjects s ON s.id = c.subject_id
        WHERE cs.class_id IN (SELECT class_id FROM student_classes)
      ),
      student_presence AS (
        SELECT c.subject_id, a.class_session_id
        FROM attendances a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN classes c ON c.id = cs.class_id
        WHERE a.student_id = $1
      )
      SELECT
        ss.subject_id,
        ss.subject_name,
        COUNT(DISTINCT ss.session_id)::int AS total_sessions,
        COUNT(DISTINCT sp.class_session_id)::int AS attended_sessions
      FROM subject_sessions ss
      LEFT JOIN student_presence sp
        ON sp.class_session_id = ss.session_id
       AND sp.subject_id IS NOT DISTINCT FROM ss.subject_id
      GROUP BY ss.subject_id, ss.subject_name
      ORDER BY ss.subject_name ASC
    `, [req.user.id]);

    const subjectRows = subjects.rows.map(r => ({
      subject_id: r.subject_id,
      subject_name: r.subject_name,
      total_sessions: Number(r.total_sessions) || 0,
      attended_sessions: Number(r.attended_sessions) || 0
    }));

    const selectedParam = typeof req.query.subject === 'string' ? req.query.subject : '';
    const selectedRow = subjectRows.find(s => {
      const key = s.subject_id === null ? 'none' : String(s.subject_id);
      return key === selectedParam;
    }) || subjectRows[0] || null;

    let historySql = `
      SELECT
        COALESCE(s.name, 'Sem matéria') AS subject_name,
        c.name AS class_name,
        cs.start_time,
        a.login_at
      FROM attendances a
      JOIN class_sessions cs ON cs.id = a.class_session_id
      JOIN classes c ON c.id = cs.class_id
      LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE a.student_id = $1
    `;
    const historyParams = [req.user.id];
    if (selectedRow) {
      if (selectedRow.subject_id === null) {
        historySql += ` AND c.subject_id IS NULL`;
      } else {
        historyParams.push(selectedRow.subject_id);
        historySql += ` AND c.subject_id = $2`;
      }
    }
    historySql += ` ORDER BY cs.start_time DESC LIMIT 50`;
    const history = await db.query(historySql, historyParams);

    const subjectCards = subjectRows.map(s => {
      const key = s.subject_id === null ? 'none' : String(s.subject_id);
      const isActive = selectedRow && ((selectedRow.subject_id === null && s.subject_id === null) || selectedRow.subject_id === s.subject_id);
      return `<a href="/minhas-materias?subject=${key}" class="subject-card ${isActive ? 'active' : ''}">
        <div class="subject-title">📘 ${s.subject_name}</div>
        <div class="subject-count">${s.attended_sessions} presença${s.attended_sessions === 1 ? '' : 's'}</div>
        <div class="subject-sub">${s.total_sessions} aula${s.total_sessions === 1 ? '' : 's'} registrada${s.total_sessions === 1 ? '' : 's'}</div>
      </a>`;
    }).join('');

    const historyList = history.rows.map(h => `<li>
      <div><strong>${h.class_name}</strong><div style="color:#94a3b8;font-size:12px;">📘 ${h.subject_name}</div></div>
      <div style="color:#94a3b8;font-size:12px;text-align:right;">${new Date(h.login_at).toLocaleString('pt-BR')}</div>
    </li>`).join('');

    const totalAttended = subjectRows.reduce((sum, s) => sum + s.attended_sessions, 0);
    const totalSessions = subjectRows.reduce((sum, s) => sum + s.total_sessions, 0);

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mercury Class | Minhas Matérias</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Mercury Class</h2>

    <div class="user-info">
      <p>${req.user.username}</p>
      <p>👨‍🎓 Aluno</p>
    </div>

    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Dashboard</a></li>
      <li><a href="/minhas-materias" class="active-link">📚 Minhas Matérias</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>

  <div class="content">
    <div class="topbar">
      <div>
        <h1>Minha Frequência por Matéria</h1>
        <p style="color:var(--text-muted); margin-top:4px;">Acompanhe suas presenças por disciplina.</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="grid">
      <div class="card metric"><h2>${totalAttended}</h2><p>Presenças registradas</p></div>
      <div class="card metric"><h2>${totalSessions}</h2><p>Aulas registradas</p></div>
      <div class="card metric"><h2>${subjectRows.length}</h2><p>Matérias no histórico</p></div>
    </div>

    <div class="layout">
      <div class="card">
        <h2 style="margin-bottom:12px;">📚 Matérias</h2>
        <div class="subject-grid">${subjectCards || '<div style="color:var(--text-muted);">Sem matérias ainda.</div>'}</div>
      </div>

      <div class="card">
        <h2 style="margin-bottom:12px;">🧾 Presenças ${selectedRow ? `- ${selectedRow.subject_name}` : ''}</h2>
        <ul class="history-list">${historyList || '<li style="color:var(--text-muted);">Nenhuma presença para esta matéria.</li>'}</ul>
      </div>
    </div>
  </div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}
</script>
</body>
</html>
    `);
  } catch (err) {
    console.error('Erro em /minhas-materias:', err);
    res.status(500).send('Erro ao carregar matérias do aluno');
  }
});


// GUILD (AGORA COM POSTGRES)
app.get('/guild/:id', async (req, res) => {
  if (!req.user) return res.redirect('/');
  if (!db) return res.send('Erro: DB não conectado.');

  const guildId = req.params.id;

  try {
    const result = await db.query(
      `SELECT * FROM presencas WHERE guild_id = $1`,
      [guildId]
    );

    const rows = result.rows;

    const lista = rows.map(r => `
      <li>
        <span><strong>${r.username}</strong></span>
        <span style="color: var(--text-muted);">${new Date(r.data).toLocaleString('pt-BR')}</span>
      </li>
    `).join('');

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mercury Class | Guild ${guildId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Mercury Class</h2>
    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Dashboard</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      ${req.user.role === 'aluno' ? '<li><a href="/minhas-materias">📚 Minhas Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
      ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>
  <div class="content">
    <div class="topbar">
      <div>
        <h1>📊 Presenças da Guild ${guildId}</h1>
        <p style="color:var(--text-muted);margin-top:4px;">Total de registros: ${rows.length}</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="card">
      <ul>${lista || '<li style="color:var(--text-muted);">Nenhum registro encontrado</li>'}</ul>
    </div>
  </div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}
</script>
</body>
</html>
    `);

  } catch (err) {
    console.error(err);
    res.send('Erro ao carregar guild');
  }
});

// helpers
function ensureAuthenticated(req, res, next) {
  if (!req.user) return res.redirect('/');
  return next();
}

function ensureProfessor(req, res, next) {
  const allowed = new Set(['professor', 'admin', 'coordenacao', 'monitor']);
  if (!req.user || !allowed.has(req.user.role)) {
    return res.status(403).send('Acesso negado: apenas equipe acadêmica.');
  }
  return next();
}

function ensureAluno(req, res, next) {
  if (!req.user || req.user.role !== 'aluno') {
    return res.status(403).send('Acesso negado: apenas alunos.');
  }
  return next();
}

function ensureAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).send('Acesso negado: apenas administradores.');
  }
  return next();
}

// endpoints de gestão de sala
app.get('/profile', ensureAuthenticated, async (req, res) => {
  res.redirect('/dashboard');
});

app.post('/class/start', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const { name, subject_id } = req.body;
  if (!name) return res.status(400).send('Nome da sala (classe) obrigatório');

  try {
    // Opcional: verificar se subject_id é válido
    let subjectId = subject_id ? parseInt(subject_id, 10) : null;
    if (subjectId) {
      const subjectRes = await db.query('SELECT id FROM subjects WHERE id = $1', [subjectId]);
      if (!subjectRes.rowCount) subjectId = null;
    }

    const result = await db.query(
      `INSERT INTO classes (professor_id, name, subject_id, active, started_at) VALUES ($1, $2, $3, false, NOW()) RETURNING id`,
      [req.user.id, name, subjectId]
    );
    const classId = result.rows[0].id;
    
    // Cria uma sessão automática para a sala recém-criada
    await db.query(
      `INSERT INTO class_sessions (class_id, start_time, active) VALUES ($1, NOW(), true)`,
      [classId]
    );
    
    console.log(`[DEBUG] Sala criada: ${name} (ID: ${classId}) com sessão automática`);
    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar sala');
  }
});

app.get('/subjects', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    const subjectsRes = await db.query('SELECT * FROM subjects ORDER BY name');
    const rows = subjectsRes.rows.map(s => `<li>
      <span>📘 ${s.name}</span>
      ${req.user.role === 'admin' ? `<form method="POST" action="/admin/subject/${s.id}/delete" style="display:inline;margin:0;" onsubmit="return confirm('Tem certeza que deseja excluir esta matéria?');"><button type="submit" class="btn-delete">🗑️ Excluir</button></form>` : ''}
    </li>`).join('');
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mercury Class | Matérias</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Mercury Class</h2>
    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Dashboard</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      ${req.user.role === 'aluno' ? '<li><a href="/minhas-materias">📚 Minhas Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
      ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>
  <div class="content">
    <div class="topbar">
      <div>
        <h1>📚 Matérias</h1>
        <p style="color:var(--text-muted);margin-top:4px;">Gerencie as matérias da plataforma.</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="card">
      <h2 style="margin-bottom:12px;">Lista de matérias</h2>
      <ul>${rows || '<li style="color:var(--text-muted);">Nenhuma matéria cadastrada</li>'}</ul>
    </div>

    ${(req.user.role === 'professor' || req.user.role === 'admin') ? `
    <div class="card">
      <h2 style="margin-bottom:12px;">➕ Nova matéria</h2>
      <form method="POST" action="/subject/create">
        <input name="name" placeholder="Nome da matéria" required />
        <button type="submit">Criar Matéria</button>
      </form>
    </div>
    ` : ''}
  </div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}
</script>
</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar matérias');
  }
});

app.post('/subject/create', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const { name } = req.body;
  if (!name) return res.status(400).send('Nome da matéria obrigatório');
  try {
    await db.query('INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name.trim()]);
    res.redirect('/subjects');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar matéria');
  }
});

app.post('/class/:id/start-session', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  const useProfessorLocation = req.body?.useProfessorLocation === 'on' || req.body?.useProfessorLocation === 'true' || req.body?.useProfessorLocation === '1';
  const professorLat = req.body?.professorLatitude !== undefined && req.body?.professorLatitude !== ''
    ? Number(req.body.professorLatitude)
    : null;
  const professorLon = req.body?.professorLongitude !== undefined && req.body?.professorLongitude !== ''
    ? Number(req.body.professorLongitude)
    : null;

  try {
    const classData = req.user.role === 'admin'
      ? await db.query(`SELECT * FROM classes WHERE id = $1`, [classId])
      : await db.query(`SELECT * FROM classes WHERE id = $1 AND professor_id = $2`, [classId, req.user.id]);
    if (!classData.rowCount) return res.status(404).send('Sala não encontrada');

    const cls = classData.rows[0];
    const defaultRadius = Number(cls.campus_radius_meters || 150);
    const hasProfessorGeo = professorLat !== null && professorLon !== null && !Number.isNaN(professorLat) && !Number.isNaN(professorLon);
    if (useProfessorLocation && !hasProfessorGeo) {
      return res.status(400).send('Não foi possível capturar a localização do professor para esta chamada.');
    }

    const canUseProfessorGeo = useProfessorLocation && hasProfessorGeo;

    const geofenceLat = canUseProfessorGeo ? professorLat : (cls.campus_latitude !== null ? Number(cls.campus_latitude) : null);
    const geofenceLon = canUseProfessorGeo ? professorLon : (cls.campus_longitude !== null ? Number(cls.campus_longitude) : null);
    const geofenceSource = canUseProfessorGeo ? 'professor_live' : 'class_default';

    await db.query(`UPDATE class_sessions SET active = false, end_time = NOW() WHERE class_id = $1 AND active = true`, [classId]);
    await db.query(
      `INSERT INTO class_sessions (class_id, start_time, active, geofence_latitude, geofence_longitude, geofence_radius_meters, geofence_source)
       VALUES ($1, NOW(), true, $2, $3, $4, $5)`,
      [classId, geofenceLat, geofenceLon, defaultRadius, geofenceSource]
    );
    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao iniciar sessão de chamada');
  }
});

app.post('/class/:id/session/:sessionId/qr', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ success: false, error: 'DB não conectado' });
  const classId = Number(req.params.id);
  const sessionId = Number(req.params.sessionId);
  const expiresInMinutes = Math.min(30, Math.max(1, Number(req.body?.expiresInMinutes || 5)));

  try {
    const canManageAnyClass = req.user.role === 'admin' || req.user.role === 'coordenacao';
    const classResult = canManageAnyClass
      ? await db.query(`SELECT id FROM classes WHERE id = $1`, [classId])
      : await db.query(`SELECT id FROM classes WHERE id = $1 AND professor_id = $2`, [classId, req.user.id]);

    if (!classResult.rowCount) {
      return res.status(403).json({ success: false, error: 'Sem permissão para gerar QR desta sala.' });
    }

    const sessionResult = await db.query(
      `SELECT id FROM class_sessions WHERE id = $1 AND class_id = $2 LIMIT 1`,
      [sessionId, classId]
    );
    if (!sessionResult.rowCount) {
      return res.status(404).json({ success: false, error: 'Sessão não encontrada.' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await db.query(
      `INSERT INTO attendance_qr_tokens (session_id, token, expires_at, created_by)
       VALUES ($1, $2, NOW() + ($3::text || ' minutes')::interval, $4)`,
      [sessionId, tokenHash, String(expiresInMinutes), req.user.id]
    );

    res.json({
      success: true,
      qr_token: token,
      expires_in_minutes: expiresInMinutes,
      expires_at: new Date(Date.now() + expiresInMinutes * 60000).toISOString()
    });
  } catch (err) {
    console.error('Erro ao gerar QR dinâmico:', err);
    res.status(500).json({ success: false, error: 'Erro ao gerar QR dinâmico' });
  }
});

app.post('/class/:id/join', ensureAuthenticated, ensureAluno, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.json({ success: false, error: 'DB não conectado' });
  const classId = req.params.id;
  const fullName = req.body.fullName?.trim();
  const qrToken = (req.body.qrToken || req.body.qr_token || '').trim();
  const deviceId = (req.body.deviceId || req.headers['x-device-id'] || '').toString().slice(0, 120);
  const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const latitudeRaw = req.body.latitude;
  const longitudeRaw = req.body.longitude;
  const latitude = latitudeRaw !== undefined && latitudeRaw !== '' ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw !== undefined && longitudeRaw !== '' ? Number(longitudeRaw) : null;

  const rl = checkRateLimit(`join:${classId}:${ipAddress}`, 12, 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: 'rate_limited',
      message: 'Muitas tentativas. Aguarde alguns segundos e tente novamente.'
    });
  }

  if (!fullName) {
    return res.status(400).json({ success: false, error: 'Informe seu nome completo para registrar presença.' });
  }

  try {
    const schema = await getAttendanceSchema();
    const sessionRes = await db.query(
      `SELECT id, start_time, geofence_latitude, geofence_longitude, geofence_radius_meters, geofence_source
       FROM class_sessions
       WHERE class_id = $1 AND active = true
       LIMIT 1`,
      [classId]
    );
    if (!sessionRes.rowCount) return res.status(400).json({ success: false, error: 'Não há chamada ativa para esta sala.' });

    const sessionId = sessionRes.rows[0].id;
    const sessionStartTime = sessionRes.rows[0].start_time;
    const sessionGeofenceLat = sessionRes.rows[0].geofence_latitude !== null ? Number(sessionRes.rows[0].geofence_latitude) : null;
    const sessionGeofenceLon = sessionRes.rows[0].geofence_longitude !== null ? Number(sessionRes.rows[0].geofence_longitude) : null;
    const sessionGeofenceRadius = sessionRes.rows[0].geofence_radius_meters !== null ? Number(sessionRes.rows[0].geofence_radius_meters) : null;

    const classMeta = await db.query(
      `SELECT term_id, course_id, campus_latitude, campus_longitude, campus_radius_meters
       FROM classes
       WHERE id = $1
       LIMIT 1`,
      [classId]
    );

    let policy = null;
    if (classMeta.rowCount) {
      const termId = classMeta.rows[0].term_id;
      const courseId = classMeta.rows[0].course_id;
      const classCampusLatitude = classMeta.rows[0].campus_latitude !== null ? Number(classMeta.rows[0].campus_latitude) : null;
      const classCampusLongitude = classMeta.rows[0].campus_longitude !== null ? Number(classMeta.rows[0].campus_longitude) : null;
      const classCampusRadiusMeters = Number(classMeta.rows[0].campus_radius_meters || 150);
      const campusLatitude = sessionGeofenceLat !== null ? sessionGeofenceLat : classCampusLatitude;
      const campusLongitude = sessionGeofenceLon !== null ? sessionGeofenceLon : classCampusLongitude;
      const campusRadiusMeters = sessionGeofenceRadius !== null ? sessionGeofenceRadius : classCampusRadiusMeters;
      const policyRes = await db.query(
        `SELECT *
         FROM attendance_policies
         WHERE ($1::int IS NULL OR term_id = $1)
           AND ($2::int IS NULL OR course_id = $2)
         ORDER BY id DESC
         LIMIT 1`,
        [termId, courseId]
      );
      policy = policyRes.rows[0] || null;

      const geofenceEnabled = Boolean(policy?.geofence_enabled);
      if (geofenceEnabled && campusLatitude !== null && campusLongitude !== null) {
        if (latitude === null || longitude === null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
          return res.status(400).json({
            success: false,
            error: 'geofence_location_required',
            message: 'Localização necessária para registrar presença nesta sala.'
          });
        }

        const dist = distanceMeters(latitude, longitude, campusLatitude, campusLongitude);
        if (dist > campusRadiusMeters) {
          return res.status(400).json({
            success: false,
            error: 'geofence_out_of_range',
            message: `Você está fora do raio permitido da sala (${Math.round(dist)}m de distância, limite ${campusRadiusMeters}m).`
          });
        }
      }
    }

    const nowMs = Date.now();
    const startMs = new Date(sessionStartTime).getTime();
    const lateMinutes = Math.max(0, Math.floor((nowMs - startMs) / 60000));
    const lateTolerance = Number(policy?.late_tolerance_minutes ?? 10);
    const checkinWindow = Number(policy?.checkin_window_minutes ?? 20);

    if (checkinWindow > 0 && lateMinutes > checkinWindow) {
      return res.status(400).json({
        success: false,
        error: 'checkin_window_expired',
        message: `Janela de check-in encerrada (${checkinWindow} min).`
      });
    }

    const activeQrRes = await db.query(
      `SELECT id, token, expires_at
       FROM attendance_qr_tokens
       WHERE session_id = $1
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    let activeQrId = null;
    if (activeQrRes.rowCount) {
      activeQrId = activeQrRes.rows[0].id;
      const expectedTokenHash = activeQrRes.rows[0].token;
      const providedHash = qrToken ? crypto.createHash('sha256').update(qrToken).digest('hex') : '';
      if (!providedHash || providedHash !== expectedTokenHash) {
        return res.status(400).json({
          success: false,
          error: 'invalid_qr',
          message: 'QR da chamada inválido ou expirado.'
        });
      }
    }

    let existing;
    if (schema.hasClassSessionId) {
      existing = await db.query(
        `SELECT student_name FROM attendances WHERE class_session_id = $1 AND student_id = $2`,
        [sessionId, req.user.id]
      );
    } else if (schema.hasClassId) {
      existing = await db.query(
        `SELECT student_name FROM attendances WHERE class_id = $1 AND student_id = $2`,
        [classId, req.user.id]
      );
    } else {
      return res.status(500).json({ success: false, error: 'Tabela attendances sem colunas de vínculo de sessão/sala.' });
    }

    if (existing.rowCount) {
      const currentName = existing.rows[0].student_name || '';
      const currentNorm = normalizeFullName(currentName);
      const incomingNorm = normalizeFullName(fullName);

      if (currentNorm !== incomingNorm) {
        // Mesmo aluno (student_id), permitindo atualizar o nome digitado no mesmo check-in
        if (schema.hasClassSessionId) {
          await db.query(
            `UPDATE attendances
             SET student_name = $1
             WHERE class_session_id = $2 AND student_id = $3`,
            [fullName, sessionId, req.user.id]
          );
        } else if (schema.hasClassId) {
          await db.query(
            `UPDATE attendances
             SET student_name = $1
             WHERE class_id = $2 AND student_id = $3`,
            [fullName, classId, req.user.id]
          );
        }
        return res.json({
          success: true,
          message: `Presença já registrada. Nome atualizado para '${fullName}'.`
        });
      }
      return res.json({ success: true, message: 'Presença já registrada' });
    }

    if (activeQrId) {
      await db.query(`UPDATE attendance_qr_tokens SET used_count = used_count + 1 WHERE id = $1`, [activeQrId]);
    }

    const attendanceStatus = lateMinutes > lateTolerance ? 'atrasado' : 'presente';

    if (schema.hasClassSessionId && schema.hasClassId) {
      await db.query(
        `INSERT INTO attendances (class_session_id, class_id, student_id, student_name, login_at, status, late_minutes, ip_address, device_id, latitude, longitude) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10)`,
        [sessionId, classId, req.user.id, fullName, attendanceStatus, lateMinutes, ipAddress, deviceId, latitude, longitude]
      );
    } else if (schema.hasClassSessionId) {
      await db.query(
        `INSERT INTO attendances (class_session_id, student_id, student_name, login_at, status, late_minutes, ip_address, device_id, latitude, longitude) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
        [sessionId, req.user.id, fullName, attendanceStatus, lateMinutes, ipAddress, deviceId, latitude, longitude]
      );
    } else {
      await db.query(
        `INSERT INTO attendances (class_id, student_id, student_name, login_at, status, late_minutes, ip_address, device_id, latitude, longitude) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
        [classId, req.user.id, fullName, attendanceStatus, lateMinutes, ipAddress, deviceId, latitude, longitude]
      );
    }

    res.json({ success: true, message: 'Presença registrada com sucesso', status: attendanceStatus, late_minutes: lateMinutes });
  } catch (err) {
    console.error(err);
    // Erro de chave duplicada (outro aluno com o mesmo nome)
    if (err.code === '23505' && err.constraint === 'attendances_class_session_name_idx') {
      return res.status(400).json({
        success: false,
        error: 'duplicate_name',
        message: 'Este nome já foi registrado nesta chamada. Você não pode se registrar com um nome já utilizado.'
      });
    }
    if (err.code === '23505' && err.constraint === 'attendances_class_id_student_id_key') {
      return res.status(400).json({
        success: false,
        error: 'legacy_unique_constraint',
        message: 'Presença bloqueada por regra legada. Reinicie o servidor para aplicar a migração automática.'
      });
    }
    res.status(500).json({ success: false, error: 'Erro ao registrar presença' });
  }
});

app.get('/class/:id', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    const schema = await getAttendanceSchema();
    const classRes = await db.query(`
      SELECT c.*, u.username AS professor_name, s.name AS subject_name
      FROM classes c
      JOIN users u ON c.professor_id = u.id
      LEFT JOIN subjects s ON c.subject_id = s.id
      WHERE c.id = $1
    `, [classId]);
    if (!classRes.rowCount) return res.status(404).send('Classe não encontrada');

    const classData = classRes.rows[0];

    const sessionRes = await db.query(`SELECT * FROM class_sessions WHERE class_id = $1 ORDER BY start_time DESC LIMIT 1`, [classId]);
    const activeSession = sessionRes.rowCount ? sessionRes.rows[0] : null;

    let members = [];
    if (activeSession) {
      const membersQuery = schema.hasClassSessionId
        ? {
            sql: `SELECT a.id, a.class_session_id, a.student_id, a.student_name, a.login_at, a.status, u.username FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
            params: [activeSession.id]
          }
        : {
            sql: `SELECT a.id, NULL::INTEGER AS class_session_id, a.student_id, a.student_name, a.login_at, a.status, u.username FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.login_at ASC`,
            params: [classId]
          };

      const attendances = await db.query(membersQuery.sql, membersQuery.params);
      members = attendances.rows;
    }

    // timeline de sessões do professor
    const timelineJoin = schema.hasClassSessionId ? 'a.class_session_id = s.id' : 'a.class_id = s.class_id';
    const timeline = await db.query(
      `SELECT s.id, s.start_time, s.end_time, s.active, COUNT(a.id) AS total_presencas
       FROM class_sessions s
       LEFT JOIN attendances a ON ${timelineJoin}
       WHERE s.class_id = $1
       GROUP BY s.id, s.start_time, s.end_time, s.active
       ORDER BY s.start_time DESC`,
       [classId]
    );

    const statusBadge = activeSession && activeSession.active 
      ? '<span class="status-badge active">🔴 Em Chamada</span>' 
      : '<span class="status-badge inactive">⚫ Inativa</span>';

    const attendanceList = members.map(m => {
      const status = m.status || 'presente';
      const badge = status === 'atrasado'
        ? '<span class="status-badge" style="background:#7c2d12;color:#fdba74;border:1px solid #9a3412;">🟠 Atrasado</span>'
        : status === 'justificada'
          ? '<span class="status-badge" style="background:#1e3a8a;color:#93c5fd;border:1px solid #1d4ed8;">🔵 Justificada</span>'
          : status === 'falta'
            ? '<span class="status-badge" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c;">🔴 Falta</span>'
            : '<span class="status-badge" style="background:#14532d;color:#86efac;border:1px solid #15803d;">🟢 Presente</span>';

      return `<li>
      <div>
        <strong>${m.student_name || m.username}</strong>
        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ ${new Date(m.login_at).toLocaleString('pt-BR')}</div>
      </div>
      ${badge}
    </li>`;
    }).join('');

    const timelineList = timeline.rows.map(t => `<li>
      <div>
        <strong>${new Date(t.start_time).toLocaleString('pt-BR')}</strong>
        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👥 ${t.total_presencas} alunos</div>
      </div>
      <span class="status-badge ${t.active ? 'active' : 'inactive'}">${t.active ? '🟢 Ativa' : '⚫ Encerrada'}</span>
    </li>`).join('');

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mercury Class | Sala - ${classData.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Mercury Class</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="header">
    <h1>${classData.name}</h1>
    <div class="header-meta">
      <span>👨‍🏫 Prof. ${classData.professor_name}</span>
      <span>📘 ${classData.subject_name || 'Sem matéria'}</span>
      <span>${statusBadge}</span>
    </div>
  </div>

  ${(req.user.role === 'professor' || req.user.role === 'admin') && (!activeSession || !activeSession.active) ? `<div class="card">
    <form id="start-session-form" method="POST" action="/class/${classId}/start-session">
      <label style="display:flex; align-items:center; gap:8px; text-transform:none; letter-spacing:0; color:var(--text-light); font-weight:500; margin-bottom:8px;">
        <input id="use-professor-location" name="useProfessorLocation" type="checkbox" style="width:18px; height:18px;" />
        Usar minha localização atual como base desta aula (laboratório/sala variável)
      </label>
      <button type="submit">▶️ Iniciar Chamada</button>
    </form>
  </div>` : ''}

  <div class="card">
    <h2>👥 Presenças Atuais</h2>
    ${members.length > 0 ? `<ul id="attendance-list">${attendanceList}</ul>` : '<div class="empty-state"><p>Nenhuma presença registrada ainda</p></div>'}
  </div>

  ${req.user.role === 'aluno' && activeSession && activeSession.active ? `<div class="card">
    <h2>✍️ Registrar Presença</h2>
    <form id="attendance-form">
      <label>
        Nome Completo
        <input id="fullName-input" name="fullName" required placeholder="Digite seu nome completo" />
      </label>
      <button type="submit">Registrar</button>
    </form>
  </div>` : ''}

  ${(req.user.role === 'professor' || req.user.role === 'admin') && activeSession && activeSession.active ? `<div class="card">
    <h2>📝 Marcar Presença por Nome</h2>
    <form id="mark-attendance-form">
      <label>
        Nome do Aluno
        <input id="mark-fullName-input" name="fullName" required placeholder="Digite o nome completo do aluno" />
      </label>
      <button type="submit">Marcar</button>
    </form>
    <form method="POST" action="/class/${classId}/end" style="margin-top: 12px;">
      <button type="submit" class="btn-danger">🛑 Encerrar Chamada</button>
    </form>
  </div>` : ''}

  ${timeline.rows.length > 0 ? `<div class="card">
    <h2>📊 Histórico de Sessões</h2>
    <ul>${timelineList}</ul>
  </div>` : ''}

  <a href="/classes" class="back-link">← Voltar às Salas</a>
</div>

<script>
  // Modal de erro de presença
  const modal = document.createElement('div');
  modal.id = 'attendance-error-modal';
  modal.style.cssText = \`
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    justify-content: center;
    align-items: center;
  \`;
  modal.innerHTML = \`
    <div style="background: var(--bg-secondary); padding: 32px; border-radius: 12px; max-width: 400px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
      <div id="modal-icon" style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h2 id="modal-title" style="margin: 0 0 12px 0; color: var(--text-primary);">Erro</h2>
      <p id="modal-message" style="margin: 0 0 24px 0; color: var(--text-secondary); line-height: 1.5;"></p>
      <button onclick="document.getElementById('attendance-error-modal').style.display = 'none'" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Entendi</button>
    </div>
  \`;
  document.body.appendChild(modal);

  function showErrorModal(title, message, icon = '⚠️') {
    document.getElementById('modal-icon').textContent = icon;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    modal.style.display = 'flex';
  }

  // Fechar modal ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  const startSessionForm = document.getElementById('start-session-form');
  if (startSessionForm) {
    startSessionForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const useProfessorLocation = document.getElementById('use-professor-location')?.checked;

      const ensureHidden = (name, value) => {
        let input = startSessionForm.querySelector('input[name="' + name + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          startSessionForm.appendChild(input);
        }
        input.value = value;
      };

      ensureHidden('useProfessorLocation', useProfessorLocation ? '1' : '0');

      if (useProfessorLocation && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 7000,
              maximumAge: 0
            });
          });
          ensureHidden('professorLatitude', String(pos.coords.latitude));
          ensureHidden('professorLongitude', String(pos.coords.longitude));
        } catch (_) {
          showErrorModal(
            '📍 Localização não capturada',
            'Ative a localização para usar sua posição como base da chamada, ou desmarque a opção e tente novamente.',
            '📍'
          );
          return;
        }
      }

      startSessionForm.submit();
    });
  }

  // Formulário de presença via AJAX
  const attendanceForm = document.getElementById('attendance-form');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fullName = document.getElementById('fullName-input').value;
      let latitude = '';
      let longitude = '';

      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          latitude = String(pos.coords.latitude);
          longitude = String(pos.coords.longitude);
        } catch (_) {
          // geolocalização é opcional no frontend; backend decide se exige
        }
      }
      
      try {
        const bodyParams = new URLSearchParams();
        bodyParams.set('fullName', fullName);
        if (latitude && longitude) {
          bodyParams.set('latitude', latitude);
          bodyParams.set('longitude', longitude);
        }

        const response = await fetch('/class/${classId}/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyParams.toString()
        });
        
        const data = await response.json();
        
        if (data.success) {
          showErrorModal('✅ Sucesso!', 'Sua presença foi registrada com sucesso!', '✅');
          attendanceForm.reset();
          refreshAttendance();
          setTimeout(() => { modal.style.display = 'none'; }, 2000);
        } else {
          if (data.error === 'duplicate_name') {
            showErrorModal(
              '❌ Nome Duplicado',
              'Este nome já foi registrado nesta chamada. Você não pode se registrar com um nome já utilizado por outro aluno.',
              '❌'
            );
          } else if (data.error === 'already_registered') {
            showErrorModal(
              '⚠️ Já Registrado',
              data.message,
              '⚠️'
            );
          } else if (data.error === 'geofence_location_required') {
            showErrorModal(
              '📍 Localização Necessária',
              data.message || 'Ative a localização do navegador para registrar presença nesta sala.',
              '📍'
            );
          } else if (data.error === 'geofence_out_of_range') {
            showErrorModal(
              '🚫 Fora da Área Permitida',
              data.message || 'Você está fora do raio permitido para esta chamada.',
              '🚫'
            );
          } else {
            showErrorModal('❌ Erro', data.message || data.error || 'Erro ao registrar presença', '❌');
          }
        }
      } catch (err) {
        console.error(err);
        showErrorModal('❌ Erro', 'Erro ao registrar presença. Tente novamente.', '❌');
      }
    });
  }

  // Formulário do professor para marcar presença
  const markAttendanceForm = document.getElementById('mark-attendance-form');
  if (markAttendanceForm) {
    markAttendanceForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fullName = document.getElementById('mark-fullName-input').value;
      
      try {
        const response = await fetch('/class/${classId}/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'fullName=' + encodeURIComponent(fullName)
        });
        
        const data = await response.json();
        
        if (data.success) {
          showErrorModal('✅ Presença Marcada!', 'Presença do aluno foi registrada com sucesso!', '✅');
          markAttendanceForm.reset();
          refreshAttendance();
          setTimeout(() => { modal.style.display = 'none'; }, 2000);
        } else {
          if (data.error === 'duplicate_name') {
            showErrorModal(
              '⚠️ Já Registrado',
              'Este aluno já teve sua presença marcada nesta chamada.',
              '⚠️'
            );
          } else {
            showErrorModal('❌ Erro', data.error || data.message || 'Erro ao marcar presença', '❌');
          }
        }
      } catch (err) {
        console.error(err);
        showErrorModal('❌ Erro', 'Erro ao marcar presença. Tente novamente.', '❌');
      }
    });
  }

  async function refreshAttendance() {
    try {
      const res = await fetch('/class/${classId}/attendees');
      if (!res.ok) return;
      const data = await res.json();
      const list = document.getElementById('attendance-list');
      if (!data.length) {
        list.parentElement.innerHTML = '<div class="empty-state"><p>Nenhuma presença registrada ainda</p></div>';
        return;
      }
      list.innerHTML = data.map(item => \`<li>
        <div>
          <strong>\${item.student_name || item.username}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ \${new Date(item.login_at).toLocaleString('pt-BR')}</div>
        </div>
      </li>\`).join('');
    } catch (e) {
      console.error('Erro ao atualizar:', e);
    }
  }
  
  if (document.getElementById('attendance-list')) {
    setInterval(refreshAttendance, 5000);
  }
</script>

</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar classe');
  }
});

app.get('/class/:id/attendees', ensureAuthenticated, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  const classId = req.params.id;
  try {
    const schema = await getAttendanceSchema();
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.json([]);

    const sessionId = sessionRes.rows[0].id;
    const attendeesQuery = schema.hasClassSessionId
      ? {
          sql: `SELECT u.username, a.student_name, a.login_at, a.status FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
          params: [sessionId]
        }
      : {
          sql: `SELECT u.username, a.student_name, a.login_at, a.status FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.login_at ASC`,
          params: [classId]
        };

    const attendances = await db.query(attendeesQuery.sql, attendeesQuery.params);
    console.log('[DEBUG] /class/:id/attendees - sessionId:', sessionId, 'rowCount:', attendances.rowCount);
    res.json(attendances.rows);
  } catch (err) {
    console.error('[ERROR] /class/:id/attendees:', err.message);
    res.status(500).json({ error: 'Falha ao buscar participantes', details: err.message });
  }
});

app.get('/historico-chamadas', ensureAuthenticated, ensureProfessor, (req, res) => {
  res.send('<'+'!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mercury Class | Histórico de Chamadas</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet"><style>${MERCURY_THEME}</style></head><body><div class="sidebar"><h2>✨ Mercury Class</h2><ul class="nav-menu"><li><a href="/dashboard">📊 Dashboard</a></li><li><a href="/classes">🏫 Salas de Aula</a></li><li><a href="/subjects">📚 Matérias</a></li><li><a href="/chamadas">📋 Chamadas</a></li>' + (req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : '') + '<li><a href="/logout">🚪 Sair</a></li></ul></div><div class="content"><div class="topbar"><h1>📚 Histórico de Chamadas</h1></div><div class="card"><h3 style="margin-bottom: 20px;">Filtrar Chamadas</h3><div class="filter-group"><div><label for="filterDate">Data</label><input id="filterDate" type="date" /></div><button onclick="loadHistorico()">🔍 Filtrar</button><button onclick="clearFilters()" style="background: var(--border-color);">✕ Limpar</button><a href="/api/chamadas/historico/exportar-todas" class="btn btn-export-all">📥 Baixar Todas as Chamadas</a></div></div><div class="card"><div id="historico-container"><div class="loading">Carregando histórico...</div></div></div><a href="/dashboard" class="back-link">← Voltar ao Dashboard</a></div><div id="detailsModal" class="modal"><div class="modal-content"><span class="close" onclick="closeModal()">&times;</span><h2 style="margin-bottom: 20px;">Detalhes da Chamada</h2><div id="modalBody"></div></div></div><script>let currentData = []; async function loadHistorico() { const container = document.getElementById("historico-container"); container.innerHTML = "<div class=\"loading\">Carregando histórico...</div>"; try { const resp = await fetch("/api/chamadas/historico"); if (!resp.ok) throw new Error("Falha ao carregar"); const data = await resp.json(); currentData = data; renderTable(data); } catch (err) { console.error("Erro:", err); container.innerHTML = "<div class=\"result-empty\"><p>❌ Erro ao carregar histórico</p></div>"; } } function renderTable(data) { const container = document.getElementById("historico-container"); if (!data || !data.length) { container.innerHTML = "<div class=\"result-empty\"><p>📭 Nenhuma chamada encontrada.</p></div>"; return; } let html = "<table><thead><tr><th>Sala</th><th>Data</th><th>Horário</th><th>Presentes</th><th>Ações</th></tr></thead><tbody>"; html += data.map(call => { const date = new Date(call.session_date).toLocaleDateString("pt-BR"); const time = new Date(call.session_start_time).toLocaleTimeString("pt-BR"); const count = call.total_present + "/" + call.total_students; return "<tr><td><strong>" + call.class_name + "</strong></td><td>" + date + "</td><td>" + time + "</td><td>" + count + "</td><td><div class=\"action-cell\"><button onclick=\"showDetails(" + call.id + ")\" style=\"padding: 6px 12px; font-size: 12px;\">📋 Ver</button><a href=\"/api/chamadas/historico/" + call.id + "/exportar?format=xlsx\" style=\"padding: 6px 12px; font-size: 12px; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 4px; text-decoration: none;\">📥 Excel</a><button onclick=\"deleteCall(" + call.id + ")\" class=\"btn-danger\" style=\"padding: 6px 12px; font-size: 12px;\">🗑️ Excluir</button></div></td></tr>"; }).join(""); html += "</tbody></table>"; container.innerHTML = html; } async function showDetails(callId) { try { const resp = await fetch("/api/chamadas/historico/" + callId + "/detalhes"); if (!resp.ok) throw new Error("Falha ao carregar detalhes"); const data = await resp.json(); const call = data.call; const records = data.records; const modal = document.getElementById("detailsModal"); const modalBody = document.getElementById("modalBody"); let html = "<div><p><strong>Sala:</strong> " + call.class_name + "</p><p><strong>Data:</strong> " + new Date(call.session_date).toLocaleDateString("pt-BR") + "</p><p><strong>Horário:</strong> " + new Date(call.session_start_time).toLocaleTimeString("pt-BR") + "</p><p><strong>Presentes:</strong> " + call.total_present + " / " + call.total_students + "</p><hr style=\"border: none; border-top: 1px solid var(--border-color); margin: 20px 0;\"><h4 style=\"margin-bottom: 12px;\">Alunos Presentes:</h4><table style=\"width: 100%; font-size: 13px;\"><thead><tr style=\"border-bottom: 2px solid var(--border-color);\"><th style=\"text-align: left; padding: 8px;\">Nome</th><th style=\"text-align: left; padding: 8px;\">Horário</th></tr></thead><tbody>"; if (records && records.length) { html += records.map(r => "<tr style=\"border-bottom: 1px solid var(--border-color);\"><td style=\"padding: 8px;\">" + r.student_name + "</td><td style=\"padding: 8px;\">" + new Date(r.attendance_time).toLocaleTimeString("pt-BR") + "</td></tr>").join(""); } else { html += "<tr><td colspan=\"2\" style=\"padding: 8px; text-align: center; color: var(--text-muted);\">Sem registros</td></tr>"; } html += "</tbody></table></div>"; modalBody.innerHTML = html; modal.style.display = "block"; } catch (err) { console.error("Erro:", err); alert("Erro ao carregar detalhes"); } } async function deleteCall(callId) { if (!confirm("Deseja realmente excluir este histórico de chamada?")) return; try { const resp = await fetch("/api/chamadas/historico/" + callId, { method: "DELETE" }); if (resp.ok) { alert("Chamada excluída com sucesso"); loadHistorico(); } else { alert("Erro ao excluir chamada"); } } catch (err) { console.error("Erro:", err); alert("Erro ao excluir chamada"); } } function closeModal() { document.getElementById("detailsModal").style.display = "none"; } function clearFilters() { document.getElementById("filterDate").value = ""; loadHistorico(); } window.addEventListener("click", (e) => { const modal = document.getElementById("detailsModal"); if (e.target === modal) modal.style.display = "none"; }); window.addEventListener("DOMContentLoaded", loadHistorico);</script></body></html>');
});

app.get('/chamadas', ensureAuthenticated, ensureProfessor, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mercury Class | Chamadas</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Mercury Class</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/subjects">📚 Matérias</a></li>
    <li><a href="/chamadas">📋 Chamadas</a></li>
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>📋 Gerenciamento de Chamadas</h1>
  </div>

  <div class="card">
    <div class="form-group">
      <div style="flex: 1;">
        <label for="date">Filtrar por data (opcional)</label>
        <input id="date" type="date" />
      </div>
      <button id="load">Carregar</button>
      <a href="/api/chamadas/exportar-todas" class="btn btn-export-all">📥 Baixar Todas as Chamadas</a>
    </div>
    <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 13px;">Carregue as chamadas já existentes para visualizar e baixar.</p>
    <div id="result"></div>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

<script>
  function renderSessions(data, date, usedFallback = false) {
    const target = document.getElementById('result');

    if (!data || !data.length) {
      target.innerHTML = '<div class="result-empty"><p>📭 Nenhuma chamada encontrada.</p></div>';
      return;
    }

    const fallbackNotice = usedFallback
      ? '<div style="margin-bottom:12px;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;color:var(--text-muted);font-size:12px;">⚠️ Nenhum resultado na data filtrada. Mostrando chamadas mais recentes.</div>'
      : '';

    target.innerHTML = fallbackNotice + '<h3 style="margin-bottom: 16px;">📚 Salas Encontradas</h3><ul>' + data.map(session => {
      const roomName = session.name || 'Sem nome';
      const dateLabel = session.start_time ? new Date(session.start_time).toLocaleString('pt-BR') : '-';
      const status = session.active
        ? '<span style="font-size:12px; color:#10b981;">🟢 Ativa</span>'
        : '<span style="font-size:12px; color:var(--text-muted);">⚪ Encerrada</span>';
      const exportDate = date || (session.start_time ? session.start_time.slice(0, 10) : 'sem-data');

      return \`<li>
        <div>
          <strong>\${roomName}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ \${dateLabel}</div>
          <div style="margin-top: 6px;">\${status}</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <a href="/class/\${session.class_id}" style="padding: 8px 12px; background: var(--card-dark); border: 1px solid var(--border-color); border-radius: 6px; font-size: 12px;">📂 Abrir</a>
          <a href="/chamadas/\${session.session_id}/export?date=\${exportDate}&format=xlsx" style="padding: 8px 12px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; color: white; font-size: 12px; border: none;">📥 Baixar</a>
        </div>
      </li>\`;
    }).join('') + '</ul>';
  }

  async function loadSessions() {
    const date = document.getElementById('date').value;
    const endpoint = date ? '/chamadas/api/' + date : '/chamadas/api';
    try {
      const resp = await fetch(endpoint);
      if (!resp.ok) {
        console.error('Erro na resposta:', resp.status, resp.statusText);
        return alert('Falha ao carregar chamadas: ' + resp.status);
      }
      const data = await resp.json();
      console.log('Dados carregados:', data);

      if (date && (!data || !data.length)) {
        const fallbackResp = await fetch('/chamadas/api');
        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          renderSessions(fallbackData, '', true);
          return;
        }
      }

      renderSessions(data, date, false);
    } catch (err) {
      console.error('Erro ao carregar:', err);
      alert('Erro ao carregar chamadas: ' + err.message);
    }
  }

  document.getElementById('load').addEventListener('click', loadSessions);
  window.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date');
    dateInput.value = '';
    loadSessions();
  });
</script>

</body>
</html>
  `);
});

app.get('/chamadas/api', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  try {
    const schema = await getAttendanceSchema();
    let sessions;

    if (schema.hasClassId) {
      sessions = req.user.role === 'admin'
        ? await db.query(
            `
            SELECT * FROM (
              SELECT
                s.id::text AS session_id,
                c.id AS class_id,
                c.name,
                s.active,
                s.start_time,
                s.end_time,
                false AS is_legacy
              FROM class_sessions s
              JOIN classes c ON c.id = s.class_id

              UNION ALL

              SELECT
                ('legacy-' || c.id::text || '-' || TO_CHAR(DATE(a.login_at), 'YYYY-MM-DD')) AS session_id,
                c.id AS class_id,
                c.name,
                false AS active,
                DATE(a.login_at)::timestamptz AS start_time,
                NULL::timestamptz AS end_time,
                true AS is_legacy
              FROM attendances a
              JOIN classes c ON c.id = a.class_id
              WHERE a.class_id IS NOT NULL
                AND a.class_session_id IS NULL
              GROUP BY c.id, c.name, DATE(a.login_at)
            ) x
            ORDER BY x.start_time DESC
            LIMIT 120`
          )
        : await db.query(
            `
            SELECT * FROM (
              SELECT
                s.id::text AS session_id,
                c.id AS class_id,
                c.name,
                s.active,
                s.start_time,
                s.end_time,
                false AS is_legacy
              FROM class_sessions s
              JOIN classes c ON c.id = s.class_id
              WHERE c.professor_id = $1

              UNION ALL

              SELECT
                ('legacy-' || c.id::text || '-' || TO_CHAR(DATE(a.login_at), 'YYYY-MM-DD')) AS session_id,
                c.id AS class_id,
                c.name,
                false AS active,
                DATE(a.login_at)::timestamptz AS start_time,
                NULL::timestamptz AS end_time,
                true AS is_legacy
              FROM attendances a
              JOIN classes c ON c.id = a.class_id
              WHERE a.class_id IS NOT NULL
                AND a.class_session_id IS NULL
                AND c.professor_id = $1
              GROUP BY c.id, c.name, DATE(a.login_at)
            ) x
            ORDER BY x.start_time DESC
            LIMIT 120`,
            [req.user.id]
          );
    } else {
      sessions = req.user.role === 'admin'
        ? await db.query(
            `SELECT s.id::text AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time, false AS is_legacy
             FROM class_sessions s
             JOIN classes c ON c.id = s.class_id
             ORDER BY s.start_time DESC
             LIMIT 120`
          )
        : await db.query(
            `SELECT s.id::text AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time, false AS is_legacy
             FROM class_sessions s
             JOIN classes c ON c.id = s.class_id
             WHERE c.professor_id = $1
             ORDER BY s.start_time DESC
             LIMIT 120`,
            [req.user.id]
          );
    }

    console.log(`[DEBUG] /chamadas/api - Usuário ${req.user.id} (${req.user.role}) carregou ${sessions.rows.length} sessões`);
    res.json(sessions.rows);
  } catch (err) {
    console.error('[ERROR] /chamadas/api:', err.message);
    res.status(500).json({ error: 'Falha ao listar chamadas', details: err.message });
  }
});

app.get('/chamadas/api/:date', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  const date = req.params.date;
  try {
    const schema = await getAttendanceSchema();
    let sessions;

    if (schema.hasClassId) {
      sessions = req.user.role === 'admin'
        ? await db.query(
            `
            SELECT * FROM (
              SELECT
                s.id::text AS session_id,
                c.id AS class_id,
                c.name,
                s.active,
                s.start_time,
                s.end_time,
                false AS is_legacy
              FROM class_sessions s
              JOIN classes c ON c.id = s.class_id
              WHERE DATE(s.start_time) = $1

              UNION ALL

              SELECT
                ('legacy-' || c.id::text || '-' || TO_CHAR(DATE(a.login_at), 'YYYY-MM-DD')) AS session_id,
                c.id AS class_id,
                c.name,
                false AS active,
                DATE(a.login_at)::timestamptz AS start_time,
                NULL::timestamptz AS end_time,
                true AS is_legacy
              FROM attendances a
              JOIN classes c ON c.id = a.class_id
              WHERE a.class_id IS NOT NULL
                AND a.class_session_id IS NULL
                AND DATE(a.login_at) = $1::date
              GROUP BY c.id, c.name, DATE(a.login_at)
            ) x
            ORDER BY x.start_time DESC`,
            [date]
          )
        : await db.query(
            `
            SELECT * FROM (
              SELECT
                s.id::text AS session_id,
                c.id AS class_id,
                c.name,
                s.active,
                s.start_time,
                s.end_time,
                false AS is_legacy
              FROM class_sessions s
              JOIN classes c ON c.id = s.class_id
              WHERE c.professor_id = $1
                AND DATE(s.start_time) = $2

              UNION ALL

              SELECT
                ('legacy-' || c.id::text || '-' || TO_CHAR(DATE(a.login_at), 'YYYY-MM-DD')) AS session_id,
                c.id AS class_id,
                c.name,
                false AS active,
                DATE(a.login_at)::timestamptz AS start_time,
                NULL::timestamptz AS end_time,
                true AS is_legacy
              FROM attendances a
              JOIN classes c ON c.id = a.class_id
              WHERE a.class_id IS NOT NULL
                AND a.class_session_id IS NULL
                AND c.professor_id = $1
                AND DATE(a.login_at) = $2::date
              GROUP BY c.id, c.name, DATE(a.login_at)
            ) x
            ORDER BY x.start_time DESC`,
            [req.user.id, date]
          );
    } else {
      sessions = req.user.role === 'admin'
        ? await db.query(
            `SELECT s.id::text AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time, false AS is_legacy
             FROM class_sessions s
             JOIN classes c ON c.id = s.class_id
             WHERE DATE(s.start_time) = $1
             ORDER BY s.start_time DESC`,
            [date]
          )
        : await db.query(
            `SELECT s.id::text AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time, false AS is_legacy
             FROM class_sessions s
             JOIN classes c ON c.id = s.class_id
             WHERE c.professor_id = $1 AND DATE(s.start_time) = $2
             ORDER BY s.start_time DESC`,
            [req.user.id, date]
          );
    }

    console.log(`[DEBUG] /chamadas/api/${date} - Usuário ${req.user.id} (${req.user.role}) carregou ${sessions.rows.length} sessões para ${date}`);
    res.json(sessions.rows);
  } catch (err) {
    console.error('[ERROR] /chamadas/api/:date:', err.message);
    res.status(500).json({ error: 'Falha ao listar chamadas', details: err.message });
  }
});

app.get('/chamadas/:sessionId/export', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).send('Erro: DB não conectado.');
  const sessionId = req.params.sessionId;
  const date = req.query.date;
  try {
    const schema = await getAttendanceSchema();
    const legacyMatch = /^legacy-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(sessionId);
    let sessionData;
    let exportQuery;
    let exportFileDate = date;

    if (legacyMatch) {
      const legacyClassId = parseInt(legacyMatch[1], 10);
      const legacyDate = legacyMatch[2];

      const classResult = req.user.role === 'admin'
        ? await db.query(`SELECT id, name FROM classes WHERE id = $1`, [legacyClassId])
        : await db.query(`SELECT id, name FROM classes WHERE id = $1 AND professor_id = $2`, [legacyClassId, req.user.id]);

      if (!classResult.rowCount) return res.status(404).send('Chamada antiga não encontrada.');

      sessionData = { class_id: legacyClassId, name: classResult.rows[0].name };
      exportFileDate = legacyDate;

      exportQuery = {
        sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at
              FROM attendances a
              LEFT JOIN users u ON a.student_id = u.id
              WHERE a.class_id = $1
                AND DATE(a.login_at) = $2::date
              ORDER BY a.login_at ASC`,
        params: [legacyClassId, legacyDate]
      };
    } else {
      const sessionResult = req.user.role === 'admin'
        ? await db.query(`SELECT s.id, s.class_id, s.start_time, c.name FROM class_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`, [sessionId])
        : await db.query(`SELECT s.id, s.class_id, s.start_time, c.name FROM class_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = $1 AND c.professor_id = $2`, [sessionId, req.user.id]);

      if (!sessionResult.rowCount) return res.status(404).send('Sessão não encontrada');

      sessionData = sessionResult.rows[0];

      exportQuery = schema.hasClassSessionId
        ? {
            sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at
                  FROM attendances a
                  LEFT JOIN users u ON a.student_id = u.id
                  WHERE a.class_session_id = $1
                     OR (a.class_session_id IS NULL AND a.class_id = $2 AND DATE(a.login_at) = DATE($3::timestamptz))
                  ORDER BY a.login_at ASC`,
            params: [sessionId, sessionData.class_id, sessionData.start_time]
          }
        : {
            sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at
                  FROM attendances a
                  LEFT JOIN users u ON a.student_id = u.id
                  WHERE a.class_id = $1
                  ORDER BY a.login_at ASC`,
            params: [sessionData.class_id]
          };
    }

    const attendances = await db.query(exportQuery.sql, exportQuery.params);

    const rows = attendances.rows;

    if (req.query.format === 'xlsx') {
      const sheetData = rows.map(r => ({
        Nome: r.student_name,
        Discord: r.discord_username,
        'Data/Hora': new Date(r.login_at).toLocaleString()
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chamadas');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${sessionData.name.replace(/\s/g,'_')}-${exportFileDate || 'sem-data'}.xlsx"`);
      res.send(buffer);
    } else {
      const csv = ['Nome;Discord;Data/Hora', ...rows.map(r => `${r.student_name};${r.discord_username};${new Date(r.login_at).toLocaleString()}`)].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${sessionData.name.replace(/\s/g,'_')}-${exportFileDate || 'sem-data'}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao exportar chamada');
  }
});

app.get('/classes', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    if (req.user.role === 'professor' || req.user.role === 'admin') {
      const subjectsRes = await db.query('SELECT id, name FROM subjects ORDER BY name');
      const subjectOptions = subjectsRes.rows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

      const rooms = req.user.role === 'admin'
        ? await db.query(`
          SELECT c.id, c.name, c.subject_id, s.name AS subject_name, u.username AS professor_name
          FROM classes c
          LEFT JOIN subjects s ON c.subject_id = s.id
          LEFT JOIN users u ON c.professor_id = u.id
          ORDER BY c.id DESC
        `)
        : await db.query(`
          SELECT c.id, c.name, c.subject_id, s.name AS subject_name, u.username AS professor_name
          FROM classes c
          LEFT JOIN subjects s ON c.subject_id = s.id
          LEFT JOIN users u ON c.professor_id = u.id
          WHERE c.professor_id = $1
          ORDER BY c.id DESC
        `, [req.user.id]);

      const activeSessions = req.user.role === 'admin'
        ? await db.query(`SELECT class_id FROM class_sessions WHERE active = true`)
        : await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      const activeSet = new Set(activeSessions.rows.map(r => r.class_id));

      const roomsList = rooms.rows.map(r => {
        const isActive = activeSet.has(r.id);
        const statusBadge = isActive ? '<span class="badge badge-active">🔴 Em Chamada</span>' : '<span class="badge badge-inactive">⚪ Disponível</span>';
        const subjectBadge = r.subject_name ? `<span style="color: #93c5fd; font-size: 12px;">📘 ${r.subject_name}</span>` : '<span style="color: #94a3b8; font-size: 12px;">📘 Sem matéria</span>';
        return `<li>
          <div>
            <strong>${r.name}</strong>
            <div style="margin-top: 8px;">${subjectBadge} ${statusBadge}</div>
            ${req.user.role === 'admin' ? `<div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👨‍🏫 Prof. ${r.professor_name || 'Não definido'}</div>` : ''}
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/class/${r.id}">Abrir</a>
            ${(req.user.role === 'professor' || req.user.role === 'admin') ? (isActive ? `<form method="POST" action="/class/${r.id}/end" style="display:inline; margin: 0;"><button type="submit" class="btn-danger">Encerrar</button></form>` : `<form method="POST" action="/class/${r.id}/start-session" style="display:inline; margin: 0;"><button type="submit">Iniciar</button></form>`) : ''}
            ${req.user.role === 'admin' ? `<form method="POST" action="/admin/class/${r.id}/delete" style="display:inline; margin: 0;" onsubmit="return confirm('Tem certeza que deseja excluir esta sala e todo o histórico de chamadas?');"><button type="submit" class="btn-danger">🗑️ Excluir</button></form>` : ''}
          </div>
        </li>`;
      }).join('');

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mercury Class | Salas de Aula</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Mercury Class</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>🏫 Salas de Aula</h1>
  </div>

  ${req.user.role === 'professor' ? `<div class="card">
    <h2>➕ Criar Nova Sala</h2>
    <form method="POST" action="/class/start">
      <input name="name" required placeholder="Nome da sala" />
      <select name="subject_id">
        <option value="">Sem matéria</option>
        ${subjectOptions || ''}
      </select>
      <button type="submit">Criar Sala</button>
    </form>
    <p style="margin-top:10px;color:var(--text-muted);font-size:13px;">Gerencie matérias em <a href="/subjects" style='color:var(--primary);'>/subjects</a>.</p>
  </div>` : ''}

  <div class="card">
    <h2>${req.user.role === 'admin' ? '📚 Todas as Salas' : '📚 Minhas Salas'}</h2>
    <ul>${roomsList}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
      `;
      res.send(html);
    } else {
      const classes = await db.query(`
        SELECT c.id, c.name, c.subject_id, s.name AS subject_name, u.username AS professor_name
        FROM class_sessions cs
        JOIN classes c ON cs.class_id = c.id
        JOIN users u ON c.professor_id = u.id
        LEFT JOIN subjects s ON c.subject_id = s.id
        WHERE cs.active = true
        ORDER BY cs.start_time DESC
      `);
      
      const classList = classes.rows.map(c => `<li>
        <div>
          <strong>${c.name}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👨‍🏫 Prof. ${c.professor_name} • 📘 ${c.subject_name || 'Sem matéria'}</div>
        </div>
        <a href="/class/${c.id}">Entrar</a>
      </li>`).join('');

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mercury Class | Salas Disponíveis</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Mercury Class</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>🎓 Salas Disponíveis</h1>
    <p style="color: var(--text-muted); margin-top: 8px;">Escolha uma sala para registrar sua presença</p>
  </div>

  <div class="card">
    <h2>📚 Salas Ativas</h2>
    <ul>${classList || '<li style="color: var(--text-muted);">📭 Nenhuma sala disponível no momento</li>'}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
      `;
      res.send(html);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar lista de salas');
  }
});

app.post('/class/:id/end', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    await db.query(`UPDATE class_sessions SET active = false, end_time = NOW() WHERE class_id = $1 AND active = true`, [classId]);
    res.redirect('/classes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao encerrar classe');
  }
});

app.post('/class/:id/mark', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.json({ success: false, error: 'DB não conectado' });
  const classId = req.params.id;
  const fullName = req.body.fullName?.trim();

  if (!fullName) return res.status(400).json({ success: false, error: 'Informe o nome completo do aluno para marcar presença.' });

  try {
    const schema = await getAttendanceSchema();
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.status(400).json({ success: false, error: 'Não há chamada ativa para esta sala.' });

    const sessionId = sessionRes.rows[0].id;

    const existing = schema.hasClassSessionId
      ? await db.query(`SELECT id FROM attendances WHERE class_session_id = $1 AND student_name = $2 LIMIT 1`, [sessionId, fullName])
      : await db.query(`SELECT id FROM attendances WHERE class_id = $1 AND student_name = $2 LIMIT 1`, [classId, fullName]);

    if (existing.rowCount) {
      await db.query(`UPDATE attendances SET login_at = NOW() WHERE id = $1`, [existing.rows[0].id]);
    } else {
      if (schema.hasClassSessionId && schema.hasClassId) {
        await db.query(`INSERT INTO attendances (class_session_id, class_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`, [sessionId, classId, fullName]);
      } else if (schema.hasClassSessionId) {
        await db.query(`INSERT INTO attendances (class_session_id, student_name, login_at) VALUES ($1, $2, NOW())`, [sessionId, fullName]);
      } else {
        await db.query(`INSERT INTO attendances (class_id, student_name, login_at) VALUES ($1, $2, NOW())`, [classId, fullName]);
      }
    }

    res.json({ success: true, message: 'Presença marcada com sucesso' });
  } catch (err) {
    console.error('Erro ao marcar presença por nome:', err);
    if (err.code === '23505' && err.constraint === 'attendances_class_session_name_idx') {
      return res.status(400).json({
        success: false,
        error: 'duplicate_name',
        message: 'Este nome já foi registrado nesta chamada.'
      });
    }
    res.status(500).json({ success: false, error: 'Erro ao registrar presença por nome' });
  }
});

app.get('/admin/dashboard', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    const sessions = await db.query(`
      SELECT s.id, s.class_id, c.name, s.start_time, s.end_time, s.active, COUNT(a.id) as total_presencas, u.username as professor_name
      FROM class_sessions s
      JOIN classes c ON c.id = s.class_id
      JOIN users u ON u.id = c.professor_id
      LEFT JOIN attendances a ON a.class_session_id = s.id
      GROUP BY s.id, c.name, s.class_id, u.username
      ORDER BY s.start_time DESC
    `);

    const totalSessions = sessions.rowCount;
    const activeSessions = sessions.rows.filter(s => s.active).length;
    const totalAttendances = sessions.rows.reduce((sum, s) => sum + parseInt(s.total_presencas), 0);

    const sessionsList = sessions.rows.map(s => `<li>
      <div>
        <strong>${s.name}</strong>
        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">
          👨‍🏫 ${s.professor_name} | 📅 ${new Date(s.start_time).toLocaleString('pt-BR')} | 👥 ${s.total_presencas} presenças
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <span class="status-badge ${s.active ? 'active' : 'inactive'}">${s.active ? '🟢 Ativa' : '⚫ Encerrada'}</span>
        <form method="POST" action="/admin/delete-session/${s.id}" style="display:inline; margin: 0;" onsubmit="return confirm('Tem certeza que deseja deletar esta sessão?');">
          <button type="submit" class="btn-delete">🗑️ Deletar</button>
        </form>
      </div>
    </li>`).join('');

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mercury Class | Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${MERCURY_THEME}</style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Mercury Class</h2>
  <ul class="nav-menu">
    <li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/subjects">📚 Matérias</a></li>
    <li><a href="/chamadas">📋 Chamadas</a></li>
    <li><a href="/admin/db-check">🧪 Diagnóstico DB</a></li>
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>⚙️ Painel de Administração</h1>
    <p>Controle e gestão de todas as chamadas do sistema</p>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <h3>${totalSessions}</h3>
      <p>Total de Sessões</p>
    </div>
    <div class="metric-card">
      <h3>${activeSessions}</h3>
      <p>Sessões Ativas</p>
    </div>
    <div class="metric-card">
      <h3>${totalAttendances}</h3>
      <p>Total de Presenças</p>
    </div>
  </div>

  <div class="card">
    <h2>📋 Todas as Chamadas</h2>
    <ul>${sessionsList || '<li style="color: var(--text-muted);">Nenhuma sessão registrada</li>'}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar dashboard admin');
  }
});

app.post('/admin/subject/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const subjectId = parseInt(req.params.id, 10);
  if (!subjectId) return res.status(400).send('ID de matéria inválido.');

  try {
    await db.query('BEGIN');
    await db.query(`UPDATE classes SET subject_id = NULL WHERE subject_id = $1`, [subjectId]);
    await db.query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
    await db.query('COMMIT');
    res.redirect('/subjects');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Erro ao excluir matéria');
  }
});

app.post('/admin/class/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = parseInt(req.params.id, 10);
  if (!classId) return res.status(400).send('ID de sala inválido.');

  try {
    await db.query('BEGIN');

    // Remove presenças ligadas às sessões da sala
    await db.query(`
      DELETE FROM attendances a
      USING class_sessions cs
      WHERE a.class_session_id = cs.id
        AND cs.class_id = $1
    `, [classId]);

    // Compatibilidade com bancos antigos que ainda possuam attendances.class_id
    const legacyClassIdColumn = await db.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'attendances'
        AND column_name = 'class_id'
      LIMIT 1
    `);
    if (legacyClassIdColumn.rowCount) {
      await db.query(`DELETE FROM attendances WHERE class_id = $1`, [classId]);
    }

    // Remove sessões da sala
    await db.query(`DELETE FROM class_sessions WHERE class_id = $1`, [classId]);

    await db.query(`DELETE FROM classes WHERE id = $1`, [classId]);
    await db.query('COMMIT');
    res.redirect('/classes');
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('Erro ao excluir sala:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });
    res.status(500).send('Erro ao excluir sala');
  }
});

app.post('/admin/delete-session/:sessionId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const sessionId = req.params.sessionId;
  try {
    await db.query(`DELETE FROM attendances WHERE class_session_id = $1`, [sessionId]);
    await db.query(`DELETE FROM class_sessions WHERE id = $1`, [sessionId]);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar sessão');
  }
});

app.get('/logout', ensureAuthenticated, (req, res) => {
  req.logout(err => {
    if (err) console.error(err);
    res.redirect('/');
  });
});

// ========== ENDPOINTS DE HISTÓRICO DE CHAMADAS ==========

// GET: Listar histórico de chamadas
app.get('/api/chamadas/historico', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  
  try {
    const query = req.user.role === 'admin'
      ? `SELECT 
          ch.id,
          ch.class_id,
          c.name as class_name,
          ch.session_date,
          ch.session_start_time,
          ch.session_end_time,
          ch.total_students,
          ch.total_present,
          ch.created_at,
          u.username as professor_name
         FROM call_history ch
         JOIN classes c ON c.id = ch.class_id
         JOIN users u ON u.id = ch.professor_id
         ORDER BY ch.session_date DESC
         LIMIT 500`
      : `SELECT 
          ch.id,
          ch.class_id,
          c.name as class_name,
          ch.session_date,
          ch.session_start_time,
          ch.session_end_time,
          ch.total_students,
          ch.total_present,
          ch.created_at,
          u.username as professor_name
         FROM call_history ch
         JOIN classes c ON c.id = ch.class_id
         JOIN users u ON u.id = ch.professor_id
         WHERE ch.professor_id = $1
         ORDER BY ch.session_date DESC
         LIMIT 500`;
    
    const params = req.user.role === 'admin' ? [] : [req.user.id];
    const result = await db.query(query, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar histórico:', err);
    res.status(500).json({ error: 'Erro ao listar histórico' });
  }
});

// GET: Exportar todas as chamadas em um ZIP contendo Excels das sessões reais do professor/admin
app.get('/api/chamadas/exportar-todas', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).send('Erro: DB não conectado');
  
  try {
    const schema = await getAttendanceSchema();
    const professorId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    let sessions;
    if (schema.hasClassId) {
      sessions = isAdmin
        ? await db.query(
            `
            SELECT * FROM (
              SELECT
                s.id::text AS session_id,
                c.id AS class_id,
                c.name,
                s.active,
                s.start_time,
                s.end_time,
                false AS is_legacy
              FROM class_sessions s
              JOIN classes c ON c.id = s.class_id

              UNION ALL

              SELECT
                ('legacy-' || c.id::text || '-' || TO_CHAR(DATE(a.login_at), 'YYYY-MM-DD')) AS session_id,
                c.id AS class_id,
                c.name,
                false AS active,
                DATE(a.login_at)::timestamptz AS start_time,
                NULL::timestamptz AS end_time,
                true AS is_legacy
              FROM attendances a
              JOIN classes c ON c.id = a.class_id
              WHERE a.class_id IS NOT NULL
                AND a.class_session_id IS NULL
              GROUP BY c.id, c.name, DATE(a.login_at)
            ) x
            ORDER BY x.start_time DESC`
          )
        : await db.query(
            `
            SELECT * FROM (
              SELECT
                s.id::text AS session_id,
                c.id AS class_id,
                c.name,
                s.active,
                s.start_time,
                s.end_time,
                false AS is_legacy
              FROM class_sessions s
              JOIN classes c ON c.id = s.class_id
              WHERE c.professor_id = $1

              UNION ALL

              SELECT
                ('legacy-' || c.id::text || '-' || TO_CHAR(DATE(a.login_at), 'YYYY-MM-DD')) AS session_id,
                c.id AS class_id,
                c.name,
                false AS active,
                DATE(a.login_at)::timestamptz AS start_time,
                NULL::timestamptz AS end_time,
                true AS is_legacy
              FROM attendances a
              JOIN classes c ON c.id = a.class_id
              WHERE a.class_id IS NOT NULL
                AND a.class_session_id IS NULL
                AND c.professor_id = $1
              GROUP BY c.id, c.name, DATE(a.login_at)
            ) x
            ORDER BY x.start_time DESC`,
            [professorId]
          );
    } else {
      sessions = isAdmin
        ? await db.query(
            `SELECT s.id::text AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time, false AS is_legacy
             FROM class_sessions s
             JOIN classes c ON c.id = s.class_id
             ORDER BY s.start_time DESC`
          )
        : await db.query(
            `SELECT s.id::text AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time, false AS is_legacy
             FROM class_sessions s
             JOIN classes c ON c.id = s.class_id
             WHERE c.professor_id = $1
             ORDER BY s.start_time DESC`,
            [professorId]
          );
    }
    
    if (!sessions.rowCount) {
      return res.status(404).send('Nenhuma chamada encontrada para exportar.');
    }
    
    const JSZip = require('jszip');
    const zip = new JSZip();
    
    function sanitizePathPart(name) {
      return (name || '').replace(/[\/\\?%*:|"<>]/g, '_').trim();
    }
    
    // Para cada sessão, obter presenças e colocar no ZIP
    for (const session of sessions.rows) {
      const sessionId = session.session_id;
      const legacyMatch = /^legacy-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(sessionId);
      let exportQuery;
      let exportFileDate = session.start_time ? new Date(session.start_time).toISOString().split('T')[0] : 'sem-data';
      
      if (legacyMatch) {
        const legacyClassId = parseInt(legacyMatch[1], 10);
        const legacyDate = legacyMatch[2];
        exportFileDate = legacyDate;
        exportQuery = {
          sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at
                FROM attendances a
                LEFT JOIN users u ON a.student_id = u.id
                WHERE a.class_id = $1
                  AND DATE(a.login_at) = $2::date
                ORDER BY a.login_at ASC`,
          params: [legacyClassId, legacyDate]
        };
      } else {
        exportQuery = schema.hasClassSessionId
          ? {
              sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at
                    FROM attendances a
                    LEFT JOIN users u ON a.student_id = u.id
                    WHERE a.class_session_id = $1
                       OR (a.class_session_id IS NULL AND a.class_id = $2 AND DATE(a.login_at) = DATE($3::timestamptz))
                    ORDER BY a.login_at ASC`,
              params: [sessionId, session.class_id, session.start_time]
            }
          : {
              sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at
                    FROM attendances a
                    LEFT JOIN users u ON a.student_id = u.id
                    WHERE a.class_id = $1
                    ORDER BY a.login_at ASC`,
              params: [session.class_id]
            };
      }
      
      const attendancesResult = await db.query(exportQuery.sql, exportQuery.params);
      const rows = attendancesResult.rows;
      
      const sheetData = rows.map(r => ({
        Nome: r.student_name,
        Discord: r.discord_username || '',
        'Data/Hora': new Date(r.login_at).toLocaleString('pt-BR')
      }));
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chamadas');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      const folderName = sanitizePathPart(session.name);
      const fileName = `chamada-${sanitizePathPart(session.name)}-${exportFileDate}.xlsx`;
      
      zip.file(`${folderName}/${fileName}`, buffer);
    }
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="historico-chamadas-sessoes.zip"');
    res.send(zipBuffer);
    
  } catch (err) {
    console.error('Erro ao exportar todas as chamadas:', err);
    res.status(500).send('Erro ao exportar todas as chamadas');
  }
});

// GET: Detalhes de uma chamada (com lista de alunos)
app.get('/api/chamadas/historico/:callId/detalhes', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  
  try {
    const callId = req.params.callId;
    
    const callQuery = req.user.role === 'admin'
      ? `SELECT * FROM call_history WHERE id = $1`
      : `SELECT * FROM call_history WHERE id = $1 AND professor_id = $2`;
    
    const callParams = req.user.role === 'admin' ? [callId] : [callId, req.user.id];
    const callResult = await db.query(callQuery, callParams);
    
    if (!callResult.rowCount) {
      return res.status(404).json({ error: 'Chamada não encontrada' });
    }
    
    const call = callResult.rows[0];
    
    // Buscar registros de presença
    const recordsQuery = `
      SELECT 
        ar.id,
        ar.student_name,
        ar.student_id,
        ar.attendance_time,
        ar.attendance_date
      FROM attendance_records ar
      WHERE ar.session_id = $1
      ORDER BY ar.attendance_time ASC
    `;
    
    const recordsResult = await db.query(recordsQuery, [call.session_id]);
    
    res.json({
      call: call,
      records: recordsResult.rows
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes:', err);
    res.status(500).json({ error: 'Erro ao buscar detalhes' });
  }
});

// POST: Registrar nova chamada no histórico
app.post('/api/chamadas/historico/registrar', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  
  try {
    const { session_id, class_id, session_name, session_date, total_students, total_present } = req.body;
    
    if (!session_id || !class_id || !session_name || !session_date) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }
    
    const result = await db.query(`
      INSERT INTO call_history 
      (class_id, session_id, professor_id, session_name, session_date, session_start_time, total_students, total_present)
      VALUES ($1, $2, $3, $4, $5::date, NOW(), $6, $7)
      RETURNING id
    `, [class_id, session_id, req.user.id, session_name, session_date, total_students || 0, total_present || 0]);
    
    res.json({ success: true, call_id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao registrar chamada:', err);
    res.status(500).json({ error: 'Erro ao registrar chamada' });
  }
});

// POST: Registrar presença de aluno no histórico
app.post('/api/chamadas/historico/:callId/registrar-aluno', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  
  try {
    const callId = req.params.callId;
    const { student_name, student_id, attendance_date } = req.body;
    
    if (!student_name || !attendance_date) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }
    
    // Buscar dados da chamada
    const callQuery = req.user.role === 'admin'
      ? `SELECT * FROM call_history WHERE id = $1`
      : `SELECT * FROM call_history WHERE id = $1 AND professor_id = $2`;
    
    const callParams = req.user.role === 'admin' ? [callId] : [callId, req.user.id];
    const callResult = await db.query(callQuery, callParams);
    
    if (!callResult.rowCount) {
      return res.status(404).json({ error: 'Chamada não encontrada' });
    }
    
    const call = callResult.rows[0];
    
    // Registrar presença
    const result = await db.query(`
      INSERT INTO attendance_records 
      (session_id, class_id, professor_id, student_name, student_id, attendance_date, attendance_time)
      VALUES ($1, $2, $3, $4, $5, $6::date, NOW())
      RETURNING id
    `, [call.session_id, call.class_id, req.user.id, student_name, student_id, attendance_date]);
    
    res.json({ success: true, record_id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao registrar aluno:', err);
    res.status(500).json({ error: 'Erro ao registrar aluno' });
  }
});

// GET: Exportar chamada em Excel
app.get('/api/chamadas/historico/:callId/exportar', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).send('Erro: DB não conectado');
  
  try {
    const callId = req.params.callId;
    const format = req.query.format || 'xlsx';
    
    const callQuery = req.user.role === 'admin'
      ? `SELECT ch.*, c.name as class_name FROM call_history ch 
         JOIN classes c ON c.id = ch.class_id WHERE ch.id = $1`
      : `SELECT ch.*, c.name as class_name FROM call_history ch 
         JOIN classes c ON c.id = ch.class_id WHERE ch.id = $1 AND ch.professor_id = $2`;
    
    const callParams = req.user.role === 'admin' ? [callId] : [callId, req.user.id];
    const callResult = await db.query(callQuery, callParams);
    
    if (!callResult.rowCount) {
      return res.status(404).send('Chamada não encontrada');
    }
    
    const call = callResult.rows[0];
    
    // Buscar registros de presença
    const recordsResult = await db.query(`
      SELECT 
        ar.student_name,
        ar.student_id,
        ar.attendance_time,
        ar.attendance_date
      FROM attendance_records ar
      WHERE ar.session_id = $1
      ORDER BY ar.attendance_time ASC
    `, [call.session_id]);
    
    const rows = recordsResult.rows;
    
    if (format === 'xlsx') {
      const sheetData = rows.map(r => ({
        Nome: r.student_name,
        ID: r.student_id || '',
        'Data': new Date(r.attendance_date).toLocaleDateString('pt-BR'),
        'Horário': new Date(r.attendance_time).toLocaleTimeString('pt-BR')
      }));
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chamada');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${call.class_name.replace(/\s/g,'_')}-${call.session_date}.xlsx"`);
      res.send(buffer);
    } else {
      const csv = ['Nome,ID,Data,Horário', 
        ...rows.map(r => `${r.student_name},${r.student_id || ''},${new Date(r.attendance_date).toLocaleDateString('pt-BR')},${new Date(r.attendance_time).toLocaleTimeString('pt-BR')}`)
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${call.class_name.replace(/\s/g,'_')}-${call.session_date}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    console.error('Erro ao exportar:', err);
    res.status(500).send('Erro ao exportar chamada');
  }
});

// GET: Deletar chamada do histórico
app.delete('/api/chamadas/historico/:callId', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  
  try {
    const callId = req.params.callId;
    
    const callQuery = req.user.role === 'admin'
      ? `SELECT id FROM call_history WHERE id = $1`
      : `SELECT id FROM call_history WHERE id = $1 AND professor_id = $2`;
    
    const callParams = req.user.role === 'admin' ? [callId] : [callId, req.user.id];
    const callResult = await db.query(callQuery, callParams);
    
    if (!callResult.rowCount) {
      return res.status(404).json({ error: 'Chamada não encontrada' });
    }
    
    await db.query('BEGIN');
    try {
      await db.query(`DELETE FROM attendance_records WHERE session_id = (SELECT session_id FROM call_history WHERE id = $1)`, [callId]);
      await db.query(`DELETE FROM call_history WHERE id = $1`, [callId]);
      await db.query('COMMIT');
      
      res.json({ success: true });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Erro ao deletar chamada:', err);
    res.status(500).json({ error: 'Erro ao deletar chamada' });
  }
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Server rodando na porta ' + PORT);
});