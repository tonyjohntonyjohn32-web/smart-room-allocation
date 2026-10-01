# Smart Room Allocation — User Guide

## College Classroom & Facility Management System

---

## 1. Introduction

The **Smart Room Allocation System** is a full-stack web application designed for academic administrators, department chairs, and faculty members to streamline classroom scheduling, eliminate double-bookings, optimize seating utilization, and generate institutional analytics.

This guide provides illustrated instructions for navigating the portal and executing day-to-day administrative and scheduling tasks.

---

## 2. User Roles & Capabilities

The portal enforces role-based access control (RBAC):

```
┌────────────────────────────────────────────────────────┐
│                   Portal Roles                         │
├──────────────────────────┬─────────────────────────────┤
│      Administrator       │       Faculty Member        │
├──────────────────────────┼─────────────────────────────┤
│ • Full system access     │ • View room catalog         │
│ • Add/Edit/Delete rooms  │ • Check room availability   │
│ • Manage departments     │ • View interactive timetable│
│ • Create allocations     │ • Generate room recommendations
│ • Automated allocations  │ • Inspect class details     │
│ • System settings        │ • Update own password       │
│ • Export all reports     │ • View dashboard analytics  │
└──────────────────────────┴─────────────────────────────┘
```

---

## 3. Getting Started: Logging In

1. Open your browser and navigate to `http://localhost:5000`.
2. If unauthenticated, the portal automatically presents `login.html`.
3. Enter your college email and password, or use the **Demo Buttons** at the bottom of the form:
   - **Admin Demo:** Logs in as Administrator (`admin@college.edu`).
   - **Faculty Demo:** Logs in as Dr. Alan Turing (`faculty.cs@college.edu`).
4. Click **Sign In to Portal**.
5. Upon successful verification, you will be redirected to the main dashboard.

---

## 4. Dashboard Overview

The **Campus Dashboard** gives an immediate snapshot of current facility operations:
- **Total Rooms:** Total physical learning spaces registered in the system.
- **Available Now:** Rooms that currently have no scheduled classes and are not undergoing maintenance.
- **Occupied Now:** Rooms currently hosting active lectures or lab sessions.
- **Total Bookings:** Active confirmed allocations across the academic calendar.
- **Departments:** Active academic departments utilizing facilities.
- **Room Utilization %:** Weighted average of student attendance versus room seating capacity.
- **Visual Charts:** Doughnut chart for live occupancy, bar chart for building usage, and trend line chart for weekly scheduling load.

---

## 5. Room Management (Administrators)

### 5.1 Viewing Facilities
- Select **Rooms Catalog** from the sidebar.
- Switch between **Grid View** (cards with equipment badges) and **Table View** (compact list).
- Use the search bar to filter by room number (`CR-101`), building (`Technology Wing`), or equipment (`Smart Board`).

### 5.2 Adding a New Facility
1. Click **+ Add Room** in the top right.
2. In the modal dialog, fill in:
   - **Room Number:** e.g. `CR-302` (must be unique within the selected building).
   - **Room Name:** e.g. `Advanced Computer Architecture Studio`.
   - **Building & Floor:** e.g. `Technology Wing`, Floor `3`.
   - **Type:** Select from Classroom, Computer Lab, Laboratory, Seminar Hall, Auditorium, Conference Room, or Tutorial Room.
   - **Capacity:** Maximum student seating capacity (must be greater than 0).
   - **Equipment:** Check available hardware (Projector, Smart Board, Computers, AC, Wi-Fi, etc.).
   - **Accessibility:** Select standard or wheelchair/elevator accessibility.
3. Click **Save Room**. The new facility is immediately available for bookings and analytics.

### 5.3 Editing or Deleting a Room
- Click **Edit** on any room card to adjust capacity, status, or equipment.
- Click **Delete** to remove a room. *(Note: The system safely prevents deleting rooms that have active confirmed allocations).*

---

## 6. Room Allocation & Scheduling

