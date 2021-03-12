# TH16ermostat 
## Homebridge plugin for Sonoff TH16/TH10

This is a simple accessory plugin to control Sonoff TH16/TH10 with thermal probe (DS18B20, SI7021, others) like a thermostat.
Humidity sensors are supported and can be enabled or disabled.
Use on you own risk and be patient.

# Prerequisities

Tasmotized Sonoff TH16/TH10. Google for "Sonoff TH16 Tasmota" if you still use original firmware (eWeLink app).

# Installation

1. Install homebridge using: `[sudo] npm install -g homebridge`
2. Install this plugin using: `[sudo] npm install -g homebridge-th16ermostat`
3. Update your configuration file, at least the IP address of TH16/TH10 device. See the sample below.

# Configuration

Add the following information to your config file in "accessories" section:
Only required values are "accessory", "name", "sensorName" and "deviceIPAddress". Values shown are used as default values.

_Note: If if fails to start/initialize after installing and configuring through homebridge, check the config. It might have different accessory identifier, e.g. 'homebridge-th16ermostat' instead of 'TH16ermostat'. Also 'name' and 'sensorName' cannot be missing. As 'sensorName' use the name of your probe. You can see it in the output of http://x.x.x.x/cm?cmnd=status%208, for example 'DS18B20' (put your Tasmota IP address instead of x.x.x.x)_

```
    "accessories": [
        {
            "accessory": "TH16ermostat",
            "name": "Kitchen Infra Heater",
            "sensorName": "DS18B20",
            "deviceIPAddress": "",

            "enableHumidity": false,
            "minTemp": -25,
            "maxTemp": 40,
            "stepTemp": 0.5,
            "deltaTemp": 0.2,
            "pollingInterval": 60,
            "deviceStatStatus": "/cm?cmnd=status%208",
            "deviceStatPower": "/cm?cmnd=power",
            "deviceCmndOn": "/cm?cmnd=power%20on",
            "deviceCmndOff": "/cm?cmnd=power%20off"
        },
    ],
```

# Description of settings

```
    "sensorName"        "TH16 (Tasmota) connected sensor name (check http://x.x.x.x/cm?cmnd=status%208)",
    "deviceIPAddress"   "TH16 IP Address (aka Tasmota address) - e.g. '192.168.1.5'",

    "enableHumidity"    "You should disable this if thermal probe does not include humidity sensor.",
    "minTemp"           "Minimum Temperature allowed to set (shown in UI)",
    "maxTemp"           "Maximum Temperature allowed to set (shown in UI)",
    "stepTemp"          "Step to increment/decrement the temperature in UI.",
    "deltaTemp"         "Required difference between target and current temperature to switch relay state. Minimum value is 0.1 to prevent frequent relay switching",
    "pollingInterval":  "Time after we repeat the request for status of the device",

    "deviceStatStatus"  "TH16 (Tasmota) Status HTTP location",
    "deviceStatPower"   "TH16 (Tasmota) Power status HTTP location",
    "deviceCmndOn"      "TH16 (Tasmota) Power ON HTTP location",
    "deviceCmndOff"     "TH16 (Tasmota) Power OFF HTTP location",
```
