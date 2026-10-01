const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.get('/room-utilization', authenticateToken, reportController.getRoomUtilizationReport);
router.get('/department-allocations', authenticateToken, reportController.getDepartmentAllocationsReport);
router.get('/building-utilization', authenticateToken, reportController.getBuildingUtilizationReport);
router.get('/unused-rooms', authenticateToken, reportController.getUnusedRoomsReport);
router.get('/maintenance', authenticateToken, reportController.getMaintenanceReport);
router.get('/capacity-efficiency', authenticateToken, reportController.getCapacityEfficiencyReport);
router.get('/export', authenticateToken, reportController.exportCSV);

module.exports = router;
