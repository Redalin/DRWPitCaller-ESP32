#include "config.h"
#include <arduino.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include "connect-wifi.h"
#include "pitweb.h"

// The include for the Display is now in pitWeb.h directly
// This is so we can send the button press messages to the OLED display
//#include "display-pitcaller.h"

void setup() {

  Serial.begin(115200);
  // Setup the OLED Display
  displaysetup();

  if (!LittleFS.begin()) {
    Serial.println("An error has occurred while mounting LittleFS");
    return;
  }
  Serial.println("LittleFS mounted successfully");

  // Scan for known wifi Networks
  initWifi();
  
  // Initialize mDNS
  initMDNS();

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

void loop() {
  ws.cleanupClients();
  // checkLaneSwitches();

  unsigned long currentTime = millis();
  for (int i = 0; i < NUM_LANES; i++) {
    if (buttonStates[i].countdown > 0 && (currentTime - countdownTimers[i]) >= 1000) {
      buttonStates[i].countdown--;
      countdownTimers[i] = currentTime;
      notifyClients();
    }
  }

  // Check lane switches every 50 ms to debounce
  if (currentTime - lastCheckTime > 50) {
    lastCheckTime = currentTime;
    checkLaneSwitches();
  }
}
