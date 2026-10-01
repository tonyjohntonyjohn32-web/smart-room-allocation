const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

router.get('/summary', authenticateToken, dashboardController.getSummary);
router.get('/occupancy', authenticateToken, dashboardController.getOccupancyData);
router.get('/utilization', authenticateToken, dashboardController.getUtilizationData);
router.get('/recent-allocations', authenticateToken, dashboardController.getRecentAllocations);

module.exports = router;
