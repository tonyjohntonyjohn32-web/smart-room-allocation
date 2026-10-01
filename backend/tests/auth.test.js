const request = require('supertest');
const app = require('../server');

describe('Authentication & Authorization API Suite', () => {
  let adminToken = '';
  let facultyToken = '';

  test('POST /api/auth/login - should authenticate admin with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@college.edu',
        password: 'Admin@123'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.email).toBe('admin@college.edu');

    adminToken = res.body.token;
  });

  test('POST /api/auth/login - should authenticate faculty user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'faculty.cs@college.edu',
        password: 'Faculty@123'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('faculty');

    facultyToken = res.body.token;
  });

  test('POST /api/auth/login - should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@college.edu',
        password: 'WrongPassword999!'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login - should reject missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/me - should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/me - should return user profile with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('admin@college.edu');
  });

  test('Role authorization - should forbid faculty from creating a room', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        room_number: 'TEST-UNAUTH',
        room_name: 'Unauthorized Room',
        building: 'Main Block',
        floor: 1,
        room_type: 'Classroom',
        capacity: 30
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
