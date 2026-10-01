const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, timetableController.getTimetable);
router.get('/room/:roomId', authenticateToken, timetableController.getRoomTimetable);
router.get('/faculty/:facultyId', authenticateToken, timetableController.getFacultyTimetable);
router.get('/department/:departmentId', authenticateToken, timetableController.getDepartmentTimetable);

module.exports = router;
