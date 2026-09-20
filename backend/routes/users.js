// routes/users.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// 1. 내 정보 조회
router.get("/me/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, invite_code, linked_user_id FROM users WHERE id = ?",
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "사용자를 찾을 수 없습니다" });
    }
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "내 정보 조회 실패" });
  }
});

// 2. 보호자 계정 연결 (초대코드)
router.post("/link-guardian", async (req, res) => {
  const { guardianUserId, invite_code } = req.body;
  try {
    const [guardianRows] = await pool.query(
      "SELECT id, role FROM users WHERE id = ?",
      [guardianUserId]
    );
    if (guardianRows.length === 0) {
      return res.status(404).json({ ok: false, error: "사용자를 찾을 수 없습니다" });
    }
    if (guardianRows[0].role !== "guardian") {
      return res.status(400).json({ ok: false, error: "보호자 계정만 연결할 수 있습니다" });
    }

    const [patientRows] = await pool.query(
      "SELECT id, name FROM users WHERE invite_code = ? AND role = 'user'",
      [invite_code]
    );
    if (patientRows.length === 0) {
      return res.status(400).json({ ok: false, error: "유효하지 않은 초대코드입니다" });
    }
    const patient = patientRows[0];

    await pool.query("UPDATE users SET linked_user_id = ? WHERE id = ?", [
      patient.id,
      guardianUserId,
    ]);

    res.json({ ok: true, linkedTo: { id: patient.id, name: patient.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "보호자 연결 실패" });
  }
});

// 3. 나(복약자)에게 연결된 보호자 목록 조회
router.get("/guardians/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'guardian' AND linked_user_id = ?",
      [userId]
    );
    res.json({ ok: true, guardians: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "보호자 목록 조회 실패" });
  }
});

module.exports = router;