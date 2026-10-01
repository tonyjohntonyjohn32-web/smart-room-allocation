const request = require('supertest');
const app = require('../server');

describe('Room Management API Suite', () => {
  let adminToken = '';
  let facultyToken = '';
  let testRoomId = null;

  beforeAll(async () => {
    // Obtain admin token
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@college.edu',
      password: 'Admin@123'
    });
    adminToken = adminRes.body.token;

    // Obtain faculty token
    const facultyRes = await request(app).post('/api/auth/login').send({
      email: 'faculty.cs@college.edu',
      password: 'Faculty@123'
    });
    facultyToken = facultyRes.body.token;
  });

  test('GET /api/rooms - should retrieve room list', async () => {
    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('POST /api/rooms - should create a new room as admin', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_number: 'TEST-301',
        room_name: 'Experimental Robotics Studio',
        building: 'Technology Wing',
        floor: 3,
        room_type: 'Laboratory',
        capacity: 45,
        equipment: ['Computers', 'Laboratory Equipment', 'Wi-Fi'],
        accessibility: 'Wheelchair Accessible',
        description: 'New testing laboratory for robotic actuators'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.room.room_number).toBe('TEST-301');
    testRoomId = res.body.room.id;
  });

  test('POST /api/rooms - should reject duplicate room number in same building', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_number: 'TEST-301',
        room_name: 'Duplicate Test Room',
        building: 'Technology Wing',
        floor: 3,
        room_type: 'Laboratory',
        capacity: 30
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/rooms - should reject invalid capacity (<= 0 or string)', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_number: 'INVALID-CAP',
        room_name: 'Invalid Cap Room',
        building: 'Main Block',
        floor: 1,
        room_type: 'Classroom',
        capacity: -10
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/rooms/:id - should get room details', async () => {
    const res = await request(app)
      .get(`/api/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.room.id).toBe(testRoomId);
  });

  test('PUT /api/rooms/:id - should update room details', async () => {
    const res = await request(app)
      .put(`/api/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        room_name: 'Updated Robotics Studio',
        capacity: 50
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.room.room_name).toBe('Updated Robotics Studio');
    expect(res.body.room.capacity).toBe(50);
  });

  test('GET /api/rooms/availability - should check real-time availability', async () => {
    const res = await request(app)
      .get('/api/rooms/availability?date=2026-10-15&start_time=10:00&end_time=11:30')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.availableCount).toBeDefined();
    expect(Array.isArray(res.body.rooms)).toBe(true);
  });

  test('DELETE /api/rooms/:id - should delete room without active allocations', async () => {
    const res = await request(app)
      .delete(`/api/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
