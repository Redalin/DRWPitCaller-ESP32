// #include "config.h"
#include <arduino.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include "wifi-pitcaller.h"
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
  WiFi.setHostname(hostname);
  scanForWifi();
  if(visibleNetworks > 0) {
    displayText("Connecting to WiFi");
    String wifiName = connectToWifi();
    String wifiMessage = "Connected to: " + wifiName;
    displayText(wifiMessage);
  } else {
    Serial.println(F("no networks found. Reset to try again"));
    while (true); // no need to go further, hang in there, will auto launch the Soft WDT reset
  }
  
  // Initialize mDNS
  if (!MDNS.begin(hostname)) {   // Set the hostname
    Serial.println("Error setting up MDNS responder!");
    while(1) {
      delay(1000);
    }
  }
  Serial.println("mDNS responder started");

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
