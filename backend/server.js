require("dotenv").config();
const express = require("express");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const scheduleRoutes = require("./routes/schedule");
const usersRoutes = require("./routes/users");

const app = express();
app.use(express.json());  

app.get("/", (req, res) => {
  res.send("서버 확인 완료");
});

app.use("/api", authRoutes);  
app.use("/api", scheduleRoutes);
app.use("/api", usersRoutes);


app.listen(process.env.PORT, async () => {
  console.log(`서버 실행 중: http://localhost:${process.env.PORT}`);
  try {
    await pool.query("SELECT 1");
    console.log("DB 연결 성공!");
  } catch (err) {
    console.error("DB 연결 실패:", err.message);
  }
});