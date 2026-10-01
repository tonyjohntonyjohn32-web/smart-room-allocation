# REST API Documentation

## Smart Room Allocation — College Classroom & Facility Management System

- **Base URL:** `http://localhost:5000/api`
- **Default Content-Type:** `application/json`
- **Authentication Scheme:** `Authorization: Bearer <JWT_TOKEN>`

---

## 1. Authentication Endpoints

### 1.1 User Login
Authenticates an administrator or faculty member and returns a signed JWT token.

- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Auth Required:** No (Rate limited: 50 requests / 15 mins)
- **Request Body:**
  ```json
  {
    "email": "admin@college.edu",
    "password": "Admin@123"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "System Administrator",
      "email": "admin@college.edu",
      "role": "admin",
      "department_id": null
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid email or incorrect password.
  - `403 Forbidden`: Account is inactive.

---

### 1.2 Get Current User Profile
Retrieves the logged-in user's profile and assigned department.

- **Method:** `GET`
- **Endpoint:** `/auth/me`
- **Auth Required:** Yes (Any role)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "user": {
      "id": 2,
      "name": "Dr. Alan Turing",
      "email": "faculty.cs@college.edu",
      "role": "faculty",
      "department_id": 1,
      "department_name": "Computer Science & Engineering",
      "department_code": "CSE"
    }
  }
  ```

---

### 1.3 Change Password
Updates user password after verifying current password.

- **Method:** `POST`
- **Endpoint:** `/auth/change-password`
- **Auth Required:** Yes (Any role)
- **Request Body:**
  ```json
  {
    "currentPassword": "Faculty@123",
    "newPassword": "NewSecurePassword#2025"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Password updated successfully."
  }
  ```

---

## 2. Room Management Endpoints

### 2.1 Get All Rooms
Lists rooms with multi-criteria filtering, search, sorting, and pagination.

