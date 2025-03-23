// Removing the Pitcaller stuff into another file also
#include "config.h"
#include <AsyncTCP.h>
#include <AsyncWebSocket.h>
#include "display-pitcaller.h"
#include <ArduinoJson.h>
#include "pitweb.h"
#include <Preferences.h>

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

String customAnnounceMessageBefore = "";
String customAnnounceMessageAfter = "";

AsyncWebSocket ws("/ws");
AsyncWebServer server(80);
Preferences teamNamepreferences;

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
    } else if (type == "updateCustomMessages") {
      // Receive and update custom messages
      String customMessageBefore = doc["customMessageBefore"];
      String customMessageAfter = doc["customMessageAfter"]; 
      String broadcastMessage = "{\"type\":\"updateCustomMessages\",\"customMessageBefore\":\"" + customMessageBefore + "\",\"customMessageAfter\":\"" + customMessageAfter + "\"}";
      
      customAnnounceMessageAfter = customMessageAfter;
      customAnnounceMessageBefore = customMessageBefore;
      ws.textAll(broadcastMessage);
    } else if (type == "getCustomMessages") {
      // Send the custom messages to the client
      String broadcastMessage = "{\"type\":\"updateCustomMessages\",\"customMessageBefore\":\"" + customAnnounceMessageBefore + "\",\"customMessageAfter\":\"" + customAnnounceMessageAfter + "\"}";
      ws.textAll(broadcastMessage);
    } else if (type == "updateTeamNames") {
      debugln("Received updateTeamNames message: " + message);
      saveTeamNamesInPreferences(message);
    } else if (type == "getTeamNames") {
      debugln("Received getTeamNames message: " + message);
      getTeamNamesFromPreferences();
    } else {
      debugln("Unknown message type: " + type);
    }
  } else {
    debugln("Unknown message type");
  }
}

// write the team names to the preferences API
void saveTeamNamesInPreferences(String message) {
  teamNamepreferences.begin("teamNames", false); // Open preferences with namespace "teamNames"
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.print(F("deserializeJson() failed: "));
    Serial.println(error.f_str());
    return;
  }

  void getTeamNamesFromPreferences();{
    int totalTeamNames = 6;
    teamNamepreferences.begin("teamNames", false); // Open preferences with namespace "teamNames"
    String teamNames = "{\"type\":\"teamNames\",\"teamNames\":[";
    for (int i = 0; i < totalTeamNames; i++) {
      String teamId = "team" + String(i + 1); // Assuming team IDs are in the format "team1", "team2", etc.
      String teamName = teamNamepreferences.getString(teamId.c_str(), "Lane " + String(i + 1));
      teamNames += "\"" + teamName + "\"";
      if (i < totalTeamNames - 1) teamNames += ",";
    }
    teamNames += "]}";
    teamNamepreferences.end(); // Close preferences
    ws.textAll(teamNames);
  }

  JsonArray teamNames = doc["teamNames"];
  for (int i = 0; i < teamNames.size(); i++) {
    String teamName = teamNames[i];
    String teamId = "team" + String(i + 1); // Assuming team IDs are in the format "team1", "team2", etc.
    teamNamepreferences.putString(teamId.c_str(), teamName);
    debugln("Saved " + teamId + " with name: " + teamName);
  }

  teamNamepreferences.end(); // Close preferences
}

void checkLaneSwitches() {
  for (int lane = 0; lane < NUM_LANES; lane++) {
    if (digitalRead(lanePins[lane]) == LOW) { // Assuming switch opens to HIGH but use LOW for testing
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