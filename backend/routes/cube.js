const express = require("express");
const router = express.Router();
const pool = require("../db");
const { sendTelegram } = require("../services/telegram");

// 알림 문구에 쓸 시간대 이름
const PERIOD_LABEL = { morning: "아침", noon: "점심", evening: "저녁" };

// 서버(한국) 시간 기준 오늘 날짜 "YYYY-MM-DD".
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 큐브가 보낼 수 있는 칸 상태
const CUBE_STATUSES = ["inserted", "removed"];

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

// 현재 등록된 복약 기간(큐브 7칸)과 칸별 상태 조회. 앱의 일정 화면에서 사용
router.get("/cube-slots/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT cube_id, target_date, status FROM cube_slots WHERE user_id = ? ORDER BY cube_id",
      [userId]
    );
    res.json({ ok: true, slots: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "복약 기간 조회 실패" });
  }
});

// 큐브가 보내는 칸 상태 (ESP32 → 서버)
//  - 칸 상태(cube_slots.status)는 날짜와 상관없이 항상 실제 상태를 따라감
//    (다른 날 칸을 실수로 뽑았다가 꽂아도, 어제 칸을 오늘 꽂아도 반영됨)
//  - 복약 기록(medication_logs)은 아래 세 조건이 모두 맞을 때만, 한 번 남김
//      1) 새 상태가 removed(꺼냄)
//      2) 이전 상태가 removed가 아니었음 (꽂힘 → 꺼냄으로 바뀌는 순간, 같은 신호 반복은 제외)
//      3) 그 칸의 날짜가 오늘
router.post("/cube-status", async (req, res) => {
  const { user_id, cube_id, status } = req.body;

  if (user_id == null || cube_id == null || !CUBE_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: "user_id, cube_id, status(inserted 또는 removed)가 필요합니다" });
  }

  try {
    const today = todayLocal();

    // 1. 이 사용자의 이 칸 찾기 (날짜는 따지지 않음). is_today = 그 칸의 날짜가 오늘이면 1
    const [slotRows] = await pool.query(
      `SELECT id, status, (target_date = ?) AS is_today FROM cube_slots WHERE user_id = ? AND cube_id = ?`,
      [today, user_id, cube_id]
    );

    if (slotRows.length === 0) {
      return res.status(404).json({ ok: false, error: "해당 큐브 정보를 찾을 수 없습니다" });
    }

    const slot = slotRows[0];

    // 2. 칸 상태는 항상 반영
    await pool.query(`UPDATE cube_slots SET status = ? WHERE id = ?`, [status, slot.id]);

    // 3. 복약 기록을 남길 상황인지 판단
    const shouldLog = status === "removed" && slot.status !== "removed" && Boolean(slot.is_today);
    if (!shouldLog) {
      return res.json({ ok: true, message: "큐브 상태 업데이트 완료", logged: false });
    }

    const [scheduleRows] = await pool.query(
      `SELECT period, time FROM schedules WHERE user_id = ?`,
      [user_id]
    );

    if (scheduleRows.length === 0) {
      return res.status(400).json({ ok: false, error: "등록된 복약 일정이 없습니다" });
    }

    // 지금 시각과 가장 가까운 복약 시간대(아침/점심/저녁)로 기록
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

    // 같은 날 같은 시간대의 첫 기록일 때만 알림을 보낸다
    const [prevLogs] = await pool.query(
      `SELECT 1 FROM medication_logs WHERE user_id = ? AND target_date = ? AND period = ? LIMIT 1`,
      [user_id, today, closestPeriod]
    );
    const isFirstOfPeriod = prevLogs.length === 0;

    await pool.query(
      `INSERT INTO medication_logs (user_id, cube_id, target_date, period, confirmed_at, method)
       VALUES (?, ?, ?, ?, NOW(), 'sensor')`,
      [user_id, cube_id, today, closestPeriod]
    );

    // 첫 기록이면 텔레그램으로 알림 (응답이 늦어지지 않도록 기다리지 않고 보냄)
    // 복약자와 보호자 둘 다에게 보낸다
    if (isFirstOfPeriod) {
      const [userRows] = await pool.query(`SELECT name FROM users WHERE id = ?`, [user_id]);
      const who = (userRows[0] && userRows[0].name) || "사용자";
      const label = PERIOD_LABEL[closestPeriod] || closestPeriod;
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const message = `[복약지킴이] ${who}님이 ${label} 약을 꺼냈습니다. (${hhmm})`;
      sendTelegram(message, "patient");
      sendTelegram(message, "guardian");
    }

    res.json({ ok: true, message: "큐브 상태 업데이트 및 복약 기록 완료", logged: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "큐브 상태 업데이트 실패" });
  }
});

module.exports = router;