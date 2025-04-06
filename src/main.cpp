#include "config.h"
#include "connect-wifi.h" // Wi-Fi credentials
#include <arduino.h>
#include "pitweb.h"
#include "display-pitcaller.h"
#include <ESPAsyncWebServer.h>
// #include <PrettyOTA.h>

void setup() {

  Serial.begin(115200);
  // Setup the OLED Display
  displaysetup();

  // initialise the LittleFS
  initLittleFS();

  // initialise Wifi as per the connect-wifi file
  initWifi();
  initMDNS();

  // initialise the websocket and web server
  initwebservers();

  // PrettyOTA       OTAUpdates;
  // Print IP address
  // debugln("PrettyOTA can be accessed at: http://" + WiFi.localIP().toString() + "/update");

  // Initialize PrettyOTA
  // OTAUpdates.Begin(&server);

  // Set firmware version to 1.0.0
  // OTAUpdates.OverwriteAppVersion("1.0.0");

  // Set current build time and date
  // PRETTY_OTA_SET_CURRENT_BUILD_TIME_AND_DATE();

}

void loop() {
  cleanupWebClients();
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
