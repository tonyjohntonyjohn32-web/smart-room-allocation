# Smart Room Allocation — College Classroom & Facility Management System

> **Production-Quality Academic Web Application for Final-Year Project Demonstration**  
> Built with Node.js, Express, SQLite, Vanilla ES6+ JavaScript, CSS Custom Properties, and Chart.js.

---

## 🏛️ Project Overview

**Smart Room Allocation** is a full-stack web application designed for universities, colleges, and higher education institutions to manage classrooms, laboratories, auditoriums, and seminar halls. 

It solves common academic administrative bottlenecks by automating room scheduling, preventing double-booking through mathematical interval-overlap verification, and intelligently recommending the best rooms based on student capacity, required hardware equipment, room type, and departmental affiliation.

---

## 🚀 Key Features

- **📊 Dynamic Dashboard:**
  - Real-time KPI summary cards (Total Rooms, Available Now, Occupied Now, Total Bookings, Departments, Room Utilization %).
  - 4 interactive Chart.js charts: Room Occupancy (Doughnut), Building Facilities (Bar), Department Distribution (Bar), and Weekly Load Trend (Line).
  - Live feeds of upcoming classes, recent allocations, and facility maintenance alerts.

- **🏛️ Classrooms & Facility Catalog:**
  - Complete CRUD management with multi-criteria search and filters (Building, Room Type, Capacity, Status).
  - Responsive Grid View & Table View toggles.
  - Equipment tags (Projector, Smart Board, Computers, Wi-Fi, AC, Audio System).
  - Accessibility tracking (Wheelchair accessible, Ramp/Elevator access).

- **⚡ Automated & Manual Room Allocation:**
  - **Manual Booking:** Form with real-time collision detection.
  - **✨ Intelligent Recommendation Engine:** Transparent scoring model (0–100 pts) ranking rooms based on capacity fit (penalizing wasteful oversizing), equipment match, room type compatibility, and department preference.
  - One-click auto-allocation with zero conflict risk.

- **🛡️ Robust Conflict Prevention:**
  - Mathematical interval overlap detection ($ExistingStart < RequestedEnd \land ExistingEnd > RequestedStart$).
  - Adjacent slot support ($09:00\text{--}10:00$ and $10:00\text{--}11:00$ are valid and non-overlapping).
  - Room double-booking prevention.
  - Faculty instructor double-booking prevention.
  - Capacity violation checks ($expected\_students \le room.capacity$).
  - Maintenance period auto-blocking.

- **📅 Interactive Multi-View Timetable:**
  - Daily and Weekly scheduler matrix.
  - Color-coded course blocks with pop-up detail modals.
  - Filter by Room, Faculty, or Department.
  - Ink-friendly printable timetable view and CSV export.

- **🔍 Dedicated Availability Search:**
  - Instantly checks availability of all campus rooms for any custom date and time slot.
  - Direct "Allocate Now" button for administrators.

- **📈 Institutional Reports & Data Export:**
  - 6 report modes: Room Utilization, Department Allocations, Building Utilization, Unused Rooms, Maintenance History, and Capacity Efficiency & Wastage.
  - Raw CSV export for analysis in Excel or Google Sheets.

- **🔒 Security & Role-Based Access Control:**
  - JWT token authentication and bcrypt password hashing.
  - Role-based permissions (`admin` vs `faculty`).
  - Rate limiting on authentication endpoints to prevent brute-force attacks.
  - Helmet security headers and parameterized SQL queries to prevent SQL injection.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (CSS Variables, Flexbox, Grid), Vanilla JavaScript (ES6+), Chart.js |
| **Backend** | Node.js, Express.js REST API |
| **Database** | SQLite 3 (`better-sqlite3` compatible / built-in `node:sqlite`), WAL Mode, Foreign Keys |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| **Security** | `helmet`, `cors`, `express-rate-limit`, `express-validator` |
| **Testing** | Jest, Supertest |

---

## 📁 Project Directory Structure