- **Method:** `GET`
- **Endpoint:** `/rooms`
- **Auth Required:** Yes
- **Query Parameters:**
  - `search` (string): Keyword matching room number, name, or description.
  - `building` (string): Filter by building.
  - `room_type` (string): `Classroom`, `Laboratory`, `Computer Lab`, `Seminar Hall`, `Auditorium`, `Conference Room`, `Tutorial Room`.
  - `min_capacity` (int): Minimum capacity.
  - `status` (string): `available`, `occupied`, `maintenance`, `inactive`.
  - `page` (int, default 1): Page number.
  - `limit` (int, default 50): Items per page.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "room_number": "CR-101",
        "room_name": "Smart Lecture Hall 1",
        "building": "Main Academic Block",
        "floor": 1,
        "room_type": "Classroom",
        "capacity": 60,
        "equipment": ["Projector", "Whiteboard", "Wi-Fi", "Air Conditioning"],
        "accessibility": "Wheelchair Accessible",
        "status": "available",
        "total_allocations": 12
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 10, "totalPages": 1 }
  }
  ```

---

### 2.2 Create Room
Adds a new facility to the database.

- **Method:** `POST`
- **Endpoint:** `/rooms`
- **Auth Required:** Yes (`admin` only)
- **Request Body:**
  ```json
  {
    "room_number": "LAB-305",
    "room_name": "IoT & Embedded Systems Lab",
    "building": "Technology Wing",
    "floor": 3,
    "room_type": "Laboratory",
    "capacity": 36,
    "department_id": 1,
    "equipment": ["Computers", "Smart Board", "Wi-Fi", "Laboratory Equipment"],
    "accessibility": "Wheelchair Accessible",
    "status": "available",
    "description": "Equipped with microcontrollers and oscilloscopes."
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Room created successfully.",
    "room": { "id": 11, "room_number": "LAB-305", ... }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing mandatory fields, non-positive capacity, or duplicate room number in building.
  - `403 Forbidden`: User is not an Administrator.

---

### 2.3 Room Availability Check
Computes real-time room availability for a specified time window using conflict detection.

- **Method:** `GET`
- **Endpoint:** `/rooms/availability`
- **Auth Required:** Yes
- **Query Parameters:**
  - `date` (string, required): `YYYY-MM-DD`
  - `start_time` (string, required): `HH:MM`
  - `end_time` (string, required): `HH:MM`
  - `min_capacity` (int, optional): Minimum required seats.
  - `room_type` (string, optional): Specific facility type.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "totalRooms": 10,
    "availableCount": 8,
    "occupiedCount": 2,
    "rooms": [
      {
        "id": 1,
        "room_number": "CR-101",
        "isAvailable": true,
        "conflicts": []
      },
      {
        "id": 4,
        "room_number": "LAB-101",
        "isAvailable": false,
        "conflicts": [
          {
            "type": "ROOM_DOUBLE_BOOKING",
            "message": "Room LAB-101 is already booked from 13:00 to 15:00 for CSE-305."
          }
        ]
      }
    ]
  }
  ```

---

## 3. Room Allocation Endpoints

### 3.1 Create Allocation (Manual Booking)
Creates a confirmed allocation after verifying interval collisions, faculty availability, capacity constraints, and maintenance status.

- **Method:** `POST`
- **Endpoint:** `/allocations`
- **Auth Required:** Yes (`admin` only)
- **Request Body:**
  ```json
  {
    "room_id": 1,
    "department_id": 1,
    "faculty_id": 2,
    "subject": "CSE-401 Compiler Design",
    "academic_year": "2025-2026",
    "semester": "Semester 7",
    "student_group": "CS-Sec-A",
    "allocation_date": "2026-11-25",
    "start_time": "11:00",
    "end_time": "12:30",
    "expected_students": 50,
    "notes": "Bring lab laptops"
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Room allocated successfully.",
    "allocation": { "id": 15, "subject": "CSE-401 Compiler Design", ... }
  }
  ```
- **Conflict Response (`409 Conflict`):**
  ```json
  {
    "success": false,
    "message": "Room CR-101 is already booked from 10:30 to 12:00 for ME-204.",
    "conflicts": [
      {
        "type": "ROOM_DOUBLE_BOOKING",
        "message": "Room CR-101 is already booked from 10:30 to 12:00 for ME-204."
      }
    ]
  }
  ```

---

### 3.2 Intelligent Room Recommendation
Evaluates all facilities against multi-criteria scoring algorithm and ranks suitable rooms.

- **Method:** `POST`
- **Endpoint:** `/allocations/recommend`
- **Auth Required:** Yes
- **Request Body:**
  ```json
  {
    "date": "2026-11-25",
    "start_time": "14:00",
    "end_time": "15:30",
    "expected_students": 45,
    "room_type": "Classroom",
    "required_equipment": ["Projector", "Smart Board"],
    "department_id": 1,
    "require_accessibility": true
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "recommended": {
      "room": {
        "id": 1,
        "room_number": "CR-101",
        "capacity": 60,
        "building": "Main Academic Block"
      },
      "score": 93,
      "utilizationRatio": 75,
      "scoreBreakdown": {
        "capacityScore": 35,
        "equipmentScore": 25,
        "roomTypeScore": 20,
        "departmentScore": 10,
        "accessibilityScore": 10
      }
    },
    "alternatives": [ ... ],
    "explanation": "Room CR-101 in Main Academic Block is the top recommendation with a suitability score of 93/100...",
    "excludedCount": 3
  }
  ```

---

## 4. Timetable Endpoints

### 4.1 Get Timetable Schedule
Returns class allocations formatted for matrix rendering across views.

- **Method:** `GET`
- **Endpoint:** `/timetable`
- **Auth Required:** Yes
- **Query Parameters:**
  - `view`: `weekly`, `daily`, `monthly`.
  - `date`: `YYYY-MM-DD`.
  - `room_id`, `faculty_id`, `department_id`, `building`.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "meta": {
      "view": "weekly",
      "startDate": "2026-11-23",
      "endDate": "2026-11-28",
      "totalEntries": 14
    },
    "allocations": [
      {
        "id": 1,
        "room_number": "CR-101",
        "subject": "CSE-301: Advanced Data Structures",
        "day_of_week": "Monday",
        "start_time": "09:00",
        "end_time": "10:30",
        "color": { "bg": "#eff6ff", "border": "#3b82f6", "text": "#1d4ed8" }
      }
    ],
    "maintenance": []
  }
  ```

---

## 5. Dashboard Endpoints

### 5.1 Dashboard Summary Statistics
- **Method:** `GET`
- **Endpoint:** `/dashboard/summary`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "stats": {
      "totalRooms": 10,
      "availableRooms": 8,
      "occupiedRooms": 1,
      "maintenanceRooms": 1,
      "totalAllocations": 4,
      "totalDepartments": 5,
      "utilizationRate": 76
    },
    "alerts": { "maintenance": [...] }
  }
  ```

---

## 6. Reports & Data Export Endpoints

- `GET /reports/room-utilization`
- `GET /reports/department-allocations`
- `GET /reports/building-utilization`
- `GET /reports/unused-rooms`
- `GET /reports/maintenance`
- `GET /reports/capacity-efficiency`
- `GET /reports/export?type=allocations` (Streams raw CSV attachment)
- `GET /reports/export?type=rooms` (Streams raw CSV attachment)
