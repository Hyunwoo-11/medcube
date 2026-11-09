#include <WiFi.h>
#include <HTTPClient.h>

// ===== 설정 =====
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "YOUR_SERVER_IP:3000/api/cube-status";

const int USER_ID = 1;

// 칸 번호 = 배열 순서 + 1  (1=13, 2=14, 3=26, 4=25, 5=33, 6=22, 7=23)
const int CUBE_PINS[] = {13, 14, 26, 25, 33, 22, 23};
// ================

const int CUBE_COUNT = sizeof(CUBE_PINS) / sizeof(CUBE_PINS[0]);
const int BUZZER_PIN = 27;  // LOW일 때 울리는 부저 모듈

const unsigned long HEARTBEAT_MS = 10000;  // 안 바뀌어도 10초마다 현재 상태 재전송
const unsigned long DEBOUNCE_MS = 100;

int stableState[CUBE_COUNT];          // LOW = 꽂힘(inserted), HIGH = 빠짐(removed)
int lastReading[CUBE_COUNT];
unsigned long lastChange[CUBE_COUNT];
unsigned long lastSent[CUBE_COUNT];

void beep(int ms) {
  digitalWrite(BUZZER_PIN, LOW);
  delay(ms);
  digitalWrite(BUZZER_PIN, HIGH);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

// idx: 0부터 시작하는 배열 번호 (칸 번호 = idx + 1)
void sendState(int idx, int state) {
  lastSent[idx] = millis();  // 실패해도 10초 뒤에 다시 시도하도록 먼저 기록
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting");
    WiFi.reconnect();
    return;
  }
  int cubeId = idx + 1;
  const char* status = (state == LOW) ? "inserted" : "removed";
  String body = String("{\"user_id\":") + USER_ID + ",\"cube_id\":" + cubeId +
                ",\"status\":\"" + status + "\"}";

  HTTPClient http;
  http.setTimeout(3000);
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  Serial.printf("cube %d %s -> HTTP %d\n", cubeId, status, code);
  if (code > 0) Serial.println(http.getString());
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);  // HIGH = 꺼짐
  for (int i = 0; i < CUBE_COUNT; i++) pinMode(CUBE_PINS[i], INPUT_PULLUP);
  connectWifi();
  for (int i = 0; i < CUBE_COUNT; i++) {
    stableState[i] = digitalRead(CUBE_PINS[i]);
    lastReading[i] = stableState[i];
    lastChange[i] = millis();
    sendState(i, stableState[i]);  // 켜자마자 각 칸의 현재 상태를 한 번 전송
  }
}

void loop() {
  for (int i = 0; i < CUBE_COUNT; i++) {
    int reading = digitalRead(CUBE_PINS[i]);
    if (reading != lastReading[i]) {
      lastReading[i] = reading;
      lastChange[i] = millis();
    }
    if (reading != stableState[i] && millis() - lastChange[i] > DEBOUNCE_MS) {
      stableState[i] = reading;
      if (reading == HIGH) beep(150);  // 꺼냄이면 삑
      sendState(i, reading);
    }
    if (millis() - lastSent[i] > HEARTBEAT_MS) sendState(i, stableState[i]);
  }
  delay(10);
}