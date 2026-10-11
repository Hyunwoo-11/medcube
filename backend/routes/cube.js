const express = require("express");
const router = express.Router();
const pool = require("../db");

// 사용자가 지정한 시작일부터 7일간 매핑
router.post("/cube-mapping", async (req, res) => {
  const { user_id, start_date } = req.body; // start_date: "2026-10-03" 형식
  try {
    const start = new Date(start_date);

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(start);
      targetDate.setDate(start.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0];
      const cubeId = i + 1; // 1=시작일, 2=다음날, ..., 7=6일 후

      await pool.query(
        `INSERT INTO cube_slots (user_id, cube_id, target_date, status)
         VALUES (?, ?, ?, 'inserted')
         ON DUPLICATE KEY UPDATE target_date = VALUES(target_date), status = 'inserted'`,
        [user_id, cubeId, dateStr]
      );
    }

    res.json({ ok: true, message: "복약 기간 매핑 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "매핑 실패" });
  }
});

router.post("/cube-status", async (req, res) => {
  const { user_id, cube_id, status } = req.body;

  try {
    const today = new Date().toISOString().split("T")[0];

    // 1. user_id + cube_id + 오늘 날짜로 유효한 매핑인지 확인
    const [slotRows] = await pool.query(
      `SELECT id FROM cube_slots WHERE user_id = ? AND cube_id = ? AND target_date = ?`,
      [user_id, cube_id, today]
    );

    if (slotRows.length === 0) {
      // 못 찾았을 때, 혹시 "7일 기간이 아예 끝난 건지" 확인
      const [latestRows] = await pool.query(
        `SELECT MAX(target_date) AS last_date FROM cube_slots WHERE user_id = ?`,
        [user_id]
      );

      const lastDate = latestRows[0]?.last_date;
      if (lastDate && new Date(today) > new Date(lastDate)) {
        return res.status(410).json({ ok: false, error: "복약 기간이 종료되었습니다. 새로운 기간을 등록해주세요." });
      }

      return res.status(404).json({ ok: false, error: "해당 큐브 정보를 찾을 수 없습니다" });
    }

    // 2. cube_slots 상태 업데이트
    await pool.query(
      `UPDATE cube_slots SET status = ? WHERE user_id = ? AND cube_id = ? AND target_date = ?`,
      [status, user_id, cube_id, today]
    );

    // 3. "removed"일 때만 복약 기록
    if (status === "removed") {
      const [scheduleRows] = await pool.query(
        `SELECT period, time FROM schedules WHERE user_id = ?`,
        [user_id]
      );

      if (scheduleRows.length === 0) {
        return res.status(400).json({ ok: false, error: "등록된 복약 일정이 없습니다" });
      }

      const now = new Date();
      let closestPeriod = null;
      let minDiff = Infinity;

      scheduleRows.forEach((row) => {
        const [h, m] = row.time.split(":").map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(h, m, 0, 0);
        const diff = Math.abs(now - scheduleTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPeriod = row.period;
        }
      });

      await pool.query(
        `INSERT INTO medication_logs (user_id, cube_id, target_date, period, confirmed_at, method)
         VALUES (?, ?, ?, ?, NOW(), 'sensor')`,
        [user_id, cube_id, today, closestPeriod]
      );
    }

    res.json({ ok: true, message: "큐브 상태 업데이트 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "큐브 상태 업데이트 실패" });
  }
});

module.exports = router;