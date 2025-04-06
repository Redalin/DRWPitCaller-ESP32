#include "config.h"
#include "connect-wifi.h"
#include <arduino.h>
#include "pitweb.h"
#include "display-pitcaller.h"

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
  initPrettyOTA();

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
