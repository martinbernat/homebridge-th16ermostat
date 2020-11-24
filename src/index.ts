import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import axios from 'axios';

let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('homebridge-th16ermostat', 'TH16ermostat', TH16ermostatPlugin);
};

class TH16ermostatPlugin implements AccessoryPlugin {

  private readonly log: Logging;

  // state
  private currTemp = '';
  private targetTemp = 0;
  private currRelativeHumidity = '';
  private currentHeatingState = hap.Characteristic.CurrentHeatingCoolingState.OFF; // [0, 1] only
  private targetHeatingState = hap.Characteristic.TargetHeatingCoolingState.OFF; // [0, 1, 3] only
  private pollingTimer;
  private isOffline = false;

  // config
  private readonly name: string;
  private readonly sensorName: string;
  private readonly minTemp: number = -25;
  private readonly maxTemp: number = 25;
  private readonly deltaTemp: number = 0.2;
  private readonly stepTemp: number = 0.5;
  private readonly tempUnits: string = 'C';
  private readonly deviceIPAddress: string = '';
  private readonly deviceStatStatus: string = '/cm?cmnd=status%208';
  private readonly deviceStatPower: string = '/cm?cmnd=power';
  private readonly deviceCmndOn: string = '/cm?cmnd=power%20on';
  private readonly deviceCmndOff: string = '/cm?cmnd=power%20off';
  private readonly pollingInterval: number = 60;

  // services
  private thermostatService: Service;
  private informationService: Service;

  // ctor
  constructor(log: Logging, config: AccessoryConfig) {

    log.debug('TH16ermostat constructing!');

    this.log = log;
    this.name = config.name;

    // Config values
    this.sensorName = config.sensorName as string;
    this.deviceIPAddress = config.deviceIPAddress as string;
    this.deviceStatStatus = config.deviceStatStatus as string || this.deviceStatStatus;
    this.deviceStatPower = config.deviceStatPower as string || this.deviceStatPower;
    this.deviceCmndOn = config.deviceCmndOn as string || this.deviceCmndOn;
    this.deviceCmndOff = config.deviceCmndOff as string || this.deviceCmndOff;
    this.pollingInterval = config.pollingInterval as number || this.pollingInterval;
    this.minTemp = config.minTemp as number || this.minTemp;
    this.maxTemp = config.maxTemp as number || this.maxTemp;
    this.deltaTemp = config.deltaTemp as number || this.deltaTemp;
    this.stepTemp = config.StepTemp as number || this.stepTemp;
    this.tempUnits = config.tempUnits as string || this.tempUnits;
    // init state values
    this.targetTemp = this.minTemp;

    // create services
    this.thermostatService = new hap.Service.Thermostat(this.name);
    this.informationService = new hap.Service.AccessoryInformation();
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log('Sonoff TH16 thermostat');
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {

    this.log.debug('TH16ermostat initializing!');

    // init Thermostat service
    this.thermostatService.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info('Get CURRENT heating state: ' + this.heatingStateToStr(this.currentHeatingState));
        callback(undefined, this.isOffline ? hap.Characteristic.CurrentHeatingCoolingState.OFF : this.currentHeatingState);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.currentHeatingState = value as number;
        this.log.info('Set CURRENT heating state to: ' + this.heatingStateToStr(this.currentHeatingState));
        this.pollDeviceStatus();
        callback();
      });

