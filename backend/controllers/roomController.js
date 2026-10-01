const { db } = require('../db');
const conflictService = require('../services/conflictService');
const { isValidPositiveInt } = require('../utils/validators');

const VALID_ROOM_TYPES = [
  'Classroom',
  'Laboratory',
  'Seminar Hall',
  'Auditorium',
  'Conference Room',
  'Computer Lab',
  'Tutorial Room'
];

/**
 * Get all rooms with optional filtering, search, and pagination
 */
exports.getAllRooms = (req, res, next) => {
  try {
    const {
      search,
      building,
      room_type,
      min_capacity,
      max_capacity,
      department_id,
      status,
      sort_by = 'room_number',
      order = 'ASC',
      page = 1,
      limit = 50
    } = req.query;

    let sql = `
      SELECT r.*, d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM allocations a WHERE a.room_id = r.id AND a.status = 'confirmed') as total_allocations
      FROM rooms r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (r.room_number LIKE ? OR r.room_name LIKE ? OR r.description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (building) {
      sql += ` AND r.building = ?`;
      params.push(building);
    }

    if (room_type) {
      sql += ` AND r.room_type = ?`;
      params.push(room_type);
    }

    if (min_capacity) {
      sql += ` AND r.capacity >= ?`;
      params.push(Number(min_capacity));
    }

    if (max_capacity) {
      sql += ` AND r.capacity <= ?`;
      params.push(Number(max_capacity));
    }

    if (department_id) {
      sql += ` AND r.department_id = ?`;
      params.push(Number(department_id));
    }

    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }

    // Sorting
    const allowedSortFields = ['room_number', 'room_name', 'capacity', 'building', 'floor', 'room_type', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'room_number';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    sql += ` ORDER BY r.${sortField} ${sortOrder}`;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Count total before pagination
    const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
    const countResult = db.query(countSql, ...params);
    const total = countResult[0] ? countResult[0].count : 0;

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const rooms = db.query(sql, ...params);

    // Format equipment JSON
    const formattedRooms = rooms.map(r => {
      let equipment = [];
      try {
        equipment = JSON.parse(r.equipment || '[]');
      } catch (e) {
        equipment = [];
      }
      return { ...r, equipment };
    });

    res.json({
      success: true,
      data: formattedRooms,
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
 * Get room by ID
 */
exports.getRoomById = (req, res, next) => {
  try {
    const { id } = req.params;
    const room = db.get(`
      SELECT r.*, d.name as department_name, d.code as department_code
      FROM rooms r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE r.id = ?
    `, id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.'
      });
    }

    try {
      room.equipment = JSON.parse(room.equipment || '[]');
    } catch (e) {
      room.equipment = [];
    }

    // Get active allocations for this room
    const upcomingAllocations = db.query(`
      SELECT a.*, u.name as faculty_name, d.name as department_name
      FROM allocations a
      JOIN users u ON a.faculty_id = u.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE a.room_id = ? AND a.allocation_date >= date('now') AND a.status = 'confirmed'
      ORDER BY a.allocation_date ASC, a.start_time ASC
      LIMIT 10
    `, id);

    // Get maintenance history
    const maintenanceRecords = db.query(`
      SELECT * FROM maintenance
      WHERE room_id = ?
      ORDER BY start_date DESC
      LIMIT 5
    `, id);

    res.json({
      success: true,
      room,
      upcomingAllocations,
      maintenanceRecords
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new room
 */
exports.createRoom = (req, res, next) => {
  try {
    const {
      room_number,
      room_name,
      building,
      floor,
      room_type,
      capacity,
      department_id,
      equipment,
      accessibility,
      status = 'available',
      description
    } = req.body;

    if (!room_number || !room_name || !building || floor === undefined || !room_type || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: room_number, room_name, building, floor, room_type, and capacity are mandatory.'
      });
    }

    if (!isValidPositiveInt(capacity)) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a positive integer greater than zero.'
      });
    }

    if (!VALID_ROOM_TYPES.includes(room_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid room type. Must be one of: ${VALID_ROOM_TYPES.join(', ')}.`
      });
    }

    // Check duplicate room_number in the same building
    const existing = db.get(
      'SELECT id FROM rooms WHERE LOWER(room_number) = LOWER(?) AND LOWER(building) = LOWER(?)',
      room_number.trim(), building.trim()
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A room with number "${room_number}" already exists in building "${building}".`
      });
    }

    let equipmentJson = '[]';
    if (Array.isArray(equipment)) {
      equipmentJson = JSON.stringify(equipment);
    } else if (typeof equipment === 'string') {
      try {
        JSON.parse(equipment);
        equipmentJson = equipment;
      } catch (e) {
        equipmentJson = JSON.stringify(equipment.split(',').map(s => s.trim()).filter(Boolean));
      }
    }

    const result = db.run(`
      INSERT INTO rooms (
        room_number, room_name, building, floor, room_type, capacity,
        department_id, equipment, accessibility, status, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      room_number.trim(),
      room_name.trim(),
      building.trim(),
      parseInt(floor, 10),
      room_type,
      parseInt(capacity, 10),
      department_id ? parseInt(department_id, 10) : null,
      equipmentJson,
      accessibility || 'Standard',
      status,
      description || null
    );

    const newRoom = db.get('SELECT * FROM rooms WHERE id = ?', result.lastInsertRowid);
    newRoom.equipment = JSON.parse(newRoom.equipment || '[]');

    res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      room: newRoom
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing room
 */
exports.updateRoom = (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      room_number,
      room_name,
      building,
      floor,
      room_type,
      capacity,
      department_id,
      equipment,
      accessibility,
      status,
      description
    } = req.body;

    const existingRoom = db.get('SELECT * FROM rooms WHERE id = ?', id);
    if (!existingRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.'
      });
    }

    if (capacity !== undefined && !isValidPositiveInt(capacity)) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a positive integer.'
      });
    }

    if (room_type && !VALID_ROOM_TYPES.includes(room_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid room type. Must be one of: ${VALID_ROOM_TYPES.join(', ')}.`
      });
    }

    // Check duplicate room_number in same building (excluding self)
    const targetRoomNumber = room_number ? room_number.trim() : existingRoom.room_number;
    const targetBuilding = building ? building.trim() : existingRoom.building;

    const duplicate = db.get(
      'SELECT id FROM rooms WHERE LOWER(room_number) = LOWER(?) AND LOWER(building) = LOWER(?) AND id != ?',
      targetRoomNumber, targetBuilding, id
    );

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Another room with number "${targetRoomNumber}" already exists in building "${targetBuilding}".`
      });
    }

    let equipmentJson = existingRoom.equipment;
    if (equipment !== undefined) {
      if (Array.isArray(equipment)) {
        equipmentJson = JSON.stringify(equipment);
      } else if (typeof equipment === 'string') {
        try {
          JSON.parse(equipment);
          equipmentJson = equipment;
        } catch (e) {
          equipmentJson = JSON.stringify(equipment.split(',').map(s => s.trim()).filter(Boolean));
        }
      }
    }

    db.run(`
      UPDATE rooms SET
        room_number = COALESCE(?, room_number),
        room_name = COALESCE(?, room_name),
        building = COALESCE(?, building),
        floor = COALESCE(?, floor),
        room_type = COALESCE(?, room_type),
        capacity = COALESCE(?, capacity),
        department_id = ?,
        equipment = ?,
        accessibility = COALESCE(?, accessibility),
        status = COALESCE(?, status),
        description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      room_number ? room_number.trim() : null,
      room_name ? room_name.trim() : null,
      building ? building.trim() : null,
      floor !== undefined ? parseInt(floor, 10) : null,
      room_type || null,
      capacity ? parseInt(capacity, 10) : null,
      department_id !== undefined ? (department_id ? parseInt(department_id, 10) : null) : existingRoom.department_id,
      equipmentJson,
      accessibility || null,
      status || null,
      description !== undefined ? description : existingRoom.description,
      id
    );

    const updatedRoom = db.get('SELECT * FROM rooms WHERE id = ?', id);
    updatedRoom.equipment = JSON.parse(updatedRoom.equipment || '[]');

    res.json({
      success: true,
      message: 'Room updated successfully.',
      room: updatedRoom
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a room (safe deletion check)
 */
exports.deleteRoom = (req, res, next) => {
  try {
    const { id } = req.params;

    const room = db.get('SELECT * FROM rooms WHERE id = ?', id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.'
      });
    }

    // Check if room has active upcoming or confirmed allocations
    const activeAllocations = db.query(
      "SELECT id FROM allocations WHERE room_id = ? AND status = 'confirmed'",
      id
    );

    if (activeAllocations.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete room ${room.room_number}. It is referenced in ${activeAllocations.length} active allocation(s). Please cancel or reassign these allocations before deleting.`
      });
    }

    db.run('DELETE FROM rooms WHERE id = ?', id);

    res.json({
      success: true,
      message: `Room ${room.room_number} has been deleted successfully.`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Check real-time room availability for a specific time window
 */
exports.checkAvailability = (req, res, next) => {
  try {
    const {
      date,
      start_time,
      end_time,
      min_capacity = 0,
      room_type,
      building,
      equipment
    } = req.query;

    if (!date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'date, start_time, and end_time parameters are required to check availability.'
      });
    }

    let reqEquip = [];
    if (equipment) {
      try {
        reqEquip = JSON.parse(equipment);
      } catch (e) {
        reqEquip = equipment.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const rooms = db.query(`
      SELECT r.*, d.name as department_name, d.code as department_code
      FROM rooms r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE 1=1
    `);

    const results = rooms.map(room => {
      let roomEquip = [];
      try {
        roomEquip = JSON.parse(room.equipment || '[]');
      } catch (e) {
        roomEquip = [];
      }

      // Check conflict
      const conflictCheck = conflictService.checkConflicts({
        roomId: room.id,
        date,
        startTime: start_time,
        endTime: end_time,
        expectedStudents: parseInt(min_capacity, 10) || 0
      });

      const isAvailable = !conflictCheck.hasConflict;

      return {
        ...room,
        equipment: roomEquip,
        isAvailable,
        conflicts: conflictCheck.conflicts
      };
    });

    // Filter results if query requested
    let filtered = results;
    if (room_type) {
      filtered = filtered.filter(r => r.room_type.toLowerCase() === room_type.toLowerCase());
    }
    if (building) {
      filtered = filtered.filter(r => r.building.toLowerCase() === building.toLowerCase());
    }
    if (min_capacity > 0) {
      filtered = filtered.filter(r => r.capacity >= parseInt(min_capacity, 10));
    }
    if (reqEquip.length > 0) {
      filtered = filtered.filter(r => reqEquip.every(eq => r.equipment.includes(eq)));
    }

    res.json({
      success: true,
      query: { date, start_time, end_time, min_capacity, room_type, building },
      totalRooms: filtered.length,
      availableCount: filtered.filter(r => r.isAvailable).length,
      occupiedCount: filtered.filter(r => !r.isAvailable).length,
      rooms: filtered
    });
  } catch (err) {
    next(err);
  }
};
