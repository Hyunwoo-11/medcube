const express = require("express");
const router = express.Router();
const pool = require("../db");

const PERIODS = ["morning", "noon", "evening"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // "08:00" 형식 (24시간)

// 일정 등록. 같은 사용자의 같은 시간대(period)가 이미 있으면 새로 만들지 않고 시간만 바꿈
router.post("/schedule", async (req, res) => {
  const { user_id, time, period } = req.body;

  if (!user_id || !PERIODS.includes(period) || !TIME_PATTERN.test(time)) {
    return res
      .status(400)
      .json({ ok: false, error: "시간대(morning/noon/evening)와 시간(HH:MM)을 확인해주세요" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id FROM schedules WHERE user_id = ? AND period = ?",
      [user_id, period]
    );

    if (existing.length > 0) {
      await pool.query("UPDATE schedules SET time = ? WHERE id = ?", [time, existing[0].id]);
      return res.json({ ok: true, scheduleId: existing[0].id, updated: true });
    }

    const [result] = await pool.query(
      "INSERT INTO schedules (user_id, time, period) VALUES (?, ?, ?)",
      [user_id, time, period]
    );

    res.json({ ok: true, scheduleId: result.insertId, updated: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "일정 등록 실패" });
  }
});

router.get("/schedule/:userId", async (req, res) => {
  const { userId } = req.params; // body가 아니라 params!

  try {
    const [rows] = await pool.query("SELECT * FROM schedules WHERE user_id = ?", [userId]);
    res.json({ ok: true, schedules: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "일정 조회 실패" });
  }
});

// 일정 삭제 (예: 점심은 안 먹기로 했을 때)
router.delete("/schedule/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM schedules WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: "일정을 찾을 수 없습니다" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "일정 삭제 실패" });
  }
});

module.exports = router;