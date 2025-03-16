// Removing the Pitcaller stuff into another file also
#include <AsyncTCP.h>
#include <AsyncWebSocket.h>
#include "display-pitcaller.h"
#include "pitweb.h"

const uint8_t lanePins[NUM_LANES] = {15, 16, 17, 18};
unsigned long lastCheckTime = 0;
unsigned long countdownTimers[NUM_LANES] = {0};
int countdownTimer = 5;

ButtonState buttonStates[NUM_LANES] = {
  {"Lane 1", "", "", 0, false, 0},
  {"Lane 2", "", "", 0, false, 0},
  {"Lane 3", "", "", 0, false, 0},
  {"Lane 4", "", "", 0, false, 0}
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
    message += "{\"label\":\"" + buttonStates[lane].label + "\",\"activePilot\":\"" + buttonStates[lane].activePilot + "\",\"standbyPilot\":\"" + buttonStates[lane].standbyPilot + "\",\"countdown\":" + String(buttonStates[lane].countdown) + ",\"isPitting\":" + (buttonStates[lane].isPitting ? "true" : "false") + ",\"pitCount\":" + buttonStates[lane].pitCount + "}";
    
    if (lane < NUM_LANES - 1) message += ",";
  }
  message += "]}";
  ws.textAll(message);
}

void announcePitting(int lane, bool isPitting) {
  String message = "{\"type\":\"announce\",\"lane\":" + String(lane) + ",\"activePilot\":\"" + buttonStates[lane].activePilot + ",\"standbyPilot\":\"" + buttonStates[lane].standbyPilot + "\",\"isPitting\":" + (isPitting ? "true" : "false") + "}";
  // Serial.print("AnnouncePitting message is:  ");
  // Serial.println(message);
  String oledMessage = "Lane:" + String(lane+1) + " " + buttonStates[lane].activePilot + " " + (isPitting ? "Pitting" : "Leaving");
  displayText(oledMessage);
  ws.textAll(message);
}

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    data[len] = 0;
    String message = (char*)data;
    if (message.startsWith("start")) {
      int lane = message.substring(5).toInt();
      buttonStates[lane].countdown = countdownTimer;
      countdownTimers[lane] = millis();
      buttonStates[lane].isPitting = !buttonStates[lane].isPitting; // change the pitting flag
      buttonStates[lane].pitCount++;  // increment the count for number of pit events
      // Serial.println((String)"Incrementing Lane " + (lane + 1) + " pit count to " + buttonStates[lane].pitCount);
      announcePitting(lane, buttonStates[lane].isPitting);
    } else if (message.startsWith("update")) {
      int lane = message.charAt(6) - '0';
      String name = message.substring(8);
      buttonStates[lane].activePilot = name;
      buttonStates[lane].label = "Team: " + name;
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
        buttonStates[lane].isPitting = !buttonStates[lane].isPitting; // change the pitting flag for a button press
        buttonStates[lane].pitCount++;  
        announcePitting(lane, buttonStates[lane].isPitting);
      }
    }
  }
}