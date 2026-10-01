const { db } = require('../db');

/**
 * Helper to convert array of objects to CSV string
 */
function convertToCSV(data, fields) {
  if (!data || data.length === 0) return '';
  const headers = fields.map(f => `"${f.label || f.key}"`).join(',');
  const rows = data.map(item => {
    return fields.map(f => {
      let val = item[f.key];
      if (val === null || val === undefined) val = '';
      if (typeof val === 'object') val = JSON.stringify(val);
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });
  return [headers, ...rows].join('\r\n');
}

/**
 * 1. Room utilization report
 */
exports.getRoomUtilizationReport = (req, res, next) => {
  try {
    const { start_date, end_date, building, room_type } = req.query;

    let sql = `
      SELECT r.id, r.room_number, r.room_name, r.building, r.room_type, r.capacity, r.status,
             COUNT(a.id) as total_bookings,
             COALESCE(SUM(a.expected_students), 0) as total_student_attendees,
             ROUND(AVG(CAST(COALESCE(a.expected_students, 0) AS REAL) / r.capacity) * 100) as avg_seat_utilization
      FROM rooms r
      LEFT JOIN allocations a ON r.id = a.room_id AND a.status = 'confirmed'
    `;
    const params = [];

    if (start_date) {
      sql += ` AND a.allocation_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND a.allocation_date <= ?`;
      params.push(end_date);
    }

    sql += ` WHERE 1=1`;
    if (building) {
      sql += ` AND r.building = ?`;
      params.push(building);
    }
    if (room_type) {
      sql += ` AND r.room_type = ?`;
      params.push(room_type);
    }

    sql += ` GROUP BY r.id ORDER BY avg_seat_utilization DESC, total_bookings DESC`;

    const report = db.query(sql, ...params);

    res.json({
      success: true,
      reportName: 'Room Utilization Report',
      generatedAt: new Date().toISOString(),
      data: report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Department-wise allocation report
 */
exports.getDepartmentAllocationsReport = (req, res, next) => {
  try {
    const { academic_year, semester } = req.query;

    let sql = `
      SELECT d.id, d.name as department_name, d.code as department_code,
             COUNT(a.id) as total_allocations,
             COUNT(DISTINCT a.room_id) as distinct_rooms_used,
             COUNT(DISTINCT a.faculty_id) as faculty_active,
             COALESCE(SUM(a.expected_students), 0) as total_students_scheduled
      FROM departments d
      LEFT JOIN allocations a ON d.id = a.department_id AND a.status = 'confirmed'
    `;
    const params = [];

    if (academic_year) {
      sql += ` AND a.academic_year = ?`;
      params.push(academic_year);
    }
    if (semester) {
      sql += ` AND a.semester = ?`;
      params.push(semester);
    }

    sql += ` GROUP BY d.id ORDER BY total_allocations DESC`;

    const report = db.query(sql, ...params);

    res.json({
      success: true,
      reportName: 'Department Allocations Report',
      generatedAt: new Date().toISOString(),
      data: report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Building-wise utilization report
 */
exports.getBuildingUtilizationReport = (req, res, next) => {
  try {
    const report = db.query(`
      SELECT r.building,
             COUNT(DISTINCT r.id) as total_rooms,
             SUM(r.capacity) as total_seat_capacity,
             COUNT(a.id) as total_allocations,
             ROUND(AVG(CAST(COALESCE(a.expected_students, 0) AS REAL) / r.capacity) * 100) as avg_seat_efficiency
      FROM rooms r
      LEFT JOIN allocations a ON r.id = a.room_id AND a.status = 'confirmed'
      GROUP BY r.building
      ORDER BY total_allocations DESC
    `);

    res.json({
      success: true,
      reportName: 'Building Utilization Report',
      generatedAt: new Date().toISOString(),
      data: report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Unused Rooms report
 */
exports.getUnusedRoomsReport = (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const sDate = start_date || today;

    const report = db.query(`
      SELECT r.*, d.name as department_name, d.code as department_code
      FROM rooms r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE r.status != 'inactive'
        AND r.id NOT IN (
          SELECT DISTINCT room_id FROM allocations
          WHERE status = 'confirmed'
            AND allocation_date >= ?
            ${end_date ? 'AND allocation_date <= ?' : ''}
        )
      ORDER BY r.building ASC, r.room_number ASC
    `, ...(end_date ? [sDate, end_date] : [sDate]));

    res.json({
      success: true,
      reportName: 'Unused Rooms Report',
      generatedAt: new Date().toISOString(),
      unusedCount: report.length,
      data: report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Maintenance report
 */
exports.getMaintenanceReport = (req, res, next) => {
  try {
    const report = db.query(`
      SELECT m.*, r.room_number, r.room_name, r.building, r.room_type,
             d.name as department_name
      FROM maintenance m
      JOIN rooms r ON m.room_id = r.id
      LEFT JOIN departments d ON r.department_id = d.id
      ORDER BY m.start_date DESC
    `);

    res.json({
      success: true,
      reportName: 'Facility Maintenance Report',
      generatedAt: new Date().toISOString(),
      totalRecords: report.length,
      data: report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Capacity Utilization & Efficiency Report
 */
exports.getCapacityEfficiencyReport = (req, res, next) => {
  try {
    const report = db.query(`
      SELECT a.id, a.subject, a.student_group, a.allocation_date, a.start_time, a.end_time,
             a.expected_students, r.room_number, r.room_name, r.capacity,
             (r.capacity - a.expected_students) as unused_seats,
             ROUND((CAST(a.expected_students AS REAL) / r.capacity) * 100, 1) as utilization_pct,
             u.name as faculty_name, d.code as department_code
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN users u ON a.faculty_id = u.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.status = 'confirmed'
      ORDER BY utilization_pct ASC
    `);

    res.json({
      success: true,
      reportName: 'Capacity Efficiency & Wastage Report',
      generatedAt: new Date().toISOString(),
      data: report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. Export Data to CSV
 */
exports.exportCSV = (req, res, next) => {
  try {
    const { type = 'allocations' } = req.query;

    let csvData = '';
    let filename = `export_${type}_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'allocations') {
      const rows = db.query(`
        SELECT a.id, a.allocation_date, a.day_of_week, a.start_time, a.end_time,
               a.subject, a.student_group, a.expected_students, a.status,
               r.room_number, r.building, r.room_type, r.capacity as room_capacity,
               d.code as department, u.name as faculty_name
        FROM allocations a
        JOIN rooms r ON a.room_id = r.id
        JOIN departments d ON a.department_id = d.id
        JOIN users u ON a.faculty_id = u.id
        ORDER BY a.allocation_date DESC, a.start_time ASC
      `);

      const fields = [
        { key: 'id', label: 'ID' },
        { key: 'allocation_date', label: 'Date' },
        { key: 'day_of_week', label: 'Day' },
        { key: 'start_time', label: 'Start Time' },
        { key: 'end_time', label: 'End Time' },
        { key: 'room_number', label: 'Room' },
        { key: 'building', label: 'Building' },
        { key: 'room_type', label: 'Room Type' },
        { key: 'room_capacity', label: 'Capacity' },
        { key: 'subject', label: 'Subject / Course' },
        { key: 'faculty_name', label: 'Faculty' },
        { key: 'department', label: 'Department' },
        { key: 'student_group', label: 'Group' },
        { key: 'expected_students', label: 'Expected Students' },
        { key: 'status', label: 'Status' }
      ];

      csvData = convertToCSV(rows, fields);
    } else if (type === 'rooms') {
      const rows = db.query(`
        SELECT r.id, r.room_number, r.room_name, r.building, r.floor, r.room_type,
               r.capacity, r.accessibility, r.status, d.name as department_name, r.equipment
        FROM rooms r
        LEFT JOIN departments d ON r.department_id = d.id
        ORDER BY r.room_number ASC
      `);

      const fields = [
        { key: 'id', label: 'ID' },
        { key: 'room_number', label: 'Room Number' },
        { key: 'room_name', label: 'Name' },
        { key: 'building', label: 'Building' },
        { key: 'floor', label: 'Floor' },
        { key: 'room_type', label: 'Type' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'accessibility', label: 'Accessibility' },
        { key: 'status', label: 'Status' },
        { key: 'department_name', label: 'Department' },
        { key: 'equipment', label: 'Equipment' }
      ];

      csvData = convertToCSV(rows, fields);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
  } catch (err) {
    next(err);
  }
};
