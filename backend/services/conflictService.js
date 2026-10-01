const { db: defaultDb } = require('../db');
const { isValidTimeFormat, isStartBeforeEnd, isValidDateFormat } = require('../utils/validators');

class ConflictService {
  constructor(database = null) {
    this.db = database || defaultDb;
  }

  /**
   * Evaluates if two time intervals overlap.
   * Standard interval overlap rule:
   * ExistingStart < RequestedEnd AND ExistingEnd > RequestedStart
   * Adjacent slots (e.g. 09:00-10:00 and 10:00-11:00) evaluate to false (no overlap).
   *
   * @param {string} startA HH:MM
   * @param {string} endA HH:MM
   * @param {string} startB HH:MM
   * @param {string} endB HH:MM
   * @returns {boolean}
   */
  isIntervalOverlapping(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
  }

  /**
   * Comprehensive conflict detection before creating or updating an allocation.
   *
   * @param {Object} params
   * @param {number} params.roomId
   * @param {number} params.facultyId
   * @param {string} params.date YYYY-MM-DD
   * @param {string} params.startTime HH:MM
   * @param {string} params.endTime HH:MM
   * @param {number} [params.expectedStudents]
   * @param {number} [params.excludeAllocationId] Useful when editing an existing allocation
   * @returns {Object} { hasConflict: boolean, conflicts: Array<{ type: string, message: string, details?: any }> }
   */
  checkConflicts({ roomId, facultyId, date, startTime, endTime, expectedStudents = 0, excludeAllocationId = null }) {
    const conflicts = [];

    // Basic format checks
    if (!isValidDateFormat(date)) {
      conflicts.push({
        type: 'INVALID_DATE',
        message: 'Invalid date format. Expected YYYY-MM-DD.'
      });
    }

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      conflicts.push({
        type: 'INVALID_TIME_FORMAT',
        message: 'Invalid time format. Expected 24-hour HH:MM.'
      });
    } else if (!isStartBeforeEnd(startTime, endTime)) {
      conflicts.push({
        type: 'INVALID_TIME_RANGE',
        message: 'End time must be strictly after start time.'
      });
    }

    if (conflicts.length > 0) {
      return { hasConflict: true, conflicts };
    }

    // 1. Verify Room exists and check capacity & base status
    const room = this.db.get('SELECT * FROM rooms WHERE id = ?', roomId);
    if (!room) {
      conflicts.push({
        type: 'ROOM_NOT_FOUND',
        message: `Room with ID ${roomId} does not exist.`
      });
      return { hasConflict: true, conflicts };
    }

    if (room.status === 'inactive') {
      conflicts.push({
        type: 'ROOM_INACTIVE',
        message: `Room ${room.room_number} (${room.room_name}) is marked inactive and cannot be allocated.`
      });
    }

    if (expectedStudents > 0 && expectedStudents > room.capacity) {
      conflicts.push({
        type: 'CAPACITY_EXCEEDED',
        message: `Expected student count (${expectedStudents}) exceeds room capacity (${room.capacity}).`
      });
    }

    // 2. Check Room Maintenance conflict
    const activeMaintenance = this.db.query(
      `SELECT * FROM maintenance 
       WHERE room_id = ? 
         AND start_date <= ? 
         AND end_date >= ? 
         AND status != 'completed'`,
      roomId, date, date
    );

    if (activeMaintenance.length > 0) {
      const m = activeMaintenance[0];
      conflicts.push({
        type: 'MAINTENANCE_CONFLICT',
        message: `Room ${room.room_number} is scheduled for maintenance from ${m.start_date} to ${m.end_date}. Reason: ${m.reason}`,
        details: m
      });
    }

    // 3. Check Room Double Booking (Interval Overlap)
    let roomAllocQuery = `
      SELECT a.*, r.room_number, r.room_name, u.name as faculty_name 
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN users u ON a.faculty_id = u.id
      WHERE a.room_id = ? 
        AND a.allocation_date = ? 
        AND a.status = 'confirmed'
    `;
    const roomAllocParams = [roomId, date];

    if (excludeAllocationId) {
      roomAllocQuery += ' AND a.id != ?';
      roomAllocParams.push(excludeAllocationId);
    }

    const roomAllocations = this.db.query(roomAllocQuery, ...roomAllocParams);

    for (const alloc of roomAllocations) {
      if (this.isIntervalOverlapping(alloc.start_time, alloc.end_time, startTime, endTime)) {
        conflicts.push({
          type: 'ROOM_DOUBLE_BOOKING',
          message: `Room ${room.room_number} is already booked from ${alloc.start_time} to ${alloc.end_time} for "${alloc.subject}" (Faculty: ${alloc.faculty_name}).`,
          details: alloc
        });
      }
    }

    // 4. Check Faculty Double Booking (Interval Overlap)
    if (facultyId) {
      let facultyAllocQuery = `
        SELECT a.*, r.room_number, r.room_name, u.name as faculty_name
        FROM allocations a
        JOIN rooms r ON a.room_id = r.id
        JOIN users u ON a.faculty_id = u.id
        WHERE a.faculty_id = ? 
          AND a.allocation_date = ? 
          AND a.status = 'confirmed'
      `;
      const facultyAllocParams = [facultyId, date];

      if (excludeAllocationId) {
        facultyAllocQuery += ' AND a.id != ?';
        facultyAllocParams.push(excludeAllocationId);
      }

      const facultyAllocations = this.db.query(facultyAllocQuery, ...facultyAllocParams);

      for (const alloc of facultyAllocations) {
        if (this.isIntervalOverlapping(alloc.start_time, alloc.end_time, startTime, endTime)) {
          conflicts.push({
            type: 'FACULTY_DOUBLE_BOOKING',
            message: `Faculty member (${alloc.faculty_name}) is already scheduled in Room ${alloc.room_number} from ${alloc.start_time} to ${alloc.end_time} for "${alloc.subject}".`,
            details: alloc
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }
}

module.exports = new ConflictService();
module.exports.ConflictService = ConflictService;
