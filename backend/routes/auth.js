const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../db");

// 초대코드 랜덤 생성 (헷갈리는 O,0,I,1 제외한 6자리)
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const invite_code = role === "user" ? generateInviteCode() : null;

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, invite_code) VALUES (?, ?, ?, ?, ?)",
      [name, email, password_hash, role, invite_code]
    );

    res.json({ ok: true, userId: result.insertId, invite_code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "회원가입 실패" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다" });
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        invite_code: user.invite_code,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "로그인 실패" });
  }
});

module.exports = router;