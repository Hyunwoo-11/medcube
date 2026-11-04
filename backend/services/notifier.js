const pool = require("../db");
const { sendTelegram } = require("./telegram");

// 알림 단계: 복약 시각으로부터 몇 분 뒤에 보낼지 (쉼표로 구분). 기본값은 정각, 15분 뒤, 30분 뒤
const STAGES_MIN = (process.env.NOTIFY_STAGES_MIN || "0,15,30")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0);

// 서버를 늦게 켰을 때 지난 알림이 몰리지 않도록, 각 단계는 이 시간(분) 안에서만 보낸다
const STAGE_WINDOW_MIN = Number(process.env.NOTIFY_STAGE_WINDOW_MIN) || 5;
const CHECK_INTERVAL_MS = 60 * 1000;

// 이 번호(0부터) 이상의 단계는 복약자와 함께 보호자에게도 보낸다.
// 0단계(정각)는 복약자에게만 간다.
const GUARDIAN_FROM_STAGE = 1;

const PERIOD_LABEL = { morning: "아침", noon: "점심", evening: "저녁" };

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// target: "patient"(복약자) 또는 "guardian"(보호자)
function buildMessage(stage, offset, name, label, time, target) {
  const who = name || "사용자";
  if (stage === 0) {
    return `[복약지킴이] ${who}님, ${label} 약 드실 시간입니다. (${time})`;
  }
  if (target === "guardian") {
    return `[복약지킴이] ${who}님이 ${label} 약(${time})을 ${offset}분째 꺼내지 않았습니다. 확인이 필요합니다.`;
  }
  return `[복약지킴이] ${who}님, ${label} 약(${time})을 ${offset}분째 꺼내지 않았습니다. 약을 복용해 주세요.`;
}

async function checkDoses() {
  const today = todayLocal();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 오늘 날짜의 칸이 있는 사용자와 그 사용자의 복약 일정
  const [rows] = await pool.query(
    `SELECT DISTINCT s.user_id, s.period, s.time, u.name
       FROM cube_slots c
       JOIN schedules s ON s.user_id = c.user_id
       JOIN users u ON u.id = c.user_id
      WHERE c.target_date = ?`,
    [today]
  );

  for (const row of rows) {
    const [h, m] = row.time.split(":").map(Number);
    const lateBy = nowMin - (h * 60 + m);
    const label = PERIOD_LABEL[row.period] || row.period;

    // 오늘 이 시간대에 이미 복약 기록이 있으면 모든 단계의 알림을 보내지 않는다
    const [logs] = await pool.query(
      `SELECT 1 FROM medication_logs WHERE user_id = ? AND target_date = ? AND period = ? LIMIT 1`,
      [row.user_id, today, row.period]
    );
    if (logs.length > 0) continue;

    for (let stage = 0; stage < STAGES_MIN.length; stage++) {
      const offset = STAGES_MIN[stage];
      if (lateBy < offset || lateBy > offset + STAGE_WINDOW_MIN) continue;

      // 같은 단계 알림을 한 번만 보내도록 먼저 자리를 잡는다
      const [result] = await pool.query(
        `INSERT IGNORE INTO notification_logs (user_id, target_date, period, stage) VALUES (?, ?, ?, ?)`,
        [row.user_id, today, row.period, stage]
      );
      if (result.affectedRows === 0) continue;

      // 받는 사람: 0단계는 복약자만, 그 이후는 복약자 + 보호자
      const targets = stage >= GUARDIAN_FROM_STAGE ? ["patient", "guardian"] : ["patient"];
      const results = await Promise.all(
        targets.map((t) =>
          sendTelegram(buildMessage(stage, offset, row.name, label, row.time, t), t)
        )
      );
      const ok = results.some(Boolean); // 한 명이라도 성공하면 성공

      // 모두 실패하면 기록을 지워서 다음 확인 때 다시 시도
      if (!ok) {
        await pool.query(
          `DELETE FROM notification_logs WHERE user_id = ? AND target_date = ? AND period = ? AND stage = ?`,
          [row.user_id, today, row.period, stage]
        );
      }
    }
  }
}

let running = false;

function startNotifier() {
  console.log(`복약 알림 스케줄러 시작 (단계: ${STAGES_MIN.join(", ")}분, 단계별 허용 구간 ${STAGE_WINDOW_MIN}분)`);
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await checkDoses();
    } catch (err) {
      console.error("복약 알림 확인 오류:", err);
    } finally {
      running = false;
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startNotifier };