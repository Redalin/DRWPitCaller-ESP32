// connect-wifi.h
#ifndef CONNECT_WIFI_H
#define CONNECT_WIFI_H

#include <WiFi.h>
#include <WiFiClientSecure.h>

void initMDNS();
void initWifi();
int scanForWifi();
String connectToWifi();
void createWifi();

#endif  // CONNECT_WIFI_H