### 6.1 Manual Allocation
1. Select **Room Allocation** from the sidebar.
2. Under the **Manual Room Booking** tab, fill out the allocation form:
   - Select Department, Faculty Instructor, Course Subject, and Student Group.
   - Specify Date (`YYYY-MM-DD`), Start Time (`HH:MM`), and End Time (`HH:MM`).
   - Enter Expected Student Count.
   - Select the target room from the dropdown.
3. Click **Create Allocation Record**.
4. **Collision Prevention in Action:**
   - If the room is already booked, or the faculty member is scheduled elsewhere, or expected students exceed the room's capacity, the system displays an alert with the exact conflict details and prevents double booking.
   - Adjacent slots (e.g. 09:00–10:30 and 10:30–12:00) are recognized as valid and allowed.

### 6.2 Intelligent Automated Allocation (Smart Recommendation Engine)
Use the automated recommendation feature to find the best possible facility without manually guessing room availability:
1. Under **Room Allocation**, click the **✨ Smart Automated Allocation** tab.
2. Enter Date, Start Time, End Time, Expected Student Count, and preferred Room Type.
3. Check required equipment (e.g. `[x] Projector`, `[x] Smart Board`).
4. Click **⚡ Calculate & Recommend Best Room**.
5. The algorithm calculates transparent suitability scores (0–100 pts) based on:
   - **Capacity Efficiency:** Penalizes allocating huge auditoriums for small groups.
   - **Equipment Match:** Verifies hardware requirements.
   - **Room Type & Department Alignment.**
   - **Accessibility Compliance.**
6. The top recommendation card displays:
   - Ranked suitability score.
   - Percentage capacity utilization.
   - Clear justification paragraph explaining why this room is recommended.
   - Alternative candidate rooms and score breakdown.
7. Click **✓ Confirm & Allocate** to book the recommended room in one click!

---

## 7. Interactive Timetable Scheduler

1. Select **Timetable** from the sidebar.
2. Use the navigation buttons (**‹ Previous**, **Current Week**, **Next ›**) to move between weeks.
3. View the timetable in **Weekly View** or **Daily View**.
4. Filter by Room, Faculty Member, or Department to isolate specific schedules.
5. Click any colored class box in the matrix to open the **Class Schedule Details** modal showing instructor, course, students, and notes.
6. Click **🖨️ Print Timetable** for an ink-friendly, paper-optimized printout.

---

## 8. Room Availability Search

1. Click **Check Availability** in the sidebar.
2. Enter desired Date, Start Time, End Time, and Minimum Capacity.
3. Click **🔍 Check Availability**.
4. The system evaluates all campus rooms against real-time allocation and maintenance databases.
5. **Green Badges:** Indicate rooms available for immediate use.
6. **Red / Gray Badges:** Indicate occupied facilities with tooltip explanations of ongoing sessions.
7. Administrators can click **Allocate Now** on any available card to automatically populate the booking form.

---

## 9. Reports, Analytics & CSV Export

1. Select **Reports & Analytics** from the sidebar.
2. Choose from the available reports:
   - **Room Utilization:** Compares bookings, student headcount, and seat efficiency.
   - **Department-wise Allocations:** Class distribution across departments.
   - **Building Utilization:** Total rooms and seat efficiency per building.
   - **Unused Rooms:** Highlights rooms with zero bookings during the period.
   - **Facility Maintenance:** Log of active work orders and scheduled maintenance.
   - **Capacity Efficiency & Wastage:** Pinpoints classes allocated into rooms with massive unused seats.
3. Click **Download CSV** to export raw data for spreadsheet analysis in Excel or Google Sheets.
4. Click **🖨️ Print** for clean report printouts.

---

## 10. Account Settings & Password Security

1. Select **Settings** from the sidebar.
2. **Institutional Configuration (Admin only):** Adjust Institution Name, Campus Code, Academic Year, Working Hours (Start/End), and Default Slot Duration.
3. **Change Password:** Enter current password and new password (minimum 6 characters) to update your credentials securely.
