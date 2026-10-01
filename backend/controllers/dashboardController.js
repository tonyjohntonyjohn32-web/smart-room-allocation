const { db } = require('../db');

/**
 * Get dashboard KPI summary statistics
 */
exports.getSummary = (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Total Rooms
    const totalRoomsRow = db.get("SELECT COUNT(*) as count FROM rooms WHERE status != 'inactive'");
    const totalRooms = totalRoomsRow ? totalRoomsRow.count : 0;

    // 2. Rooms in Maintenance
    const maintRoomsRow = db.get("SELECT COUNT(*) as count FROM rooms WHERE status = 'maintenance'");
    const maintenanceRooms = maintRoomsRow ? maintRoomsRow.count : 0;

    // 3. Occupied Rooms right now (date = today AND start_time <= now AND end_time > now)
    const occupiedNowRow = db.get(`
      SELECT COUNT(DISTINCT room_id) as count 
      FROM allocations 
      WHERE allocation_date = ? 
        AND start_time <= ? 
        AND end_time > ? 
        AND status = 'confirmed'
    `, today, currentTime, currentTime);
    const occupiedRooms = occupiedNowRow ? occupiedNowRow.count : 0;

    // 4. Available Rooms right now
    const availableRooms = Math.max(0, totalRooms - occupiedRooms - maintenanceRooms);

    // 5. Total Confirmed Allocations
    const totalAllocRow = db.get("SELECT COUNT(*) as count FROM allocations WHERE status = 'confirmed'");
    const totalAllocations = totalAllocRow ? totalAllocRow.count : 0;

    // 6. Total Departments
    const totalDeptsRow = db.get('SELECT COUNT(*) as count FROM departments');
    const totalDepartments = totalDeptsRow ? totalDeptsRow.count : 0;

    // 7. Overall Capacity Utilization Percentage
    // Average ratio of (expected_students / room_capacity) across confirmed allocations
    const utilRow = db.get(`
      SELECT AVG(CAST(a.expected_students AS REAL) / r.capacity) * 100 as avg_utilization
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      WHERE a.status = 'confirmed'
    `);
    const utilizationRate = utilRow && utilRow.avg_utilization ? Math.round(utilRow.avg_utilization) : 0;

    // Active maintenance alerts
    const activeMaintenanceAlerts = db.query(`
      SELECT m.*, r.room_number, r.room_name, r.building
      FROM maintenance m
      JOIN rooms r ON m.room_id = r.id
      WHERE m.status != 'completed'
      ORDER BY m.start_date ASC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        totalRooms,
        availableRooms,
        occupiedRooms,
        maintenanceRooms,
        totalAllocations,
        totalDepartments,
        utilizationRate
      },
      alerts: {
        maintenance: activeMaintenanceAlerts
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Room Occupancy status distribution for Chart.js
 */
exports.getOccupancyData = (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const totalRooms = db.get("SELECT COUNT(*) as count FROM rooms WHERE status != 'inactive'").count;
    const maintenanceRooms = db.get("SELECT COUNT(*) as count FROM rooms WHERE status = 'maintenance'").count;
    const occupiedRooms = db.get(`
      SELECT COUNT(DISTINCT room_id) as count 
      FROM allocations 
      WHERE allocation_date = ? 
        AND start_time <= ? 
        AND end_time > ? 
        AND status = 'confirmed'
    `, today, currentTime, currentTime).count;

    const availableRooms = Math.max(0, totalRooms - occupiedRooms - maintenanceRooms);

    res.json({
      success: true,
      chartData: {
        labels: ['Available', 'Occupied', 'Maintenance'],
        datasets: [{
          data: [availableRooms, occupiedRooms, maintenanceRooms],
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
          borderColor: ['#059669', '#2563eb', '#d97706'],
          borderWidth: 1
        }]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Utilization breakdown by Building & Department for Chart.js
 */
exports.getUtilizationData = (req, res, next) => {
  try {
    // 1. Building utilization
    const buildingStats = db.query(`
      SELECT r.building,
             COUNT(DISTINCT r.id) as total_rooms,
             COUNT(a.id) as total_allocations,
             ROUND(AVG(CAST(COALESCE(a.expected_students, 0) AS REAL) / r.capacity) * 100) as avg_utilization
      FROM rooms r
      LEFT JOIN allocations a ON r.id = a.room_id AND a.status = 'confirmed'
      GROUP BY r.building
      ORDER BY r.building ASC
    `);

    // 2. Department allocation distribution
    const departmentStats = db.query(`
      SELECT d.name, d.code, COUNT(a.id) as allocation_count
      FROM departments d
      LEFT JOIN allocations a ON d.id = a.department_id AND a.status = 'confirmed'
      GROUP BY d.id
      ORDER BY allocation_count DESC
    `);

    // 3. Weekly room usage distribution (by day of week)
    const weeklyUsage = db.query(`
      SELECT day_of_week, COUNT(*) as count
      FROM allocations
      WHERE status = 'confirmed'
      GROUP BY day_of_week
    `);

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyDataMap = {};
    dayOrder.forEach(d => { weeklyDataMap[d] = 0; });
    weeklyUsage.forEach(row => {
      if (weeklyDataMap.hasOwnProperty(row.day_of_week)) {
        weeklyDataMap[row.day_of_week] = row.count;
      }
    });

    res.json({
      success: true,
      buildingUtilization: {
        labels: buildingStats.map(b => b.building),
        datasets: [{
          label: 'Total Rooms',
          data: buildingStats.map(b => b.total_rooms),
          backgroundColor: '#93c5fd'
        }, {
          label: 'Total Allocations',
          data: buildingStats.map(b => b.total_allocations),
          backgroundColor: '#3b82f6'
        }]
      },
      departmentDistribution: {
        labels: departmentStats.map(d => d.code || d.name),
        datasets: [{
          label: 'Allocations',
          data: departmentStats.map(d => d.allocation_count),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
        }]
      },
      weeklyUsage: {
        labels: dayOrder,
        datasets: [{
          label: 'Classes Scheduled',
          data: dayOrder.map(d => weeklyDataMap[d]),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3
        }]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get recent allocations and upcoming classes for dashboard widgets
 */
exports.getRecentAllocations = (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const recentAllocations = db.query(`
      SELECT a.*, r.room_number, r.room_name, r.building,
             d.name as department_name, d.code as department_code,
             u.name as faculty_name
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.faculty_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 6
    `);

    const upcomingClasses = db.query(`
      SELECT a.*, r.room_number, r.room_name, r.building,
             d.name as department_name, d.code as department_code,
             u.name as faculty_name
      FROM allocations a
      JOIN rooms r ON a.room_id = r.id
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.faculty_id = u.id
      WHERE a.allocation_date >= ? AND a.status = 'confirmed'
      ORDER BY a.allocation_date ASC, a.start_time ASC
      LIMIT 6
    `, today);

    const recentlyAddedRooms = db.query(`
      SELECT r.*, d.code as department_code
      FROM rooms r
      LEFT JOIN departments d ON r.department_id = d.id
      ORDER BY r.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      recentAllocations,
      upcomingClasses,
      recentlyAddedRooms
    });
  } catch (err) {
    next(err);
  }
};
