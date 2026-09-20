const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/schedule", async (req, res) => {
  const { user_id, time, period } = req.body;

  try {
    const [result] = await pool.query(
      "INSERT INTO schedules (user_id, time, period) VALUES (?, ?, ?)",
      [user_id, time, period]
    );

    res.json({ ok: true, scheduleId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "일정 등록 실패" });
  }
});

router.get("/schedule/:userId", async (req, res) => {
  const { userId } = req.params;   // body가 아니라 params!

  try {
    const [rows] = await pool.query(
      "SELECT * FROM schedules WHERE user_id = ?",
      [userId]
    );
    res.json({ ok: true, schedules: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "일정 조회 실패" });
  }
});

module.exports = router;