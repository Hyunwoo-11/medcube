/*
  복약지킴이 - ESP32 펌웨어 (프로토타입: 큐브 1개 기준)

  하는 일 딱 3가지:
  1. WiFi에 연결한다
  2. 리드스위치 핀 값을 계속 확인한다 (큐브가 꽂혀있는지 빠졌는지)
  3. 상태가 바뀌는 순간에만 서버로 HTTP POST를 보낸다

  배선:
  - 리드스위치 한쪽 다리 -> GPIO 4번 핀
  - 리드스위치 다른쪽 다리 -> GND
  - 자석은 큐브(빼는 부분) 바닥에 부착, 리드스위치는 약통 본체 쪽에 부착
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ---- 여기 3개만 본인 환경에 맞게 수정하세요 ----
const char* WIFI_SSID = "your_wifi_name";
const char* WIFI_PASSWORD = "your_wifi_password";
const char* SERVER_URL = "http://192.168.0.10:3000/api/cube-status"; // 노트북의 로컬 IP:3000

const int REED_PIN = 4;   // 리드스위치가 연결된 GPIO 번호
const int CUBE_ID = 1;    // 이 보드가 담당하는 큐브 번호

// INPUT_PULLUP을 쓰면: 평소엔 HIGH(1), 자석이 가까워지면(큐브 꽂힘) LOW(0)
bool lastPinWasHigh = true;

void setup() {
  Serial.begin(115200);
  pinMode(REED_PIN, INPUT_PULLUP);
  connectWiFi();
}

void connectWiFi() {
  Serial.print("WiFi 연결 중");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi 연결됨! ESP32 IP 주소: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  bool pinIsHigh = digitalRead(REED_PIN);

  if (pinIsHigh != lastPinWasHigh) {
    delay(50); // 짧은 흔들림(채터링) 방지
    if (digitalRead(REED_PIN) == pinIsHigh) {
      lastPinWasHigh = pinIsHigh;
      String status = pinIsHigh ? "removed" : "inserted";
      sendStatusToServer(status);
    }
  }

  delay(200);
}

void sendStatusToServer(String status) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"cubeId\":" + String(CUBE_ID) + ",\"status\":\"" + status + "\"}";
  Serial.println("서버로 전송: " + payload);

  int httpCode = http.POST(payload);
  Serial.println("서버 응답 코드: " + String(httpCode));

  http.end();
}