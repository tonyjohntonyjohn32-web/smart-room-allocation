const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public to all authenticated users (Faculty & Admin)
router.get('/', authenticateToken, roomController.getAllRooms);
router.get('/availability', authenticateToken, roomController.checkAvailability);
router.get('/:id', authenticateToken, roomController.getRoomById);

// Admin only routes
router.post('/', authenticateToken, requireRole('admin'), roomController.createRoom);
router.put('/:id', authenticateToken, requireRole('admin'), roomController.updateRoom);
router.delete('/:id', authenticateToken, requireRole('admin'), roomController.deleteRoom);

module.exports = router;
