const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/history/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, cube_id, target_date, period, confirmed_at, method
       FROM medication_logs
       WHERE user_id = ?
       ORDER BY target_date DESC, confirmed_at DESC`,
      [userId]
    );

    res.json({ ok: true, history: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "복용 이력 조회 실패" });
  }
});

module.exports = router;