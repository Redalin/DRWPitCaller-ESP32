// Removing the Pitcaller stuff into another file also
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <AsyncWebSocket.h>
#include "display-pitcaller.h"


AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

#define NUM_LANES 4
const uint8_t lanePins[NUM_LANES] = {15, 16, 17, 18};
unsigned long lastCheckTime = 0;
unsigned long countdownTimers[NUM_LANES] = {0};
int countdownTimer = 3;

struct ButtonState {
  String label;
  String pilotName;
  int countdown;
  bool isPitting;
  int pitCount;
};

ButtonState buttonStates[NUM_LANES] = {
  {"Lane 1", "", 0, false, 0},
  {"Lane 2", "", 0, false, 0},
  {"Lane 3", "", 0, false, 0},
  {"Lane 4", "", 0, false, 0}
};

void resetCountStats() {
  // Serial.println("Resetting lanes");
  for (int lane = 0; lane < NUM_LANES; lane++) {
    // Serial.println((String)"Resetting lane" + lane);
    buttonStates[lane].pitCount = 0;
  }
}

void notifyClients() {
  String message = "{\"type\":\"update\",\"data\":[";
  for (int i = 0; i < NUM_LANES; i++) {
    message += "{\"label\":\"" + buttonStates[i].label + "\",\"pilotName\":\"" + buttonStates[i].pilotName + "\",\"countdown\":" + String(buttonStates[i].countdown) + ",\"isPitting\":" + (buttonStates[i].isPitting ? "true" : "false") + "}";
    
    if (i < NUM_LANES - 1) message += ",";
  }
  message += "]}";
  ws.textAll(message);
}

void announcePitting(int lane, bool isPitting) {
  String message = "{\"type\":\"announce\",\"lane\":" + String(lane) + ",\"pilotName\":\"" + buttonStates[lane].pilotName + "\",\"isPitting\":" + (isPitting ? "true" : "false") + ",\"pitCount\":" + buttonStates[lane].pitCount + "}";
  // Serial.print("AnnouncePitting message is:  ");
  // Serial.println(message);
  String oledMessage = "Lane:" + String(lane+1) + " " + buttonStates[lane].pilotName + " " + (isPitting ? "Pitting" : "Leaving");
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
      buttonStates[lane].pilotName = name;
      buttonStates[lane].label = "Lane " + String(lane + 1) + ": " + name;
    } else if (message.startsWith("resetStats")){
      resetCountStats();
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
  for (int i = 0; i < NUM_LANES; i++) {
    if (digitalRead(lanePins[i]) == HIGH) { // Assuming switch opens to high
      if (buttonStates[i].countdown == 0) { // Only trigger if not already in countdown
        buttonStates[i].countdown = countdownTimer;
        countdownTimers[i] = millis();
        notifyClients();
        buttonStates[i].isPitting = !buttonStates[i].isPitting; // change the pitting flag for a button press
        announcePitting(i, buttonStates[i].isPitting);
      }
    }
  }
}