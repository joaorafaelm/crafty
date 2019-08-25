#!/usr/bin/env node

const noble = require('noble-mac');
const uuids = require('./uuids.js');

const ARGS = process.argv;


function parseHexData(data, properties) {
  const string = data.toString(properties.type).trim();
  if (!string) return undefined;
  if (properties.type !== 'hex') return string;
  const len = string.length;
  let bigEndianHexString = '0x';
  for (let i = 0; i < len / 2; i += 1) {
    bigEndianHexString += string.substring((len - ((i + 1) * 2)), (len - (i * 2)));
  }
  return Number(
    parseInt(bigEndianHexString, 16) / (properties.divide === false ? 1 : 10),
  ).toFixed(2);
}


function fetchInfo(peripheral, discoverError, services, characteristics) {
  const asyncFetch = characteristics.map(item => new Promise((resolve) => {
    const props = uuids.UUIDS[item.uuid];
    props.actions = item.properties;

    const updateValue = (data) => {
      props.value = parseHexData(data, props);
      console.log(
        props.label,
        '\t', props.value, props.suffix || '',
        '\t', new Date().toLocaleTimeString(),
      );
    };

    if (item.properties.includes('read')) {
      item.read((readError, data) => { updateValue(data); resolve(); });
    }

    if (item.properties.includes('notify')) {
      item.on('data', (data) => {
        updateValue(data);
      });

      item.subscribe();
    }
  }));

  Promise.all(asyncFetch).then(() => {
    if (!ARGS.includes('--watch')) {
      peripheral.disconnect();
      process.exit(0);
    }
  });
}

function connect(peripheral) {
  peripheral.connect(() => {
    peripheral.discoverSomeServicesAndCharacteristics(
      [], Object.keys(uuids.UUIDS), fetchInfo.bind(null, peripheral),
    );
  });
}

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    noble.startScanning(uuids.PERIPHERAL_UUIDS);
  } else {
    noble.startScanning();
  }
});

noble.on('discover', (peripheral) => {
  noble.stopScanning();
  peripheral.on('disconnect', () => { process.exit(0); });
  connect(peripheral);
});
