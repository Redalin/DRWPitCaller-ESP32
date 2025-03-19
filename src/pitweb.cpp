// Removing the Pitcaller stuff into another file also
#include "config.h"
#include <AsyncTCP.h>
#include <AsyncWebSocket.h>
#include "display-pitcaller.h"
#include <ArduinoJson.h>
#include "pitweb.h"

const uint8_t lanePins[NUM_LANES] = {15, 16, 17, 18};
unsigned long lastCheckTime = 0;
unsigned long countdownTimers[NUM_LANES] = {0};
int countdownTimer = 20;

// struct ButtonState {
//   String TeamName;
//   int countdown;
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
  Serial.println("Init Done. Ready");
  displayText("Ready");
}

// This function takes a lane number and formats a message
// It then sends the message to all connected clients
void announcePilotSwap(int lane) {
  String message = "{\"type\":\"pilotSwap\",\"team\":" + String(lane) + "}";
  debug("announcePilotSwap message is:  ");
  debugln(message);
  buttonStates[lane-1].countdown = countdownTimer;
  String oledMessage = "Lane " + String(lane) + ": Pilot Swap";
  displayText(oledMessage);
  ws.textAll(message);
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    //client->text("Connected");
    notifyClients();
  } else if (type == WS_EVT_DATA) {
    debugln("OnEvent WS_EVT_Data received");
    debugln("Data is: " + String((char*)data));
    handleWebSocketMessage(arg, data, len);
  }
}

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  debugln("Handling Websocket message");
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    data[len] = 0;
    String message = (char*)data;
    debugln("Message is: " + message);
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      return;
    }
    String type = doc["type"];
    if (type == "pilotSwap") {
      String teamId = doc["teamId"];
      String buttonId = doc["buttonId"];
      debugln("Received pilotSwap message for team: " + teamId + " with button: " + buttonId);
      int lane = teamId.toInt();
      announcePilotSwap(lane);
      notifyClients(); // Ensure clients are notified after pilot swap

    } else if (type == "update") {
      String teamId = doc["teamId"];
      String teamName = doc["teamName"];
      debugln("Received update message for team: " + teamId + " with name: " + teamName);
      int lane = teamId.substring(4).toInt() - 1; // Assuming teamId is in the format "teamX"
      buttonStates[lane].teamName = teamName;
      notifyClients(); // Ensure clients are notified after update
    } else {
      debugln("Unknown message type: " + type);
    }
  } else {
    debugln("Unknown message type");
  }
}

void checkLaneSwitches() {
  for (int lane = 0; lane < NUM_LANES; lane++) {
    if (digitalRead(lanePins[lane]) == HIGH) { // Assuming switch opens to high
      debugln("Lane " + String(lane+1) + " pressed");
      if (buttonStates[lane].countdown == 0) { // Only trigger if not already in countdown
        buttonStates[lane].countdown = countdownTimer;
        countdownTimers[lane] = millis();
        notifyClients();
        announcePilotSwap(lane+1); // add 1 because lane is 0 indexed
      }
    }
  }
}

void notifyClients() {
  String message = "{\"type\":\"update\",\"data\":[";
  for (int lane = 0; lane < NUM_LANES; lane++) {
    message += "{\"teamName\":\"" + buttonStates[lane].teamName + "\",\"countdown\":" + String(buttonStates[lane].countdown) + "}";
    
    if (lane < NUM_LANES - 1) message += ",";
  }
  message += "]}";
  debugln("NotifyClients message is: " + message);
  ws.textAll(message);
}

void cleanupWebClients() {
  ws.cleanupClients();
}