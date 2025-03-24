#ifndef PITWEB_H
#define PITWEB_H

// Removing the Pitcaller stuff into another file also
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <AsyncWebSocket.h>
#include "display-pitcaller.h"
#include <LittleFS.h>

struct ButtonState {
  String teamName;
  int countdown;
};


#define NUM_LANES 4
extern const uint8_t lanePins[NUM_LANES];
extern unsigned long lastCheckTime;
extern unsigned long countdownTimers[NUM_LANES];
extern int countdownTimer;
extern ButtonState buttonStates[NUM_LANES];
extern String customAnnounceMessageBefore;
extern String customAnnounceMessageAfter;
extern int numSavedTeams;

void initwebservers();
void initLittleFS();
void cleanupWebClients();
void notifyClients();
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);
void pilotSwap(String teamId, String buttonId);
void update(String teamId, String teamName);
void updateCustomMessages(String customMessageBefore, String customMessageAfter);
void getCustomMessages();
void announcePilotSwap(int lane);
void saveTeamNamesInFile(String message);
void getTeamNamesFromFile();
void saveTeamNamesInPreferences(String message);
void getTeamNamesFromPreferences();
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
void checkLaneSwitches();

#endif  // PITWEB_H