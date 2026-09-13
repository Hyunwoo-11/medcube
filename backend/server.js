require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const app = express();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.get("/", (req, res) => {
  res.send("서버 확인 완료");
});

app.listen(process.env.PORT, async () => {
  console.log(`서버 실행 중: http://localhost:${process.env.PORT}`);

  try {
    await pool.query("SELECT 1");
    console.log("DB 연결 성공!");
  } catch (err) {
    console.error("DB 연결 실패:", err.message);
  }
});