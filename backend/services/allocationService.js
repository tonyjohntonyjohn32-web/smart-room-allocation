const { db: defaultDb } = require('../db');
const conflictService = require('./conflictService');
const { isValidTimeFormat, isStartBeforeEnd, isValidDateFormat } = require('../utils/validators');

class AllocationService {
  constructor(database = null) {
    this.db = database || defaultDb;
    this.conflictChecker = new conflictService.ConflictService(this.db);
  }

  /**
   * Find available rooms and rank them based on suitability criteria
   *
   * @param {Object} criteria
   * @param {string} criteria.date YYYY-MM-DD
   * @param {string} criteria.startTime HH:MM
   * @param {string} criteria.endTime HH:MM
   * @param {number} criteria.expectedStudents
   * @param {string} [criteria.roomType]
   * @param {string[]} [criteria.requiredEquipment]
   * @param {number} [criteria.departmentId]
   * @param {string} [criteria.building]
   * @param {boolean} [criteria.requireAccessibility]
   * @returns {Object}
   */
  recommendRoom({
    date,
    startTime,
    endTime,
    expectedStudents = 1,
    roomType = null,
    requiredEquipment = [],
    departmentId = null,
    building = null,
    requireAccessibility = false
  }) {
    if (!isValidDateFormat(date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD.');
    }
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isStartBeforeEnd(startTime, endTime)) {
      throw new Error('Invalid time range. Start time must be before end time.');
    }

    const allRooms = this.db.query('SELECT * FROM rooms');
    const eligibleRooms = [];
    const excludedRooms = [];

    // Parse equipment if array is passed as string
    let reqEquipList = Array.isArray(requiredEquipment) ? requiredEquipment : [];
    if (typeof requiredEquipment === 'string' && requiredEquipment.trim()) {
      try {
        reqEquipList = JSON.parse(requiredEquipment);
      } catch (e) {
        reqEquipList = requiredEquipment.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    for (const room of allRooms) {
      // 1. Exclude inactive rooms
      if (room.status === 'inactive') {
        excludedRooms.push({
          roomId: room.id,
          roomNumber: room.room_number,
          reason: 'Room is inactive.'
        });
        continue;
      }

      // 2. Exclude rooms under maintenance
      if (room.status === 'maintenance') {
        excludedRooms.push({
          roomId: room.id,
          roomNumber: room.room_number,
          reason: 'Room is currently under maintenance.'
        });
        continue;
      }

      const activeMaintenance = this.db.query(
        `SELECT * FROM maintenance 
         WHERE room_id = ? 
           AND start_date <= ? 
           AND end_date >= ? 
           AND status != 'completed'`,
        room.id, date, date
      );

      if (activeMaintenance.length > 0) {
        excludedRooms.push({
          roomId: room.id,
          roomNumber: room.room_number,
          reason: `Scheduled maintenance: ${activeMaintenance[0].reason}`
        });
        continue;
      }

      // 3. Exclude rooms with insufficient capacity
      if (room.capacity < expectedStudents) {
        excludedRooms.push({
          roomId: room.id,
          roomNumber: room.room_number,
          reason: `Insufficient capacity (${room.capacity} seats < ${expectedStudents} required).`
        });
        continue;
      }

      // 4. Check for overlapping allocations
      const existingAllocations = this.db.query(
        `SELECT * FROM allocations 
         WHERE room_id = ? 
           AND allocation_date = ? 
           AND status = 'confirmed'`,
        room.id, date
      );

      let hasOverlap = false;
      let overlapSubject = '';
      for (const alloc of existingAllocations) {
        if (this.conflictChecker.isIntervalOverlapping(alloc.start_time, alloc.end_time, startTime, endTime)) {
          hasOverlap = true;
          overlapSubject = `${alloc.subject} (${alloc.start_time} - ${alloc.end_time})`;
          break;
        }
      }

      if (hasOverlap) {
        excludedRooms.push({
          roomId: room.id,
          roomNumber: room.room_number,
          reason: `Time slot already booked for ${overlapSubject}.`
        });
        continue;
      }

      // Parse room equipment
      let roomEquip = [];
      try {
        roomEquip = JSON.parse(room.equipment || '[]');
      } catch (e) {
        roomEquip = [];
      }

      // 5. Calculate transparent multi-factor score
      const scoreBreakdown = {};

      // A. Capacity Suitability (0 - 35 points)
      // Higher score for closer utilization ratio (avoids assigning huge auditorium for small class)
      const utilizationRatio = expectedStudents / room.capacity;
      if (utilizationRatio >= 0.75) {
        scoreBreakdown.capacityScore = 35; // optimal fit: 75% - 100% capacity used
      } else if (utilizationRatio >= 0.50) {
        scoreBreakdown.capacityScore = 28; // very good fit: 50% - 74% capacity used
      } else if (utilizationRatio >= 0.30) {
        scoreBreakdown.capacityScore = 18; // acceptable fit: 30% - 49% capacity used
      } else {
        scoreBreakdown.capacityScore = 8;  // severe oversizing (<30% capacity used)
      }

      // B. Equipment Match (0 - 25 points)
      if (reqEquipList.length === 0) {
        scoreBreakdown.equipmentScore = 25;
      } else {
        const matched = reqEquipList.filter(eq => roomEquip.includes(eq));
        scoreBreakdown.equipmentScore = Math.round((matched.length / reqEquipList.length) * 25);
      }

      // C. Room Type Match (0 - 20 points)
      if (!roomType) {
        scoreBreakdown.roomTypeScore = 20;
      } else if (room.room_type.toLowerCase() === roomType.toLowerCase()) {
        scoreBreakdown.roomTypeScore = 20;
      } else if (
        (roomType === 'Classroom' && ['Seminar Hall', 'Tutorial Room'].includes(room.room_type)) ||
        (roomType === 'Tutorial Room' && room.room_type === 'Classroom')
      ) {
        scoreBreakdown.roomTypeScore = 12; // compatible alternative
      } else {
        scoreBreakdown.roomTypeScore = 4;  // low affinity (e.g., Lab when Classroom was requested)
      }

      // D. Department Preference (0 - 10 points)
      if (departmentId && Number(room.department_id) === Number(departmentId)) {
        scoreBreakdown.departmentScore = 10; // home department bonus
      } else if (!room.department_id) {
        scoreBreakdown.departmentScore = 8;  // centrally managed facility
      } else {
        scoreBreakdown.departmentScore = 3;  // affiliated with another department
      }

      // E. Accessibility Bonus (0 - 10 points)
      const isAccessible = (room.accessibility || '').toLowerCase().includes('accessible');
      if (requireAccessibility) {
        scoreBreakdown.accessibilityScore = isAccessible ? 10 : 0;
      } else {
        scoreBreakdown.accessibilityScore = isAccessible ? 10 : 7;
      }

      // Building affinity bonus (small 5 pt tie-breaker)
      if (building && room.building.toLowerCase() === building.toLowerCase()) {
        scoreBreakdown.buildingScore = 5;
      } else {
        scoreBreakdown.buildingScore = 0;
      }

      const totalScore = Object.values(scoreBreakdown).reduce((sum, v) => sum + v, 0);

      eligibleRooms.push({
        room,
        utilizationRatio: Math.round(utilizationRatio * 100),
        score: totalScore,
        scoreBreakdown,
        equipment: roomEquip
      });
    }

    // Rank eligible rooms descending by score, then ascending by capacity (least wastage)
    eligibleRooms.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.room.capacity - b.room.capacity;
    });

    if (eligibleRooms.length === 0) {
      return {
        recommended: null,
        alternatives: [],
        explanation: 'No available rooms meet the required constraints for the requested time slot.',
        excludedCount: excludedRooms.length,
        excluded: excludedRooms
      };
    }

    const topMatch = eligibleRooms[0];
    const alternatives = eligibleRooms.slice(1);

    const explanation = `Room ${topMatch.room.room_number} (${topMatch.room.room_name}) in ${topMatch.room.building} is the top recommendation with a suitability score of ${topMatch.score}/100. It accommodates ${expectedStudents} students with ${topMatch.utilizationRatio}% capacity utilization, provides the required equipment, and has no scheduling conflicts for ${startTime}-${endTime}.`;

    return {
      recommended: topMatch,
      alternatives,
      explanation,
      totalEligible: eligibleRooms.length,
      excludedCount: excludedRooms.length,
      excluded: excludedRooms
    };
  }
}

module.exports = new AllocationService();
module.exports.AllocationService = AllocationService;
