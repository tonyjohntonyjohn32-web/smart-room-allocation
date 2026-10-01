const request = require('supertest');
const app = require('../server');
const { db } = require('../db');

describe('Room Allocation & Conflict Detection API Suite', () => {
  let adminToken = '';
  let facultyToken = '';

  beforeAll(async () => {
    // Clean up any previous test allocations
    db.run("DELETE FROM allocations WHERE subject LIKE 'TEST-%'");

    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@college.edu',
      password: 'Admin@123'
    });
    adminToken = adminRes.body.token;

    const facultyRes = await request(app).post('/api/auth/login').send({
      email: 'faculty.cs@college.edu',
      password: 'Faculty@123'
    });
    facultyToken = facultyRes.body.token;
  });

  afterAll(() => {
    // Clean up created test allocations
    db.run("DELETE FROM allocations WHERE subject LIKE 'TEST-%'");
  });

  const testDate = '2026-11-20';

  test('POST /api/allocations - should create a valid room allocation', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 1, // CR-101 (cap 60)
        department_id: 1, // CSE
        faculty_id: 2, // Dr. Alan Turing
        subject: 'TEST-101: Distributed Systems',
        academic_year: '2025-2026',
        semester: 'Semester 5',
        student_group: 'CS-Sec-A',
        allocation_date: testDate,
        start_time: '10:00',
        end_time: '11:30',
        expected_students: 45,
        notes: 'Integration test allocation'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.allocation.id).toBeDefined();
  });

  test('POST /api/allocations - should reject room overlap conflict (10:30-12:00 conflicts with 10:00-11:30)', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 1, // Same room CR-101
        department_id: 1,
        faculty_id: 3, // Different faculty
        subject: 'TEST-OVERLAP: Network Security',
        academic_year: '2025-2026',
        semester: 'Semester 5',
        student_group: 'CS-Sec-B',
        allocation_date: testDate,
        start_time: '10:30',
        end_time: '12:00',
        expected_students: 40
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already booked/i);
  });

  test('POST /api/allocations - should accept adjacent non-overlapping slots (11:30-12:30 is adjacent to 10:00-11:30)', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 1, // Same room CR-101
        department_id: 1,
        faculty_id: 3,
        subject: 'TEST-ADJACENT: Graph Theory',
        academic_year: '2025-2026',
        semester: 'Semester 5',
        student_group: 'CS-Sec-C',
        allocation_date: testDate,
        start_time: '11:30',
        end_time: '12:30',
        expected_students: 35
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/allocations - should reject faculty double-booking conflict', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 2, // Different room CR-102
        department_id: 1,
        faculty_id: 2, // Same faculty Dr. Alan Turing already booked at 10:00-11:30 in Room 1!
        subject: 'TEST-FACULTY-CONFLICT: Cloud Computing',
        academic_year: '2025-2026',
        semester: 'Semester 5',
        student_group: 'CS-Sec-D',
        allocation_date: testDate,
        start_time: '10:15',
        end_time: '11:15',
        expected_students: 30
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already scheduled/i);
  });

  test('POST /api/allocations - should reject capacity violation (expected 100 > room capacity 60)', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 1,
        department_id: 1,
        faculty_id: 4,
        subject: 'TEST-CAPACITY: Oversized Lecture',
        academic_year: '2025-2026',
        semester: 'Semester 1',
        student_group: 'Mega-Cohort',
        allocation_date: testDate,
        start_time: '14:00',
        end_time: '15:00',
        expected_students: 150 // Exceeds 60
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/capacity/i);
  });

  test('POST /api/allocations - should reject allocation during active maintenance', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 10, // CR-205 (under maintenance in seed data)
        department_id: 4,
        faculty_id: 5,
        subject: 'TEST-MAINT: Structural Dynamics',
        academic_year: '2025-2026',
        semester: 'Semester 6',
        student_group: 'CE-Sec-A',
        allocation_date: new Date().toISOString().split('T')[0], // today
        start_time: '10:00',
        end_time: '11:00',
        expected_students: 30
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/maintenance/i);
  });

  test('POST /api/allocations - should reject invalid time range (start >= end)', async () => {
    const res = await request(app)
      .post('/api/allocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_id: 2,
        department_id: 1,
        faculty_id: 3,
        subject: 'TEST-TIME: Invalid Time',
        academic_year: '2025-2026',
        semester: 'Semester 5',
        student_group: 'CS-Sec-A',
        allocation_date: testDate,
        start_time: '15:00',
        end_time: '14:00', // invalid!
        expected_students: 30
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/after start time/i);
  });

  test('POST /api/allocations/recommend - should recommend the most suitable room based on scoring', async () => {
    const res = await request(app)
      .post('/api/allocations/recommend')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        date: testDate,
        start_time: '15:00',
        end_time: '16:30',
        expected_students: 35,
        room_type: 'Computer Lab',
        required_equipment: ['Computers', 'Projector'],
        department_id: 1
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recommended).toBeDefined();
    expect(res.body.recommended.room.room_type).toBe('Computer Lab');
    expect(res.body.recommended.score).toBeGreaterThan(50);
    expect(res.body.explanation).toBeDefined();
  });
});
