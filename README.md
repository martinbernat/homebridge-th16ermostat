# TH16ermostat 
## Homebridge plugin for Sonoff TH16/TH10

This is a simple accessory plugin to control Sonoff TH16/TH10 with thermal probe (DS18B20) to a simple thermostat.
Version 0.0.2 so use on you own risk and be patient. Planning to support at least one probe with humidity sensor (Sonoff AM2301) once it arrives from China.

# Prerequisities

Tasmotized Sonoff TH16/TH10. Google for "Sonoff TH16 Tasmota" if you still use original firmware (eWeLink app).

# Installation

1. Install homebridge using: `[sudo] npm install -g homebridge`
2. Install this plugin using: `[sudo] npm install -g homebridge-th16ermostat`
3. Update your configuration file, at least the IP address of TH16/TH10 device. See the sample below.

# Configuration

Add the following information to your config file in "accessories" section:
Only required values are "name" and "deviceIPAddress". Values shown are used as default values.

```
    "accessories": [
        {
            "accessory": "TH16ermostat",
            "name": "Kitchen Infra Heater",
            "deviceIPAddress": "",

            "minTemp": -25,
            "maxTemp": 40,
            "stepTemp": 0.5,
            "deltaTemp": 0.2,
            "pollingInterval": 10
            "deviceStatStatus": "/cm?cmnd=status%208",
            "deviceStatPower": "/cm?cmnd=power",
            "deviceCmndOn": "/cm?cmnd=power%20on",
            "deviceCmndOff": "/cm?cmnd=power%20onf",
            "pollingInterval": "60",
        },
    ],
```

# Description of settings

```
    "minTemp"           "Minimum Temperature allowed to set (shown in UI)",
    "maxTemp"           "Maximum Temperature allowed to set (shown in UI)",
    "stepTemp"          "Step to increment/decrement the temperature in UI.",
    "deltaTemp"         "Required difference between target and current temperature to switch relay state.",
 
    "deviceIPAddress"   "TH16 IP Address (aka Tasmota address) - e.g. '192.168.1.5'",
    "deviceStatStatus"  "TH16 (Tasmota) Status HTTP location",
    "deviceStatPower"   "TH16 (Tasmota) Power status HTTP location",
    "deviceCmndOn"      "TH16 (Tasmota) Power ON HTTP location",
    "deviceCmndOff"     "TH16 (Tasmota) Power OFF HTTP location",

    "pollingInterval":  "Time after we repeat the request for status of the device",
```
