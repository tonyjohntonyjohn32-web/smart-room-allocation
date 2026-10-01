/**
 * Validation Utility Functions
 */

/**
 * Validates time format HH:MM (24-hour)
 * @param {string} time 
 * @returns {boolean}
 */
function isValidTimeFormat(time) {
  if (typeof time !== 'string') return false;
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(time.trim());
}

/**
 * Checks if start time is strictly before end time
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {boolean}
 */
function isStartBeforeEnd(startTime, endTime) {
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) return false;
  return startTime.trim() < endTime.trim();
}

/**
 * Validates date format YYYY-MM-DD
 * @param {string} dateStr 
 * @returns {boolean}
 */
function isValidDateFormat(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr.trim())) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validates positive integer
 * @param {any} val 
 * @returns {boolean}
 */
function isValidPositiveInt(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0;
}

/**
 * Calculates duration in minutes between two HH:MM strings
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {number}
 */
function calculateIntervalMinutes(startTime, endTime) {
  const [sHours, sMins] = startTime.split(':').map(Number);
  const [eHours, eMins] = endTime.split(':').map(Number);
  return (eHours * 60 + eMins) - (sHours * 60 + sMins);
}

module.exports = {
  isValidTimeFormat,
  isStartBeforeEnd,
  isValidDateFormat,
  isValidPositiveInt,
  calculateIntervalMinutes
};
