const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/cube-mapping", async (req, res) => {
  const { user_id, monday_date } = req.body; // monday_date: "2026-10-05" 형식
  try {
    const monday = new Date(monday_date);

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0];
      const cubeId = i + 1; // 1=월, 2=화, ..., 7=일

      await pool.query(
        `INSERT INTO cube_slots (user_id, cube_id, target_date, status)
         VALUES (?, ?, ?, 'inserted')
         ON DUPLICATE KEY UPDATE target_date = VALUES(target_date), status = 'inserted'`,
        [user_id, cubeId, dateStr]
      );
    }

    res.json({ ok: true, message: "이번 주 큐브 매핑 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "큐브 매핑 실패" });
  }
});

router.post("/cube-status", async (req, res) => {
  const { user_id, cube_id, status } = req.body; // status: 'inserted' 또는 'removed'

  try {
    const today = new Date().toISOString().split("T")[0];

    // 1. user_id + cube_id + 오늘 날짜로 정확히 하나의 큐브 확인
    const [slotRows] = await pool.query(
      `SELECT id FROM cube_slots WHERE user_id = ? AND cube_id = ? AND target_date = ?`,
      [user_id, cube_id, today]
    );

    if (slotRows.length === 0) {
      return res.status(404).json({ ok: false, error: "해당 큐브 정보를 찾을 수 없습니다" });
    }

    // 2. cube_slots 상태 업데이트
    await pool.query(
      `UPDATE cube_slots SET status = ? WHERE user_id = ? AND cube_id = ? AND target_date = ?`,
      [status, user_id, cube_id, today]
    );

    // 3. "removed"(약을 꺼냄)일 때만 복약 기록 남김
    if (status === "removed") {
      // 3-1. 이 사용자의 등록된 아침/저녁 시간 조회
      const [scheduleRows] = await pool.query(
        `SELECT period, time FROM schedules WHERE user_id = ?`,
        [user_id]
      );

      if (scheduleRows.length === 0) {
        return res.status(400).json({ ok: false, error: "등록된 복약 일정이 없습니다" });
      }

      // 3-2. 현재 시각과 각 등록 시간 차이를 비교해서 더 가까운 쪽 선택
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

      // 3-3. medication_logs에 기록
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