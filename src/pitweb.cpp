// Removing the Pitcaller stuff into another file also
#include "pitweb.h"

const uint8_t lanePins[NUM_LANES] = {15, 16, 17, 18};
unsigned long lastCheckTime = 0;
unsigned long countdownTimers[NUM_LANES] = {0};
int countdownTimer;
Preferences countdownPreference;

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
PrettyOTA      OTAUpdates;
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

void initPrettyOTA() {
  // Print IP address
  debugln("PrettyOTA can be accessed at: http://" + WiFi.localIP().toString() + "/update");

  // Initialize PrettyOTA
  OTAUpdates.Begin(&server);

  // Set firmware version to 1.0.0
  OTAUpdates.OverwriteAppVersion("1.0.0");

  // Set current build time and date
  PRETTY_OTA_SET_CURRENT_BUILD_TIME_AND_DATE();

  OTAUpdates.OnStart(OnOTAStart);

}

// Gets called when update starts
// updateMode can be FILESYSTEM or FIRMWARE
void OnOTAStart(NSPrettyOTA::UPDATE_MODE updateMode)
{
    Serial.println("OTA update started");

    if(updateMode == NSPrettyOTA::UPDATE_MODE::FIRMWARE) {
        Serial.println("Mode: Firmware");
    }
    else if(updateMode == NSPrettyOTA::UPDATE_MODE::FILESYSTEM) {
        Serial.println("Mode: Filesystem - umounting LittleFS");
        LittleFS.end();
    }
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
      pilotSwap(doc["teamId"], doc["buttonId"]);
    } else if (type == "update") {
      update(doc["teamId"], doc["teamName"]);
    } else if (type == "updateCustomMessages") {
      updateCustomMessages(doc["customMessageBefore"], doc["customMessageAfter"]);
    } else if (type == "getCustomMessages") {
      getCustomMessages();
    } else if (type == "updateTeamNames") {
      saveTeamNamesInPreferences(message);
    } else if (type == "getTeamNames") {
      getTeamNamesFromPreferences();
    } else if (type == "getCountdownTimer") {
      getCountdownTimer();
    } else if (type == "updateCountdownTimer") {
      updateCountdownTimer(doc["timerValue"]);
    } else {
      debugln("Unknown message type: " + type);
    }
  } else {
    debugln("Unknown message type");
  }
}


// The PilotSwap method
void pilotSwap(String teamId, String buttonId) {
  debugln("Received pilotSwap message for team: " + teamId + " with button: " + buttonId);
  int lane = teamId.toInt();
  announcePilotSwap(lane);
  notifyClients(); // Ensure clients are notified after pilot swap
}

// Update the Team Name for a lane
void update(String teamId, String teamName) {
  debugln("Received update message for team: " + teamId + " with name: " + teamName);
  int lane = teamId.substring(4).toInt() - 1; // Assuming teamId is in the format "teamX"
  buttonStates[lane].teamName = teamName;
  notifyClients(); // Ensure clients are notified after update
}

void updateCustomMessages(String customMessageBefore, String customMessageAfter) {
  // Receive and update custom messages
  customAnnounceMessageBefore = customMessageBefore;
  customAnnounceMessageAfter = customMessageAfter;
  String broadcastMessage = "{\"type\":\"updateCustomMessages\",\"customMessageBefore\":\"" + customAnnounceMessageBefore + "\",\"customMessageAfter\":\"" + customAnnounceMessageAfter + "\"}";
  ws.textAll(broadcastMessage);
}

void getCustomMessages() {
  // Send the custom messages to the client
  String broadcastMessage = "{\"type\":\"updateCustomMessages\",\"customMessageBefore\":\"" + customAnnounceMessageBefore + "\",\"customMessageAfter\":\"" + customAnnounceMessageAfter + "\"}";
  ws.textAll(broadcastMessage);
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
  JsonArray teamNames = doc["teamNames"].as<JsonArray>();
  int numSavedTeams = teamNames.size();
  debugln("Number of teams to save: " + String(numSavedTeams));
  teamNamepreferences.clear(); // Clear all existing preferences
  for (int i = 0; i < numSavedTeams; i++) {
    String teamId = "team" + String(i + 1); // Assuming team IDs are in the format "team1", "team2", etc.
    String teamName = teamNames[i].as<String>();
    teamNamepreferences.putString(teamId.c_str(), teamName);
    debugln("Saved team name: " + teamName + " for team ID: " + teamId);
  }
  teamNamepreferences.end(); // Close preferences
}

void getTeamNamesFromPreferences() {
  teamNamepreferences.begin("teamNames", true); // Open preferences with namespace "teamNames" in readOnly mode
  String teamNames = "{\"type\":\"updateTeamNames\",\"teamNames\":[";
  String teamName = "";
  int i = 0;

  while (true) {
    String teamId = "team" + String(i + 1); // Assuming team IDs are in the format "team1", "team2", etc.
    teamName = teamNamepreferences.getString(teamId.c_str(), "");
    if (teamName == "") break;
    // debugln("Read team name: " + teamName + " for team ID: " + teamId);
    teamNames += "\"" + teamName + "\",";
    i++;
  }
  // remove the last comma
  teamNames = teamNames.substring(0, teamNames.length() - 1);
  teamNames += "]}";
  teamNamepreferences.end(); // Close preferences
  debugln("Team names list from Preferences is: " + teamNames);
  ws.textAll(teamNames);
}

void getCountdownTimer() {
  countdownPreference.begin("timer", true);
  countdownTimer = countdownPreference.getInt("timer", 0);
  countdownPreference.end();
  String timerString = "{\"type\":\"timerUpdate\",\"timerValue\":" + String(countdownTimer) + "}";
  debugln("TimerValue is: " + countdownTimer);
  ws.textAll(timerString);
}

// Save the timer value to preferences
void updateCountdownTimer(int timer) {
  countdownTimer = timer;
  countdownPreference.begin("timer", false);
  countdownPreference.putInt("timer", countdownTimer);
  countdownPreference.end();
}

void checkLaneSwitches() {
  for (int lane = 0; lane < NUM_LANES; lane++) {
    if (digitalRead(lanePins[lane]) == HIGH) { // Assuming switch opens to HIGH but use LOW for testing
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