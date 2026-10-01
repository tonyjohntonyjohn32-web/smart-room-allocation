# Step-by-Step Installation & Execution Guide

## Smart Room Allocation — College Classroom & Facility Management System
**Environment Target:** Windows 10 / Windows 11 & Visual Studio Code  
**Runtime:** Node.js v18+ (tested & verified on Node v24.14.0 & npm v11.9.0)

---

## Table of Contents
1. [Prerequisites & Node.js Setup](#1-prerequisites--nodejs-setup)
2. [Opening the Project in VS Code](#2-opening-the-project-in-vs-code)
3. [Installing Project Dependencies](#3-installing-project-dependencies)
4. [Environment Configuration](#4-environment-configuration)
5. [Database Initialization & Seeding](#5-database-initialization--seeding)
6. [Starting the Application](#6-starting-the-application)
7. [Logging In to the System](#7-logging-in-to-the-system)
8. [Guided Feature Walkthrough](#8-guided-feature-walkthrough)
9. [Running Automated Tests](#9-running-automated-tests)
10. [Stopping and Restarting the Server](#10-stopping-and-restarting-the-server)
11. [Troubleshooting Common Issues](#11-troubleshooting-common-issues)

---

## 1. Prerequisites & Node.js Setup

Ensure you have Node.js installed on your Windows PC.

### Step 1.1: Download Node.js
If Node.js is not already installed:
1. Visit the official website: [https://nodejs.org/](https://nodejs.org/)
2. Download the **LTS (Long Term Support)** Windows Installer (`.msi`).
3. Run the installer. On the "Tools for Native Modules" screen, click **Next** (native C++ build tools are **not required** because this system uses Node's zero-compilation built-in SQLite engine).
4. Finish installation.

### Step 1.2: Verify Installation
Open **Windows PowerShell** or **Command Prompt** (cmd) and run:

```powershell
node -v
npm -v
```

**Expected output:**
```text
v20.x.x (or v22.x.x / v24.x.x)
10.x.x (or 11.x.x)
```

---

## 2. Opening the Project in VS Code

1. Launch **Visual Studio Code**.
2. Click **File** > **Open Folder...** (or press `Ctrl + K, Ctrl + O`).
3. Navigate to and select the project root folder:
   ```text
   smart-room-allocation-fullstack
   ```
4. Click **Select Folder**.
5. When prompted *"Do you trust the authors of the files in this folder?"*, click **Yes, I trust the authors**.

---

## 3. Installing Project Dependencies

Open the integrated terminal in VS Code by pressing ``Ctrl + ` `` (Backtick) or clicking **Terminal** > **New Terminal**.

Ensure your terminal prompt shows the project root:
```powershell
# Directory: smart-room-allocation-fullstack
npm run install:all
```

Alternatively, you can install directly inside the `backend` directory:
```powershell
cd backend
npm install
cd ..
```

*Note: The frontend is built using standard ES6+ and modern web APIs, so it requires zero frontend build steps or node_modules.*

---

## 4. Environment Configuration

The application includes pre-configured environment files:
- `backend/.env` (active backend configuration)
- `.env.example` (reference template)

To verify or modify the configuration, inspect `backend/.env`:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_academic_project_2025_change_in_production
JWT_EXPIRES_IN=24h
DB_PATH=./data/rooms.db
CLIENT_URL=http://localhost:5000
```

---

## 5. Database Initialization & Seeding

The application features **automatic, idempotent SQLite database initialization**. When you start the server for the first time, it automatically:
1. Creates the SQLite database file at `backend/data/rooms.db`.
2. Sets up all 6 relational tables and performance indexes.
3. Seeds default academic departments, faculty accounts, classroom facilities, and sample allocations.

### Manual Database Commands (Optional):
If you ever want to re-seed or wipe the database:
```powershell
# In PowerShell or Command Prompt from the project root:
npm run db:reset   # Resets all tables and inserts fresh demo data
npm run db:seed    # Inserts sample data only if tables are currently empty
```

---

## 6. Starting the Application

The Express backend serves the API endpoints as well as the static web dashboard interface from a single port (`5000`).

In the VS Code terminal, run:
```powershell
npm start
```

You will see:
```text
=======================================================
 Smart Room Allocation System Backend Running!
 Local API URL:      http://localhost:5000/api/health
 Web Application:    http://localhost:5000
 Environment:        development
=======================================================
```

Now open your web browser (Chrome, Edge, Firefox, or Brave) and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)** (or `http://localhost:5000/login.html`)

---

## 7. Logging In to the System

The login page provides **1-Click Development Demo Buttons** for convenience:

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@college.edu` | `Admin@123` | Full access: Add/Edit/Delete Rooms, Manual & Auto Allocations, Departments, Reports, Settings |
| **Faculty Member** | `faculty.cs@college.edu` | `Faculty@123` | View Rooms, Inspect Timetables, Search Availability, Generate Room Recommendations |

### Alternative Faculty Accounts:
- Dr. Alan Turing: `faculty.cs@college.edu` / `Faculty@123`
- Prof. Ada Lovelace: `ada.lovelace@college.edu` / `Faculty@123`
- Dr. Nikola Tesla: `faculty.ece@college.edu` / `Faculty@123`
- Dr. James Watt: `faculty.mech@college.edu` / `Faculty@123`
- Prof. Marie Curie: `faculty.sci@college.edu` / `Faculty@123`

---

## 8. Guided Feature Walkthrough

### Feature 1: Dashboard Analytics
1. Navigate to **Dashboard** in the sidebar.
2. Observe the 6 real-time KPI summary cards (Total Rooms, Available, Occupied, Total Bookings, Departments, Room Utilization %).
3. Inspect the 4 interactive Chart.js visualizations:
   - Live Room Occupancy Distribution (Doughnut)
   - Building Facilities & Allocations (Bar Chart)
   - Allocation Share by Department (Bar Chart)
   - Weekly Scheduling Load (Line Chart)
4. Check the **Recent Allocations** and **Upcoming Classes Today** panels.

### Feature 2: Classrooms & Facility Management
1. Click **Rooms Catalog** in the sidebar.
2. Switch between **Grid View** and **Table View** using the toggle in the upper right.
3. Use the search bar to find rooms by number (`CR-101`), name (`Lab`), or equipment (`Projector`).
4. Filter by Building, Room Type (Classroom, Computer Lab, Seminar Hall, Auditorium), and Status.
5. Click **Details** on any room card to open the room modal and see its equipment and scheduled classes.
6. As Administrator, click **+ Add Room** to add a new facility, fill the form, and save.

### Feature 3: Smart Automated Room Allocation
1. Click **Room Allocation** in the sidebar.
2. Click the tab **✨ Smart Automated Allocation**.
3. Select a Date, Start Time (`14:00`), End Time (`15:30`), and Student Count (`42`).
4. Check equipment options: `[x] Projector`, `[x] Smart Board`, `[x] Wi-Fi`.
5. Enter Subject (`AI-502 Deep Learning Lab`) and Group (`CS-A`).
6. Click **Calculate & Recommend Best Room**.
7. Observe the recommendation output:
   - Transparent suitability score (e.g. `96/100`).
   - Detailed score breakdown (Capacity fit, equipment match, room type suitability, department affiliation).
   - Clear explanation paragraph describing why this room is ideal.
   - List of alternative rooms.
   - Log of excluded rooms (rooms with ongoing classes or under-capacity).
8. Click **✓ Confirm & Allocate** to instantly book the room with zero conflict risk!

### Feature 4: Conflict Prevention Verification
1. Click the **Manual Room Booking** tab.
2. Select the same room you just allocated (e.g. `CR-101`) for the exact same date.
3. Select an overlapping time slot (e.g. `14:30 - 16:00`).
4. Submit the form.
5. Notice that the system rejects the booking with an explicit error toast:
   > *"Room CR-101 is already booked from 14:00 to 15:30 for AI-502 Deep Learning Lab"*
6. Now change the start time to `15:30` (adjacent non-overlapping slot).
7. Submit the form: **The booking succeeds!**

### Feature 5: Multi-View Timetable Scheduler
1. Click **Timetable** in the sidebar.
2. Toggle between **Weekly View** and **Daily View**.
3. Use **‹ Previous** and **Next ›** to browse weeks.
4. Filter by Room, Faculty, or Department.
5. Click on any color-coded course card in the matrix to view the pop-up modal with complete class details.
6. Click **🖨️ Print Timetable** to see the clean, formatted printable view.
7. Click **Download CSV** to export the schedule to Excel/Sheets.

### Feature 6: Room Availability Search
1. Click **Check Availability** in the sidebar.
2. Enter desired date, time window, and required seating.
3. Click **Check Availability**.
4. Green cards represent free rooms; gray/amber cards show occupied rooms with conflict explanations.
5. Click **Allocate Now** on any available card to pre-populate the allocation form immediately.

### Feature 7: Institutional Reports & CSV Export
1. Click **Reports & Analytics** in the sidebar.
2. Select from the 6 report modes:
   - Room Utilization Report
   - Department-wise Allocation Report
   - Building Utilization Report
   - Unused Rooms Report
   - Facility Maintenance Report
   - Capacity Efficiency & Wastage Report
3. Click **Download CSV** to export raw data.

---

## 9. Running Automated Tests

The project includes an automated test suite verifying Authentication, Room Management, Conflict Prevention, and the Recommendation Engine.

In your VS Code terminal:
```powershell
npm test
```

### Expected Output:
```text
PASS tests/allocations.test.js
PASS tests/rooms.test.js
PASS tests/auth.test.js

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        ~25 s
Ran all test suites.
```

---

## 10. Stopping and Restarting the Server

- **To Stop the Server:** Click in the terminal running the server and press `Ctrl + C`. Type `Y` and press Enter if prompted.
- **To Restart the Server:** Simply run `npm start` again. All data created during your session remains safely persisted in `backend/data/rooms.db`.

---

## 11. Troubleshooting Common Issues

### Issue 1: `'node' is not recognized as an internal or external command`
- **Cause:** Node.js is not added to your Windows system PATH environment variable.
- **Solution:** 
  1. Close and reopen VS Code / PowerShell after installing Node.js.
  2. If still not working, open Windows Start Menu, search for **Environment Variables**, edit `Path` under User Variables, and add `C:\Program Files\nodejs\`.

### Issue 2: `Error: listen EADDRINUSE: address already in use :::5000`
- **Cause:** Another process or previous node instance is currently using port 5000.
- **Solution (PowerShell):**
  ```powershell
  # Find and terminate process on port 5000:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  ```
- **Solution (Command Prompt):**
  ```cmd
  for /f "tokens=5" %a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %a
  ```
  Or change `PORT=5001` in `backend/.env`.

### Issue 3: `Database is locked` error
- **Cause:** Multiple write processes attempting concurrent transactions without closing connections.
- **Solution:** The database uses SQLite `WAL` mode and immediate transactions. If a lock occurs during test runs, restart the server with `npm start`.

### Issue 4: `Failed to fetch` or Network Error in Browser
- **Cause:** The backend server is not running, or browser security blocked the request.
- **Solution:** Ensure `npm start` is active in the terminal and you are visiting `http://localhost:5000`.

### Issue 5: PowerShell Execution Policy Warning (`running scripts is disabled on this system`)
- **Cause:** Windows PowerShell restricts running `.ps1` scripts by default.
- **Solution:** Run PowerShell as Administrator and execute:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
