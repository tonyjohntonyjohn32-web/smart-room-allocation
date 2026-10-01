const { db } = require('../db');

/**
 * Get all application settings
 */
exports.getSettings = (req, res, next) => {
  try {
    const rows = db.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    for (const r of rows) {
      let val = r.setting_value;
      try {
        val = JSON.parse(r.setting_value);
      } catch (e) {
        // Keep string
      }
      settings[r.setting_key] = val;
    }

    res.json({
      success: true,
      settings
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update application settings (Admin only)
 */
exports.updateSettings = (req, res, next) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings payload.'
      });
    }

    const upsertStmt = db.db.prepare(`
      INSERT INTO settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const [key, val] of Object.entries(payload)) {
      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      upsertStmt.run(key, stringVal);
    }

    res.json({
      success: true,
      message: 'Settings updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};
