/*********
  Complete project details at https://randomnerdtutorials.com

  This is an example for our Monochrome OLEDs based on SSD1306 drivers. Pick one up today in the adafruit shop! ------> http://www.adafruit.com/category/63_98
  This example is for a 128x32 pixel display using I2C to communicate 3 pins are required to interface (two I2C and one reset).
  Adafruit invests time and resources providing this open source code, please support Adafruit and open-source hardware by purchasing products from Adafruit!
  Written by Limor Fried/Ladyada for Adafruit Industries, with contributions from the open source community. BSD license, check license.txt for more information All text above, and the splash screen below must be included in any redistribution.
*********/

#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "display-pitcaller.h"
#include <WiFi.h>


#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels

// Declaration for an SSD1306 display connected to I2C (SDA, SCL pins)
#define OLED_RESET -1 // Reset pin # (or -1 if sharing Arduino reset pin)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

String textMessage = "Getting ready...";

void displayText(String message) {
  //Serial.println(F("Into text displaytext method"));  
  //Serial.println(F("Clearing OLED display"));  
  display.clearDisplay();

  display.setTextSize(1.5);      // Normal 1:1 pixel scale
  display.setTextColor(WHITE); // Draw white text
  display.setCursor(0, 30);     // Start half way down
  display.cp437(true);         // Use full 256 char 'Code Page 437' font

  display.print("HTTP://");
  display.println(WiFi.getHostname());
  display.print("IP: ");
  display.println(WiFi.localIP());
  display.println(message);
  display.display();
}

void displaysetup() {

  // SSD1306_SWITCHCAPVCC = generate display voltage from 3.3V internally
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;)
      ; // Don't proceed, loop forever
  }

  // Show initial display buffer contents on the screen --
  // the library initializes this with an Adafruit splash screen.
  Serial.println(F("Initializing OLED display"));  
  display.display();
  delay(2000); // Pause for 2 seconds

  // Clear the screen and prepare for drawing lines
  displayText(textMessage);

}
