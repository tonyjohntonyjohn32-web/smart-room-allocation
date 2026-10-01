const { db } = require('../db');

// Distinct visual palette for course categories
const SUBJECT_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' }, // Blue
  { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' }, // Green
  { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce' }, // Purple
  { bg: '#fff7ed', border: '#f97316', text: '#c2410c' }, // Orange
  { bg: '#fdf2f8', border: '#ec4899', text: '#be185d' }, // Pink
  { bg: '#ecfeff', border: '#06b6d4', text: '#0e7490' }, // Cyan
  { bg: '#fefce8', border: '#eab308', text: '#a16207' }  // Yellow
];

function getSubjectColor(subject) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[index];
}

/**
 * Get general timetable data supporting daily, weekly, monthly views
 */
exports.getTimetable = (req, res, next) => {
  try {
    const {
      view = 'weekly',
      date = new Date().toISOString().split('T')[0],
      room_id,
      faculty_id,
      department_id,
      building
    } = req.query;

    const baseDate = new Date(date);
    let startDateStr = date;
    let endDateStr = date;

    if (view === 'weekly') {
      // Find Monday of the current week
      const currentDay = baseDate.getDay();
      const diffToMonday = baseDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
      const monday = new Date(baseDate.setDate(diffToMonday));
      startDateStr = monday.toISOString().split('T')[0];

      const saturday = new Date(monday);
      saturday.setDate(saturday.getDate() + 5); // Monday to Saturday
      endDateStr = saturday.toISOString().split('T')[0];
    } else if (view === 'monthly') {
      const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      startDateStr = firstDay.toISOString().split('T')[0];
      endDateStr = lastDay.toISOString().split('T')[0];
    }

    let sql = `
      SELECT a.*,
             r.room_number, r.room_name, r.building, r.capacity as room_capacity, r.room_type,
             d.name as department_name, d.code as department_code,
             u.name as faculty_name, u.email as faculty_email
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.faculty_id = u.id
      WHERE a.status = 'confirmed'
        AND a.allocation_date >= ?
        AND a.allocation_date <= ?
    `;
    const params = [startDateStr, endDateStr];

    if (room_id) {
      sql += ` AND a.room_id = ?`;
      params.push(Number(room_id));
    }

    if (faculty_id) {
      sql += ` AND a.faculty_id = ?`;
      params.push(Number(faculty_id));
    }

    if (department_id) {
      sql += ` AND a.department_id = ?`;
      params.push(Number(department_id));
    }

    if (building) {
      sql += ` AND r.building = ?`;
      params.push(building);
    }

    sql += ` ORDER BY a.allocation_date ASC, a.start_time ASC`;

    const allocations = db.query(sql, ...params);

    // Decorate with color styling
    const styledAllocations = allocations.map(item => ({
      ...item,
      color: getSubjectColor(item.subject)
    }));

    // Retrieve active maintenance in this range
    const maintenance = db.query(`
      SELECT m.*, r.room_number, r.room_name, r.building
      FROM maintenance m
      JOIN rooms r ON m.room_id = r.id
      WHERE m.status != 'completed'
        AND m.start_date <= ?
        AND m.end_date >= ?
    `, endDateStr, startDateStr);

    res.json({
      success: true,
      meta: {
        view,
        currentDate: date,
        startDate: startDateStr,
        endDate: endDateStr,
        totalEntries: styledAllocations.length
      },
      allocations: styledAllocations,
      maintenance
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get timetable specifically for a room
 */
exports.getRoomTimetable = (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { start_date, end_date } = req.query;

    const room = db.get('SELECT * FROM rooms WHERE id = ?', roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    let sql = `
      SELECT a.*,
             d.name as department_name, d.code as department_code,
             u.name as faculty_name, u.email as faculty_email
      FROM allocations a
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.faculty_id = u.id
      WHERE a.room_id = ? AND a.status = 'confirmed'
    `;
    const params = [roomId];

    if (start_date) {
      sql += ` AND a.allocation_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND a.allocation_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY a.allocation_date ASC, a.start_time ASC`;

    const allocations = db.query(sql, ...params).map(a => ({
      ...a,
      color: getSubjectColor(a.subject)
    }));

    res.json({
      success: true,
      room,
      allocations
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get timetable specifically for a faculty member
 */
exports.getFacultyTimetable = (req, res, next) => {
  try {
    const { facultyId } = req.params;
    const { start_date, end_date } = req.query;

    const faculty = db.get('SELECT id, name, email, department_id FROM users WHERE id = ?', facultyId);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty member not found.' });
    }

    let sql = `
      SELECT a.*,
             r.room_number, r.room_name, r.building,
             d.name as department_name, d.code as department_code
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.faculty_id = ? AND a.status = 'confirmed'
    `;
    const params = [facultyId];

    if (start_date) {
      sql += ` AND a.allocation_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND a.allocation_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY a.allocation_date ASC, a.start_time ASC`;

    const allocations = db.query(sql, ...params).map(a => ({
      ...a,
      color: getSubjectColor(a.subject)
    }));

    res.json({
      success: true,
      faculty,
      allocations
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get timetable specifically for a department
 */
exports.getDepartmentTimetable = (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const { start_date, end_date } = req.query;

    const department = db.get('SELECT * FROM departments WHERE id = ?', departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    let sql = `
      SELECT a.*,
             r.room_number, r.room_name, r.building,
             u.name as faculty_name, u.email as faculty_email
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN users u ON a.faculty_id = u.id
      WHERE a.department_id = ? AND a.status = 'confirmed'
    `;
    const params = [departmentId];

    if (start_date) {
      sql += ` AND a.allocation_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND a.allocation_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY a.allocation_date ASC, a.start_time ASC`;

    const allocations = db.query(sql, ...params).map(a => ({
      ...a,
      color: getSubjectColor(a.subject)
    }));

    res.json({
      success: true,
      department,
      allocations
    });
  } catch (err) {
    next(err);
  }
};
