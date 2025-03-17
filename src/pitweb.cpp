// Removing the Pitcaller stuff into another file also
#include <AsyncTCP.h>
#include <AsyncWebSocket.h>
#include "display-pitcaller.h"
#include "pitweb.h"

const uint8_t lanePins[NUM_LANES] = {15, 16, 17, 18};
unsigned long lastCheckTime = 0;
unsigned long countdownTimers[NUM_LANES] = {0};
int countdownTimer = 5;

// struct ButtonState {
//   String TeamName;
//   int countdown;
//   bool isPitting;
// };

ButtonState buttonStates[NUM_LANES] = {
  {"Lane 1", 0},
  {"Lane 2", 0},
  {"Lane 3", 0},
  {"Lane 4", 0}
};


AsyncWebSocket ws("/ws");
AsyncWebServer server(80);

void initLittleFS() {
  if (!LittleFS.begin()) {
    Serial.println("An error has occurred while mounting LittleFS");
    return;
  }
  Serial.println("LittleFS mounted successfully");
}

void initwebservers(){ 
  ws.onEvent(onEvent);
  server.addHandler(&ws);

  Serial.println("Starting Web Server");
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/index.html", "text/html");
  });
  server.on("/favicon.png", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/favicon.png", "image/png");
  });

  server.serveStatic("/", LittleFS, "/");
  server.begin();

  for (int i = 0; i < NUM_LANES; i++) {
    buttonStates[i].countdown = 0;
    pinMode(lanePins[i], INPUT_PULLUP); // Assuming switch closes to ground
  }
}

void cleanupWebClients() {
  ws.cleanupClients();
}

void notifyClients() {
  String message = "{\"type\":\"update\",\"data\":[";
  for (int lane = 0; lane < NUM_LANES; lane++) {
    message += "{\"teamName\":\"" + buttonStates[lane].teamName + "\",\"countdown\":" + String(buttonStates[lane].countdown) + "}";
    
    if (lane < NUM_LANES - 1) message += ",";
  }
  message += "]}";
  ws.textAll(message);
}

void announcePilotSwap(int lane) {
  String message = "{\"type\":\"announce\",\"lane\":" + String(lane) + "}";
  Serial.print("announcePilotSwap message is:  ");
  Serial.println(message);
  String oledMessage = "Lane " + String(lane+1) + ": Pilot Swap";
  displayText(oledMessage);
  ws.textAll(message);
}

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    data[len] = 0;
    String message = (char*)data;
    if (message.startsWith("pilotSwap")) {
      Serial.println("Received message: " + message);
      int lane = message.substring(1).toInt();
      Serial.println("Substring5 = " + String(lane));
      buttonStates[lane].countdown = countdownTimer;
      countdownTimers[lane] = millis();
      announcePilotSwap(lane);
    } else if (message.startsWith("update")) {
      int lane = message.charAt(6) - '0';
      String name = message.substring(8);
      buttonStates[lane].teamName = "Team: " + name;
    } else {
      Serial.println("Unknown message: " + message);
    }
    notifyClients();
  }
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    client->text("Connected");
    notifyClients();
  } else if (type == WS_EVT_DATA) {
    handleWebSocketMessage(arg, data, len);
  }
}

void checkLaneSwitches() {
  for (int lane = 0; lane < NUM_LANES; lane++) {
    if (digitalRead(lanePins[lane]) == HIGH) { // Assuming switch opens to high
      if (buttonStates[lane].countdown == 0) { // Only trigger if not already in countdown
        buttonStates[lane].countdown = countdownTimer;
        countdownTimers[lane] = millis();
        notifyClients();
        announcePilotSwap(lane);
      }
    }
  }
}