```text
smart-room-allocation-fullstack/
│
├── backend/
│   ├── data/
│   │   ├── .gitkeep
│   │   └── rooms.db              # Auto-initialized persistent SQLite DB
│   ├── package.json
│   ├── server.js                 # Express server & static asset host
│   ├── db.js                     # SQLite wrapper & idempotent seed script
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & role authorization
│   │   └── errorHandler.js       # Centralized error handler
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── roomRoutes.js
│   │   ├── allocationRoutes.js
│   │   ├── timetableRoutes.js
│   │   ├── departmentRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── reportRoutes.js
│   │   └── settingsRoutes.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── roomController.js
│   │   ├── allocationController.js
│   │   ├── timetableController.js
│   │   ├── departmentController.js
│   │   ├── dashboardController.js
│   │   ├── reportController.js
│   │   └── settingsController.js
│   ├── services/
│   │   ├── allocationService.js  # Intelligent recommendation engine
│   │   └── conflictService.js    # Temporal & physical conflict engine
│   ├── utils/
│   │   ├── validators.js         # Input validation helpers
│   │   └── logger.js             # Formatted terminal logger
│   └── tests/
│       ├── auth.test.js          # Authentication & role tests
│       ├── rooms.test.js         # Room CRUD & validation tests
│       └── allocations.test.js   # Conflict & recommendation tests
│
├── frontend/
│   ├── index.html                # Main SPA dashboard application
│   ├── login.html                # Login portal with 1-click demo buttons
│   ├── script.js                 # Application orchestrator
│   ├── style.css                 # Responsive design system & print styles
│   ├── assets/
│   │   ├── logo.svg
│   │   └── favicon.svg
│   └── js/
│       ├── api.js                # Centralized Fetch API client
│       ├── auth.js               # Session & role manager
│       ├── dashboard.js          # KPI metrics & Chart.js renderer
│       ├── rooms.js              # Facility catalog manager
│       ├── allocations.js        # Manual & smart allocation forms
│       ├── timetable.js          # Interactive timetable scheduler
│       ├── reports.js            # Analytical reports & CSV exporter
│       └── ui.js                 # Toasts, native modals & formatters
│
├── docs/
│   ├── STEP_BY_STEP.md           # Beginner-friendly Windows & VS Code tutorial
│   ├── API_DOCUMENTATION.md      # Comprehensive REST API endpoint reference
│   ├── DATABASE_SCHEMA.md        # Relational schema specifications & ER diagram
│   ├── USER_GUIDE.md             # Administrator & Faculty user handbook
│   └── PROJECT_REPORT.md         # Complete 22-section academic project report
│
├── .gitignore
├── .env.example
├── package.json
└── README.md
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested and verified on Node v24.14.0 & npm v11.9.0).
- Windows 10/11 or macOS / Linux.

### 2. Installation
Open your terminal in the project root:
```bash
npm run install:all
```
*(Or navigate to `backend/` and run `npm install`).*

### 3. Start the Application
```bash
npm start
```

### 4. Access the Web Application
Open your browser and visit:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🔑 Default Login Credentials

Use the **1-Click Demo Buttons** on the login page or enter:

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@college.edu` | `Admin@123` | Full access to all modules, facilities, bookings, and settings |
| **Faculty Member** | `faculty.cs@college.edu` | `Faculty@123` | View facilities, check availability, view schedules, and inspect recommendations |

---

## 🧪 Running Automated Tests

Run the complete test suite:
```bash
npm test
```

### Verified Test Results (100% Pass):
- **Authentication Suite (`auth.test.js`):** Login verification, invalid passwords, token extraction, role access restrictions.
- **Room Management Suite (`rooms.test.js`):** Creation, duplicate detection, capacity validation, editing, deletion.
- **Allocations Suite (`allocations.test.js`):** Valid booking, interval overlap rejection, adjacent slot acceptance, faculty collision detection, capacity violation detection, maintenance collision detection, automated recommendation scoring.

---

## 📚 Project Documentation

Detailed academic and technical documentation is available in the [`docs/`](./docs) folder:
- **[docs/STEP_BY_STEP.md](./docs/STEP_BY_STEP.md):** Beginner tutorial for Windows and VS Code with terminal command guides and troubleshooting.
- **[docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md):** Complete REST endpoint specifications with sample requests/responses.
- **[docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md):** Relational schema details, constraints, and Mermaid ER diagram.
- **[docs/USER_GUIDE.md](./docs/USER_GUIDE.md):** Step-by-step user manual for Administrators and Faculty.
- **[docs/PROJECT_REPORT.md](./docs/PROJECT_REPORT.md):** Comprehensive 22-section final-year academic project report.

---

## 🎓 Academic Demonstration Guide

When presenting this project for an academic defense:
1. **Introduction:** Highlight the difficulty colleges face managing rooms across buildings and the issue of spatial capacity wastage.
2. **Dashboard Demo:** Showcase the 6 real-time metrics and dynamic Chart.js charts.
3. **Room Catalog:** Demonstrate search, filters, and equipment badges.
4. **Collision Detection Demonstration:**
   - Book a room for `10:00 - 11:30`.
   - Try booking the same room for `10:30 - 12:00` and demonstrate the system blocking the conflict with a descriptive message.
   - Book the same room for `11:30 - 12:30` (adjacent slot) to prove non-overlapping interval handling.
5. **Smart Automated Recommendation Demo:** Input student count (e.g. 40), required equipment (Projector + Smart Board), and click "Calculate Recommendation". Explain the transparent suitability scoring model and score breakdown.
6. **Timetable & Reports:** Demonstrate the multi-view weekly grid, class details modal, printable view, and one-click CSV export.

---

## 📄 License
This project is developed for educational and academic demonstration purposes. Released under the MIT License.