    this.thermostatService.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info('Get TARGET heating state: ' + this.heatingStateToStr(this.targetHeatingState));
        callback(undefined, this.isOffline ? hap.Characteristic.TargetHeatingCoolingState.OFF : this.targetHeatingState);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.targetHeatingState = value as number;
        this.log.info('Set TARGET heating state to: ' + this.heatingStateToStr(this.targetHeatingState));
        if (hap.Characteristic.TargetHeatingCoolingState.COOL === value) {
          this.log.info('COOL state not supported! Setting as OFF');
          this.targetHeatingState = hap.Characteristic.TargetHeatingCoolingState.OFF;
        }
        this.pollDeviceStatus();
        callback();
      })
      .setProps({
        validValues: [0, 1, 3], // no cooling for now
      });

    this.thermostatService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info('Get CURRENT temperature: ' + this.currTemp);
        callback(undefined, this.currTemp);
      });

    this.thermostatService.getCharacteristic(hap.Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info('Get TARGET temperature: ' + this.targetTemp);
        callback(undefined, this.targetTemp);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.targetTemp = value as number;
        this.log.info('Set TARGET temperature to: ' + this.targetTemp);
        this.pollDeviceStatus();
        callback();
      })
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: this.stepTemp,
      });

    this.thermostatService.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, this.tempUnits);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.log.info('[Ignoring] Set Temperature Units to: ' + this.tempUnits);
        callback();
      });

    this.thermostatService.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info('Get CURRENT relative humidity: ' + this.currRelativeHumidity);
        callback(undefined, this.currRelativeHumidity);
      });

    // init Information service
    this.informationService
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Sonoff')
      .setCharacteristic(hap.Characteristic.Model, 'TH16');

    this.log.debug('TH16ermostat finished initializing!');

    // Polling service
    this.log.debug('Polling each ' + this.pollingInterval + ' seconds.');
    this.pollingTimer = setInterval(this.pollDeviceStatus.bind(this), this.pollingInterval * 1000);

    // Get initial state
    this.pollDeviceStatus();

    return [
      this.informationService,
      this.thermostatService,
    ];
  }

  setDevicePower(value: CharacteristicValue): void {

    this.log.info('TH16ermostat: Power ' + this.heatingStateToStr(value as number) +
      '(Temp: ' + this.currTemp + ' -> ' + this.targetTemp + ')');

    const url = 'http://' + this.deviceIPAddress;

    axios.get(url + (value === hap.Characteristic.CurrentHeatingCoolingState.HEAT ? this.deviceCmndOn : this.deviceCmndOff))
      .then((response) => {
        this.currentHeatingState =
          (response.data.POWER === 'ON') ?
            hap.Characteristic.CurrentHeatingCoolingState.HEAT :
            hap.Characteristic.CurrentHeatingCoolingState.OFF;
      }).catch((err) => {
        this.log.error('Failed to set relay state: cmd=' + this.deviceStatStatus + ' [' + err + ']');
      });
  }

  pollDeviceStatus(): void {

    const deviceStatus =
      async () => {
        let pwr, tmp, hum;
        const url = 'http://' + this.deviceIPAddress;

        await axios.get(url + this.deviceStatStatus, { timeout: 3000 })
          .then((response) => {
            tmp = parseFloat(response.data.StatusSNS[this.sensorName].Temperature);
          }).catch((err) => {
            throw new Error('Failed to get status: cmd=' + this.deviceStatStatus + ' [' + err + ']');
          });

        await axios.get(url + this.deviceStatStatus, { timeout: 3000 })
          .then((response) => {
            hum = parseFloat(response.data.StatusSNS[this.sensorName].Humidity);
          }).catch((err) => {
            throw new Error('Failed to get status: cmd=' + this.deviceStatStatus + ' [' + err + ']');
          });

        await axios.get(url + this.deviceStatPower, { timeout: 3000 })
          .then((response) => {
            pwr = (response.data.POWER === 'ON') ?
              hap.Characteristic.CurrentHeatingCoolingState.HEAT :
              hap.Characteristic.CurrentHeatingCoolingState.OFF;
          }).catch((err) => {
            throw new Error('Failed to get power status: cmd=' + this.deviceStatPower + ' [' + err + ']');
          });

        return { 'TMP_STAT': (await tmp), 'HUM_STAT': (await hum), 'PWR_STAT': (await pwr) };
      };

    deviceStatus()
      .then((response) => {

        // device online
        this.isOffline = false;

        // state values
        this.currTemp = response['TMP_STAT'] as string;
        this.currRelativeHumidity = response['HUM_STAT'] as string;
        this.currentHeatingState = response['PWR_STAT'] as number;
        this.thermostatService.setCharacteristic(hap.Characteristic.CurrentTemperature, this.currTemp);

        // init target state from current state
        let targetRelayOn = (this.currentHeatingState === hap.Characteristic.CurrentHeatingCoolingState.HEAT);

        switch (this.targetHeatingState) {
          case hap.Characteristic.TargetHeatingCoolingState.AUTO:
            {
              // AUTO mode: Compare temperatures
              if (parseFloat(this.currTemp) >= (this.targetTemp + this.deltaTemp)) {
                targetRelayOn = false;
              } else if (parseFloat(this.currTemp) <= (this.targetTemp - this.deltaTemp)) {
                targetRelayOn = true;
              }
            }
            break;

          case hap.Characteristic.CurrentHeatingCoolingState.HEAT:
            targetRelayOn = true;
            break;

          case hap.Characteristic.CurrentHeatingCoolingState.OFF:
            targetRelayOn = false;
            break;
        }

        // Change status if needed (this.currentHeatingState as boolean here)
        if (targetRelayOn && !this.currentHeatingState) {
          this.setDevicePower(hap.Characteristic.CurrentHeatingCoolingState.HEAT);
        } else if (!targetRelayOn && this.currentHeatingState) {
          this.setDevicePower(hap.Characteristic.CurrentHeatingCoolingState.OFF);
        }

      })
      .catch((err) => {
        this.currTemp = '--';
        this.thermostatService.setCharacteristic(hap.Characteristic.CurrentTemperature, this.currTemp);
        this.currRelativeHumidity = "--";
        this.thermostatService.setCharacteristic(hap.Characteristic.CurrentRelativeHumidity, this.currRelativeHumidity);

        // output error only once, do not spam the log on each poll
        if (!this.isOffline) {
          this.log.debug('Device offline? ' + err);
          this.isOffline = true;
        }
      });
  }

  // helpers
  //
  heatingStateToStr(state: number): string {
    // assuming we have no 'COOL'!
    // assiming current and target to have the first 2 values identical!
    switch (state) {
      case hap.Characteristic.TargetHeatingCoolingState.OFF:
        return 'OFF';
      case hap.Characteristic.TargetHeatingCoolingState.HEAT:
        return 'HEAT';
      case hap.Characteristic.TargetHeatingCoolingState.AUTO:
        return 'AUTO';
      default:
        return 'UNKNOWN';
    }
  }
}
