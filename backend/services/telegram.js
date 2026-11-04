// 쉼표로 구분된 chat_id 문자열을 배열로 바꿈
function parseIds(value) {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function sendOne(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("텔레그램 전송 실패:", data.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error("텔레그램 전송 오류:", err.message);
    return false;
  }
}

// target: "patient"(복약자) 또는 "guardian"(보호자 전원). 생략하면 복약자
async function sendTelegram(text, target = "patient") {
  const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    TELEGRAM_CHAT_ID_PATIENT,
    TELEGRAM_CHAT_ID_GUARDIANS,
  } = process.env;

  // 기존 TELEGRAM_CHAT_ID는 복약자용으로 계속 인식
  const patientIds = parseIds(TELEGRAM_CHAT_ID_PATIENT || TELEGRAM_CHAT_ID);
  let ids = target === "guardian" ? parseIds(TELEGRAM_CHAT_ID_GUARDIANS) : patientIds;

  if (target === "guardian" && ids.length === 0) {
    console.warn("보호자 chat_id가 없어 복약자에게 대신 보냅니다");
    ids = patientIds;
  }

  if (!TELEGRAM_BOT_TOKEN || ids.length === 0) {
    console.warn("텔레그램 설정(.env)이 없어 알림을 보내지 못했습니다");
    return false;
  }

  const results = await Promise.all(ids.map((id) => sendOne(TELEGRAM_BOT_TOKEN, id, text)));
  return results.some(Boolean); // 한 명이라도 성공하면 성공으로 처리
}

module.exports = { sendTelegram };