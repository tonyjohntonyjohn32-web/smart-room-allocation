const { db } = require('../db');
const conflictService = require('../services/conflictService');
const allocationService = require('../services/allocationService');
const { isValidDateFormat, isValidTimeFormat, isStartBeforeEnd, isValidPositiveInt } = require('../utils/validators');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get allocations with comprehensive filtering, search, and pagination
 */
exports.getAllAllocations = (req, res, next) => {
  try {
    const {
      search,
      room_id,
      department_id,
      faculty_id,
      date,
      start_date,
      end_date,
      status,
      academic_year,
      semester,
      page = 1,
      limit = 50
    } = req.query;

    let sql = `
      SELECT a.*,
             r.room_number, r.room_name, r.building, r.capacity as room_capacity, r.room_type,
             d.name as department_name, d.code as department_code,
             u.name as faculty_name, u.email as faculty_email,
             creator.name as creator_name
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.faculty_id = u.id
      LEFT JOIN users creator ON a.created_by = creator.id
      WHERE 1=1
    `;
    const params = [];

    // If logged-in user is faculty and not querying for all, they can see all allocations or filter by their own
    if (req.user && req.user.role === 'faculty' && req.query.mine_only === 'true') {
      sql += ` AND a.faculty_id = ?`;
      params.push(req.user.id);
    } else if (faculty_id) {
      sql += ` AND a.faculty_id = ?`;
      params.push(Number(faculty_id));
    }

    if (search) {
      sql += ` AND (a.subject LIKE ? OR a.student_group LIKE ? OR r.room_number LIKE ? OR u.name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (room_id) {
      sql += ` AND a.room_id = ?`;
      params.push(Number(room_id));
    }

    if (department_id) {
      sql += ` AND a.department_id = ?`;
      params.push(Number(department_id));
    }

    if (date) {
      sql += ` AND a.allocation_date = ?`;
      params.push(date);
    } else {
      if (start_date) {
        sql += ` AND a.allocation_date >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND a.allocation_date <= ?`;
        params.push(end_date);
      }
    }

    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }

    if (academic_year) {
      sql += ` AND a.academic_year = ?`;
      params.push(academic_year);
    }

    if (semester) {
      sql += ` AND a.semester = ?`;
      params.push(semester);
    }

    sql += ` ORDER BY a.allocation_date DESC, a.start_time ASC`;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
    const countResult = db.query(countSql, ...params);
    const total = countResult[0] ? countResult[0].count : 0;

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const allocations = db.query(sql, ...params);

    res.json({
      success: true,
      allocations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get allocation by ID
 */
exports.getAllocationById = (req, res, next) => {
  try {
    const { id } = req.params;

    const allocation = db.get(`
      SELECT a.*,
             r.room_number, r.room_name, r.building, r.capacity as room_capacity, r.room_type, r.equipment,
             d.name as department_name, d.code as department_code,
             u.name as faculty_name, u.email as faculty_email,
             creator.name as creator_name
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.faculty_id = u.id
      LEFT JOIN users creator ON a.created_by = creator.id
      WHERE a.id = ?
    `, id);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation record not found.'
      });
    }

    try {
      allocation.equipment = JSON.parse(allocation.equipment || '[]');
    } catch (e) {
      allocation.equipment = [];
    }

    res.json({
      success: true,
      allocation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new room allocation with transactional conflict verification
 */
exports.createAllocation = (req, res, next) => {
  try {
    const {
      room_id,
      department_id,
      faculty_id,
      subject,
      academic_year,
      semester,
      student_group,
      allocation_date,
      start_time,
      end_time,
      expected_students,
      notes
    } = req.body;

    // 1. Mandatory fields validation
    if (!room_id || !department_id || !faculty_id || !subject || !academic_year ||
        !semester || !student_group || !allocation_date || !start_time || !end_time || !expected_students) {
      return res.status(400).json({
        success: false,
        message: 'All allocation fields (room, department, faculty, subject, year, semester, student group, date, start time, end time, expected students) are required.'
      });
    }

    if (!isValidPositiveInt(expected_students)) {
      return res.status(400).json({
        success: false,
        message: 'Expected students must be a positive integer.'
      });
    }

    // 2. Conflict Verification
    const conflictCheck = conflictService.checkConflicts({
      roomId: parseInt(room_id, 10),
      facultyId: parseInt(faculty_id, 10),
      date: allocation_date,
      startTime: start_time,
      endTime: end_time,
      expectedStudents: parseInt(expected_students, 10)
    });

    if (conflictCheck.hasConflict) {
      return res.status(409).json({
        success: false,
        message: conflictCheck.conflicts[0].message,
        conflicts: conflictCheck.conflicts
      });
    }

    // Determine day of the week
    const dateObj = new Date(allocation_date);
    const dayOfWeek = DAYS[dateObj.getDay()];

    // 3. Insert allocation inside an immediate transaction
    const newAllocation = db.transaction((tx) => {
      // Re-verify inside transaction to prevent race conditions
      const doubleCheck = tx.query(`
        SELECT id FROM allocations
        WHERE room_id = ? AND allocation_date = ? AND status = 'confirmed'
          AND start_time < ? AND end_time > ?
      `, room_id, allocation_date, end_time, start_time);

      if (doubleCheck.length > 0) {
        throw new Error('Room was just booked by a concurrent request. Please choose another time or room.');
      }

      const result = tx.run(`
        INSERT INTO allocations (
          room_id, department_id, faculty_id, subject, academic_year,
          semester, student_group, allocation_date, day_of_week, start_time,
          end_time, expected_students, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      `,
        parseInt(room_id, 10),
        parseInt(department_id, 10),
        parseInt(faculty_id, 10),
        subject.trim(),
        academic_year.trim(),
        semester.trim(),
        student_group.trim(),
        allocation_date,
        dayOfWeek,
        start_time.trim(),
        end_time.trim(),
        parseInt(expected_students, 10),
        notes ? notes.trim() : null,
        req.user ? req.user.id : null
      );

      return tx.get('SELECT * FROM allocations WHERE id = ?', result.lastInsertRowid);
    });

    res.status(201).json({
      success: true,
      message: 'Room allocated successfully.',
      allocation: newAllocation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing allocation
 */
exports.updateAllocation = (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.get('SELECT * FROM allocations WHERE id = ?', id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found.'
      });
    }

    const {
      room_id = existing.room_id,
      department_id = existing.department_id,
      faculty_id = existing.faculty_id,
      subject = existing.subject,
      academic_year = existing.academic_year,
      semester = existing.semester,
      student_group = existing.student_group,
      allocation_date = existing.allocation_date,
      start_time = existing.start_time,
      end_time = existing.end_time,
      expected_students = existing.expected_students,
      status = existing.status,
      notes = existing.notes
    } = req.body;

    if (status === 'confirmed') {
      const conflictCheck = conflictService.checkConflicts({
        roomId: parseInt(room_id, 10),
        facultyId: parseInt(faculty_id, 10),
        date: allocation_date,
        startTime: start_time,
        endTime: end_time,
        expectedStudents: parseInt(expected_students, 10),
        excludeAllocationId: parseInt(id, 10)
      });

      if (conflictCheck.hasConflict) {
        return res.status(409).json({
          success: false,
          message: conflictCheck.conflicts[0].message,
          conflicts: conflictCheck.conflicts
        });
      }
    }

    const dateObj = new Date(allocation_date);
    const dayOfWeek = DAYS[dateObj.getDay()];

    db.run(`
      UPDATE allocations SET
        room_id = ?,
        department_id = ?,
        faculty_id = ?,
        subject = ?,
        academic_year = ?,
        semester = ?,
        student_group = ?,
        allocation_date = ?,
        day_of_week = ?,
        start_time = ?,
        end_time = ?,
        expected_students = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      parseInt(room_id, 10),
      parseInt(department_id, 10),
      parseInt(faculty_id, 10),
      subject.trim(),
      academic_year.trim(),
      semester.trim(),
      student_group.trim(),
      allocation_date,
      dayOfWeek,
      start_time,
      end_time,
      parseInt(expected_students, 10),
      status,
      notes ? notes.trim() : null,
      id
    );

    const updated = db.get('SELECT * FROM allocations WHERE id = ?', id);

    res.json({
      success: true,
      message: 'Allocation updated successfully.',
      allocation: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel or delete an allocation
 */
exports.deleteAllocation = (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard_delete = false } = req.query;

    const existing = db.get('SELECT * FROM allocations WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found.'
      });
    }

    if (hard_delete === 'true') {
      db.run('DELETE FROM allocations WHERE id = ?', id);
      return res.json({
        success: true,
        message: 'Allocation record permanently deleted.'
      });
    }

    // Soft delete: mark cancelled
    db.run("UPDATE allocations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);

    res.json({
      success: true,
      message: 'Allocation cancelled successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Intelligent Room Recommendation Endpoint
 */
exports.recommendRoom = (req, res, next) => {
  try {
    const {
      date,
      start_time,
      end_time,
      expected_students,
      room_type,
      required_equipment,
      department_id,
      building,
      require_accessibility
    } = req.body;

    if (!date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'date, start_time, and end_time are required to recommend a room.'
      });
    }

    const recommendationResult = allocationService.recommendRoom({
      date,
      startTime: start_time,
      endTime: end_time,
      expectedStudents: parseInt(expected_students, 10) || 1,
      roomType: room_type || null,
      requiredEquipment: required_equipment || [],
      departmentId: department_id ? parseInt(department_id, 10) : null,
      building: building || null,
      requireAccessibility: require_accessibility === true || require_accessibility === 'true'
    });

    res.json({
      success: true,
      ...recommendationResult
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Auto-Allocate endpoint (Allocates top recommended room in 1 click)
 */
exports.autoAllocate = (req, res, next) => {
  try {
    const {
      date,
      start_time,
      end_time,
      expected_students,
      room_type,
      required_equipment,
      department_id,
      faculty_id,
      subject,
      academic_year,
      semester,
      student_group,
      notes
    } = req.body;

    if (!faculty_id || !subject || !student_group || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Faculty, department, subject, and student group are required for automated allocation.'
      });
    }

    const recommendation = allocationService.recommendRoom({
      date,
      startTime: start_time,
      endTime: end_time,
      expectedStudents: parseInt(expected_students, 10) || 1,
      roomType: room_type || null,
      requiredEquipment: required_equipment || [],
      departmentId: parseInt(department_id, 10)
    });

    if (!recommendation.recommended) {
      return res.status(409).json({
        success: false,
        message: 'Automated allocation failed: No suitable room is available meeting all criteria.',
        details: recommendation
      });
    }

    const selectedRoom = recommendation.recommended.room;

    // Check faculty conflict
    const facultyConflict = conflictService.checkConflicts({
      roomId: selectedRoom.id,
      facultyId: parseInt(faculty_id, 10),
      date,
      startTime: start_time,
      endTime: end_time,
      expectedStudents: parseInt(expected_students, 10)
    });

    if (facultyConflict.hasConflict) {
      return res.status(409).json({
        success: false,
        message: facultyConflict.conflicts[0].message,
        conflicts: facultyConflict.conflicts
      });
    }

    const dateObj = new Date(date);
    const dayOfWeek = DAYS[dateObj.getDay()];

    const allocResult = db.run(`
      INSERT INTO allocations (
        room_id, department_id, faculty_id, subject, academic_year,
        semester, student_group, allocation_date, day_of_week, start_time,
        end_time, expected_students, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
    `,
      selectedRoom.id,
      parseInt(department_id, 10),
      parseInt(faculty_id, 10),
      subject.trim(),
      academic_year || '2025-2026',
      semester || 'Current Semester',
      student_group.trim(),
      date,
      dayOfWeek,
      start_time,
      end_time,
      parseInt(expected_students, 10) || 1,
      `[AUTO-ALLOCATED] ${notes ? notes.trim() : ''}`,
      req.user ? req.user.id : null
    );

    const created = db.get('SELECT * FROM allocations WHERE id = ?', allocResult.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: `Successfully allocated Room ${selectedRoom.room_number} (${selectedRoom.room_name}).`,
      allocation: created,
      recommendationInfo: recommendation.recommended
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Check conflicts endpoint (preview conflicts without booking)
 */
exports.checkConflicts = (req, res, next) => {
  try {
    const { room_id, faculty_id, date, start_time, end_time, expected_students, exclude_id } = req.query;

    if (!room_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'room_id, date, start_time, and end_time are required.'
      });
    }

    const result = conflictService.checkConflicts({
      roomId: parseInt(room_id, 10),
      facultyId: faculty_id ? parseInt(faculty_id, 10) : null,
      date,
      startTime: start_time,
      endTime: end_time,
      expectedStudents: expected_students ? parseInt(expected_students, 10) : 0,
      excludeAllocationId: exclude_id ? parseInt(exclude_id, 10) : null
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};
