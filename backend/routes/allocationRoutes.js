const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/allocationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Read endpoints accessible to both Admin and Faculty
router.get('/', authenticateToken, allocationController.getAllAllocations);
router.get('/conflicts', authenticateToken, allocationController.checkConflicts);
router.post('/recommend', authenticateToken, allocationController.recommendRoom);
router.get('/:id', authenticateToken, allocationController.getAllocationById);

// Admin-only management endpoints
router.post('/', authenticateToken, requireRole('admin'), allocationController.createAllocation);
router.post('/auto-allocate', authenticateToken, requireRole('admin'), allocationController.autoAllocate);
router.put('/:id', authenticateToken, requireRole('admin'), allocationController.updateAllocation);
router.delete('/:id', authenticateToken, requireRole('admin'), allocationController.deleteAllocation);

module.exports = router;
