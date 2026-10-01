const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');

// Load environment variables if not loaded
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { DatabaseSync } = require('node:sqlite');

class DatabaseWrapper {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
    this.initPragmas();
    this.initSchema();
  }

  initPragmas() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (this.dbPath !== ':memory:') {
      try {
        this.db.exec('PRAGMA journal_mode = WAL;');
      } catch (e) {
        // WAL might not be supported on all storage backends, ignore if fails
      }
    }
  }

  query(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  get(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  run(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = callback(this);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  initSchema() {
    const schemaSql = `
      -- 1. Departments Table
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        head_name TEXT,
        email TEXT,
        phone TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Users Table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'faculty')),
        department_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      );

      -- 3. Rooms Table
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT NOT NULL,
        room_name TEXT NOT NULL,
        building TEXT NOT NULL,
        floor INTEGER NOT NULL,
        room_type TEXT NOT NULL,
        capacity INTEGER NOT NULL CHECK(capacity > 0),
        department_id INTEGER,
        equipment TEXT DEFAULT '[]',
        accessibility TEXT DEFAULT 'Standard',
        status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'maintenance', 'inactive')),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(room_number, building),
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      );

      -- 4. Allocations Table
      CREATE TABLE IF NOT EXISTS allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        faculty_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        semester TEXT NOT NULL,
        student_group TEXT NOT NULL,
        allocation_date TEXT NOT NULL,
        day_of_week TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        expected_students INTEGER NOT NULL CHECK(expected_students > 0),
        status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'completed')),
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      -- 5. Maintenance Table
      CREATE TABLE IF NOT EXISTS maintenance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_progress', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      -- 6. Settings Table
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_allocations_room_date ON allocations(room_id, allocation_date, status);
      CREATE INDEX IF NOT EXISTS idx_allocations_faculty_date ON allocations(faculty_id, allocation_date, status);
      CREATE INDEX IF NOT EXISTS idx_allocations_dept_date ON allocations(department_id, allocation_date);
      CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building, room_type);
      CREATE INDEX IF NOT EXISTS idx_maintenance_room ON maintenance(room_id, start_date, end_date);
    `;

    this.db.exec(schemaSql);
  }
}

/**
 * Helper to seed the database with realistic academic data idempotently
 */
function seedDatabase(db, force = false) {
  const existingUsers = db.query('SELECT COUNT(*) as count FROM users');
  if (!force && existingUsers[0] && existingUsers[0].count > 0) {
    logger.info('Database already seeded. Skipping initial seed.');
    return;
  }

  if (force) {
    logger.info('Force flag detected. Resetting database tables...');
    db.exec(`
      DELETE FROM allocations;
      DELETE FROM maintenance;
      DELETE FROM rooms;
      DELETE FROM users;
      DELETE FROM departments;
      DELETE FROM settings;
    `);
  }

  logger.info('Seeding database with default academic data...');

  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('Admin@123', salt);
  const facultyPasswordHash = bcrypt.hashSync('Faculty@123', salt);

  db.transaction((tx) => {
    // 1. Seed Departments
    const depts = [
      { name: 'Computer Science & Engineering', code: 'CSE', head: 'Dr. John McCarthy', email: 'cse@college.edu', phone: '+1-555-0101', desc: 'Department of Computer Science and Engineering' },
      { name: 'Electronics & Communication', code: 'ECE', head: 'Dr. Claude Shannon', email: 'ece@college.edu', phone: '+1-555-0102', desc: 'Department of Electronics and Communications' },
      { name: 'Mechanical Engineering', code: 'ME', head: 'Dr. James Watt', email: 'me@college.edu', phone: '+1-555-0103', desc: 'Department of Mechanical Engineering' },
      { name: 'Civil Engineering', code: 'CE', head: 'Dr. Thomas Telford', email: 'ce@college.edu', phone: '+1-555-0104', desc: 'Department of Civil and Environmental Engineering' },
      { name: 'Management Studies', code: 'MBA', head: 'Dr. Peter Drucker', email: 'mba@college.edu', phone: '+1-555-0105', desc: 'School of Business Administration & Management' }
    ];

    const insertDept = tx.db.prepare(`
      INSERT INTO departments (name, code, head_name, email, phone, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const deptIds = {};
    for (const d of depts) {
      const res = insertDept.run(d.name, d.code, d.head, d.email, d.phone, d.desc);
      deptIds[d.code] = res.lastInsertRowid;
    }

    // 2. Seed Users
    const insertUser = tx.db.prepare(`
      INSERT INTO users (name, email, password_hash, role, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Administrator
    const adminRes = insertUser.run('System Administrator', 'admin@college.edu', adminPasswordHash, 'admin', null, 1);
    const adminId = adminRes.lastInsertRowid;

    // Faculty
    const facultyUsers = [
      { name: 'Dr. Alan Turing', email: 'faculty.cs@college.edu', dept: deptIds['CSE'] },
      { name: 'Prof. Ada Lovelace', email: 'ada.lovelace@college.edu', dept: deptIds['CSE'] },
      { name: 'Dr. Nikola Tesla', email: 'faculty.ece@college.edu', dept: deptIds['ECE'] },
      { name: 'Dr. James Watt', email: 'faculty.mech@college.edu', dept: deptIds['ME'] },
      { name: 'Prof. Marie Curie', email: 'faculty.sci@college.edu', dept: deptIds['CE'] }
    ];

    const facultyIds = [];
    for (const f of facultyUsers) {
      const fRes = insertUser.run(f.name, f.email, facultyPasswordHash, 'faculty', f.dept, 1);
      facultyIds.push(fRes.lastInsertRowid);
    }

    // 3. Seed Rooms
    const rooms = [
      {
        room_number: 'CR-101',
        room_name: 'Smart Lecture Hall 1',
        building: 'Main Academic Block',
        floor: 1,
        room_type: 'Classroom',
        capacity: 60,
        department_id: deptIds['CSE'],
        equipment: JSON.stringify(['Projector', 'Whiteboard', 'Wi-Fi', 'Air Conditioning']),
        accessibility: 'Wheelchair Accessible',
        status: 'available',
        description: 'Primary lecture theatre equipped with HD projector and acoustic dampening'
      },
      {
        room_number: 'CR-102',
        room_name: 'Interactive Classroom 2',
        building: 'Main Academic Block',
        floor: 1,
        room_type: 'Classroom',
        capacity: 45,
        department_id: deptIds['CSE'],
        equipment: JSON.stringify(['Smart Board', 'Whiteboard', 'Wi-Fi']),
        accessibility: 'Standard',
        status: 'available',
        description: 'Interactive classroom with collaborative digital smart board'
      },
      {
        room_number: 'CR-201',
        room_name: 'Lecture Room 201',
        building: 'Main Academic Block',
        floor: 2,
        room_type: 'Classroom',
        capacity: 70,
        department_id: deptIds['ECE'],
        equipment: JSON.stringify(['Projector', 'Whiteboard', 'Audio System', 'Wi-Fi']),
        accessibility: 'Wheelchair Accessible',
        status: 'available',
        description: 'Spacious classroom suited for large cohort theory classes'
      },
      {
        room_number: 'LAB-101',
        room_name: 'High Performance Computing Lab',
        building: 'Technology Wing',
        floor: 1,
        room_type: 'Computer Lab',
        capacity: 40,
        department_id: deptIds['CSE'],
        equipment: JSON.stringify(['Computers', 'Projector', 'Wi-Fi', 'Air Conditioning', 'Audio System']),
        accessibility: 'Wheelchair Accessible',
        status: 'available',
        description: 'Equipped with 40 high-end Linux & Windows developer workstations'
      },
      {
        room_number: 'LAB-102',
        room_name: 'AI & Robotics Lab',
        building: 'Technology Wing',
        floor: 1,
        room_type: 'Computer Lab',
        capacity: 35,
        department_id: deptIds['CSE'],
        equipment: JSON.stringify(['Computers', 'Smart Board', 'Wi-Fi', 'Air Conditioning']),
        accessibility: 'Wheelchair Accessible',
        status: 'available',
        description: 'Dedicated artificial intelligence and data science laboratory'
      },
      {
        room_number: 'SEM-301',
        room_name: 'Sir CV Raman Seminar Hall',
        building: 'Main Academic Block',
        floor: 3,
        room_type: 'Seminar Hall',
        capacity: 120,
        department_id: null,
        equipment: JSON.stringify(['Projector', 'Audio System', 'Air Conditioning', 'Wi-Fi', 'Smart Board']),
        accessibility: 'Wheelchair Accessible, Elevator Access',
        status: 'available',
        description: 'Mid-sized tiered seminar hall for guest lectures, workshops and symposiums'
      },
      {
        room_number: 'AUD-01',
        room_name: 'APJ Abdul Kalam Grand Auditorium',
        building: 'Science Complex',
        floor: 1,
        room_type: 'Auditorium',
        capacity: 350,
        department_id: null,
        equipment: JSON.stringify(['Projector', 'Audio System', 'Air Conditioning', 'Smart Board', 'Wi-Fi', 'Stage Lighting']),
        accessibility: 'Wheelchair Accessible, Ramp Access',
        status: 'available',
        description: 'State-of-the-art auditorium with stage, surround sound, and dual 4K projection'
      },
      {
        room_number: 'CONF-201',
        room_name: 'Executive Conference Room',
        building: 'Main Academic Block',
        floor: 2,
        room_type: 'Conference Room',
        capacity: 25,
        department_id: deptIds['MBA'],
        equipment: JSON.stringify(['Smart Board', 'Audio System', 'Air Conditioning', 'Wi-Fi']),
        accessibility: 'Wheelchair Accessible',
        status: 'available',
        description: 'Meeting room for board discussions, academic councils, and departmental committees'
      },
      {
        room_number: 'TR-105',
        room_name: 'Tutorial Room 105',
        building: 'Science Complex',
        floor: 1,
        room_type: 'Tutorial Room',
        capacity: 30,
        department_id: deptIds['ME'],
        equipment: JSON.stringify(['Whiteboard', 'Wi-Fi']),
        accessibility: 'Standard',
        status: 'available',
        description: 'Small group tutorial and problem solving classroom'
      },
      {
        room_number: 'CR-205',
        room_name: 'Civil Drafting Room',
        building: 'Technology Wing',
        floor: 2,
        room_type: 'Laboratory',
        capacity: 50,
        department_id: deptIds['CE'],
        equipment: JSON.stringify(['Laboratory Equipment', 'Whiteboard', 'Wi-Fi']),
        accessibility: 'Standard',
        status: 'maintenance',
        description: 'Drafting tables and structural analysis instruments (Currently undergoing HVAC repair)'
      }
    ];

    const insertRoom = tx.db.prepare(`
      INSERT INTO rooms (
        room_number, room_name, building, floor, room_type, capacity,
        department_id, equipment, accessibility, status, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const roomIds = {};
    for (const r of rooms) {
      const res = insertRoom.run(
        r.room_number, r.room_name, r.building, r.floor, r.room_type,
        r.capacity, r.department_id, r.equipment, r.accessibility, r.status, r.description
      );
      roomIds[r.room_number] = res.lastInsertRowid;
    }

    // 4. Seed Maintenance Records
    const insertMaint = tx.db.prepare(`
      INSERT INTO maintenance (room_id, start_date, end_date, reason, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

    insertMaint.run(
      roomIds['CR-205'],
      todayStr,
      nextWeekStr,
      'HVAC renovation and precision workstation calibration',
      'in_progress'
    );

    // 5. Seed Allocations
    const insertAlloc = tx.db.prepare(`
      INSERT INTO allocations (
        room_id, department_id, faculty_id, subject, academic_year, semester,
        student_group, allocation_date, day_of_week, start_time, end_time,
        expected_students, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = days[new Date().getDay()];

    const sampleAllocations = [
      {
        room: roomIds['CR-101'],
        dept: deptIds['CSE'],
        faculty: facultyIds[0], // Dr. Alan Turing
        subject: 'CSE-301: Advanced Data Structures',
        year: '2025-2026',
        sem: 'Semester 5',
        group: 'CS-Sec-A',
        date: todayStr,
        day: currentDayName,
        start: '09:00',
        end: '10:30',
        students: 55,
        notes: 'Regular lecture with live coding demonstration'
      },
      {
        room: roomIds['CR-101'],
        dept: deptIds['ME'],
        faculty: facultyIds[3], // Dr. James Watt
        subject: 'ME-204: Fluid Mechanics',
        year: '2025-2026',
        sem: 'Semester 3',
        group: 'ME-Sec-B',
        date: todayStr,
        day: currentDayName,
        start: '10:30',
        end: '12:00',
        students: 50,
        notes: 'Adjacent slot test - non overlapping'
      },
      {
        room: roomIds['LAB-101'],
        dept: deptIds['CSE'],
        faculty: facultyIds[1], // Prof. Ada Lovelace
        subject: 'CSE-305: Full Stack Web Architecture',
        year: '2025-2026',
        sem: 'Semester 5',
        group: 'CS-Sec-B',
        date: todayStr,
        day: currentDayName,
        start: '13:00',
        end: '15:00',
        students: 38,
        notes: 'Hands-on laboratory session'
      },
      {
        room: roomIds['SEM-301'],
        dept: deptIds['ECE'],
        faculty: facultyIds[2], // Dr. Nikola Tesla
        subject: 'ECE-402: Quantum Signals & Systems',
        year: '2025-2026',
        sem: 'Semester 7',
        group: 'ECE-Final-Year',
        date: todayStr,
        day: currentDayName,
        start: '14:00',
        end: '16:00',
        students: 90,
        notes: 'Invited seminar with visual slides'
      }
    ];

    for (const a of sampleAllocations) {
      insertAlloc.run(
        a.room, a.dept, a.faculty, a.subject, a.year, a.sem,
        a.group, a.date, a.day, a.start, a.end, a.students,
        'confirmed', a.notes, adminId
      );
    }

    // 6. Seed Application Settings
    const insertSetting = tx.db.prepare(`
      INSERT OR REPLACE INTO settings (setting_key, setting_value)
      VALUES (?, ?)
    `);

    const defaultSettings = {
      institution_name: 'Apex Institute of Science & Technology',
      institution_code: 'AIST-CAMPUS',
      academic_year: '2025-2026',
      current_semester: 'Odd Semester (Autumn)',
      working_days: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
      working_hours_start: '08:30',
      working_hours_end: '17:30',
      default_slot_duration: '60',
      contact_email: 'admin@college.edu',
      contact_phone: '+1-555-0100'
    };

    for (const [key, val] of Object.entries(defaultSettings)) {
      insertSetting.run(key, val);
    }
  });

  logger.info('Database seeded successfully.');
}

// Ensure database directory exists
function getDbInstance(customPath = null) {
  const dbPath = customPath || process.env.DB_PATH || path.join(__dirname, 'data', 'rooms.db');

  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseWrapper(dbPath);
  return db;
}

// Default export is the initialized singleton for server usage
const defaultDb = getDbInstance();

// Auto-seed if running on normal startup
if (process.env.NODE_ENV !== 'test') {
  seedDatabase(defaultDb, false);
}

// Command line flag execution: node db.js --seed or --reset
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--reset')) {
    logger.info('Resetting and reseeding database via CLI flag...');
    seedDatabase(defaultDb, true);
  } else if (args.includes('--seed')) {
    logger.info('Seeding database via CLI flag...');
    seedDatabase(defaultDb, false);
  }
}

module.exports = {
  db: defaultDb,
  getDbInstance,
  seedDatabase
};
