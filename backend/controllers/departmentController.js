const { db } = require('../db');

/**
 * Get all departments with aggregated statistics
 */
exports.getAllDepartments = (req, res, next) => {
  try {
    const departments = db.query(`
      SELECT d.*,
             (SELECT COUNT(*) FROM rooms r WHERE r.department_id = d.id) as room_count,
             (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'faculty') as faculty_count,
             (SELECT COUNT(*) FROM allocations a WHERE a.department_id = d.id AND a.status = 'confirmed') as active_allocations
      FROM departments d
      ORDER BY d.name ASC
    `);

    res.json({
      success: true,
      departments
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get department by ID
 */
exports.getDepartmentById = (req, res, next) => {
  try {
    const { id } = req.params;

    const department = db.get('SELECT * FROM departments WHERE id = ?', id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    const rooms = db.query('SELECT * FROM rooms WHERE department_id = ? ORDER BY room_number ASC', id);
    const faculty = db.query("SELECT id, name, email FROM users WHERE department_id = ? AND role = 'faculty' AND is_active = 1", id);
    const allocations = db.query(`
      SELECT a.*, r.room_number, r.room_name, u.name as faculty_name
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN users u ON a.faculty_id = u.id
      WHERE a.department_id = ? AND a.status = 'confirmed'
      ORDER BY a.allocation_date DESC, a.start_time ASC
      LIMIT 20
    `, id);

    res.json({
      success: true,
      department,
      rooms,
      faculty,
      allocations
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create department
 */
exports.createDepartment = (req, res, next) => {
  try {
    const { name, code, head_name, email, phone, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Department name and unique department code are required.'
      });
    }

    const existingCode = db.get('SELECT id FROM departments WHERE LOWER(code) = LOWER(?)', code.trim());
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Department with code "${code}" already exists.`
      });
    }

    const result = db.run(`
      INSERT INTO departments (name, code, head_name, email, phone, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      name.trim(),
      code.trim().toUpperCase(),
      head_name ? head_name.trim() : null,
      email ? email.trim() : null,
      phone ? phone.trim() : null,
      description ? description.trim() : null
    );

    const newDept = db.get('SELECT * FROM departments WHERE id = ?', result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      department: newDept
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update department
 */
exports.updateDepartment = (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, head_name, email, phone, description } = req.body;

    const existing = db.get('SELECT * FROM departments WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    if (code) {
      const codeCheck = db.get('SELECT id FROM departments WHERE LOWER(code) = LOWER(?) AND id != ?', code.trim(), id);
      if (codeCheck) {
        return res.status(400).json({
          success: false,
          message: `Another department already uses code "${code}".`
        });
      }
    }

    db.run(`
      UPDATE departments SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        head_name = COALESCE(?, head_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        description = COALESCE(?, description)
      WHERE id = ?
    `,
      name ? name.trim() : null,
      code ? code.trim().toUpperCase() : null,
      head_name !== undefined ? head_name : null,
      email !== undefined ? email : null,
      phone !== undefined ? phone : null,
      description !== undefined ? description : null,
      id
    );

    const updated = db.get('SELECT * FROM departments WHERE id = ?', id);

    res.json({
      success: true,
      message: 'Department updated successfully.',
      department: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete department safely
 */
exports.deleteDepartment = (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = db.get('SELECT * FROM departments WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    // Safety checks
    const activeRooms = db.query('SELECT id FROM rooms WHERE department_id = ?', id);
    if (activeRooms.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department "${existing.name}". It is associated with ${activeRooms.length} room(s). Reassign or detach these rooms first.`
      });
    }

    const activeAllocations = db.query("SELECT id FROM allocations WHERE department_id = ? AND status = 'confirmed'", id);
    if (activeAllocations.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department "${existing.name}". It has ${activeAllocations.length} active allocation(s).`
      });
    }

    db.run('DELETE FROM departments WHERE id = ?', id);

    res.json({
      success: true,
      message: `Department "${existing.name}" has been deleted.`
    });
  } catch (err) {
    next(err);
  }
};
