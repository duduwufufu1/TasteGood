const recordRegion = require("./record-region");

const SELECTED_LOCATION_PREFIX = "\u5df2\u9009\u62e9\u4f4d\u7f6e";

function normalizeText(value) {
  return String(value || "").trim();
}

function isReliableAddress(address) {
  const text = normalizeText(address);
  if (!text) return false;
  return text.indexOf(SELECTED_LOCATION_PREFIX) !== 0;
}

function getRecordCity(record) {
  const info = recordRegion.inferRecordRegion(record || {});
  return info && info.city ? info.city : "";
}

function isKnownCity(city) {
  return !!city && city !== recordRegion.UNKNOWN_CITY;
}

function getPlaceKey(record) {
  const city = getRecordCity(record);
  const address = normalizeText(record && record.address);
  if (isKnownCity(city) && isReliableAddress(address)) {
    return city + "|" + address;
  }
  const name = normalizeText(record && record.name);
  if (isKnownCity(city) && name) {
    return city + "|" + name;
  }
  return "";
}

function isSamePlace(currentRecord, record) {
  if (!currentRecord || !record) return false;
  if (record._id && currentRecord._id && record._id === currentRecord._id) return true;
  const currentAddress = normalizeText(currentRecord.address);
  const address = normalizeText(record.address);
  const currentCity = getRecordCity(currentRecord);
  const city = getRecordCity(record);
  if (isReliableAddress(currentAddress) && isReliableAddress(address)) {
    if (isKnownCity(currentCity) && isKnownCity(city)) {
      return currentCity === city && currentAddress === address;
    }
    return currentAddress === address;
  }
  const currentName = normalizeText(currentRecord.name);
  const name = normalizeText(record.name);
  return !!currentName && !!name && currentName === name && isKnownCity(currentCity) && currentCity === city;
}

function getRecordTimeValue(record) {
  const time = record && record.createdAt ? new Date(record.createdAt).getTime() : 0;
  return isFinite(time) ? time : 0;
}

function getRepresentativeRecord(records) {
  const list = (records || []).filter(Boolean);
  if (!list.length) return null;
  return list.slice().sort((a, b) => getRecordTimeValue(b) - getRecordTimeValue(a))[0];
}

function getMergedImages(records, limit) {
  const seen = {};
  const images = [];
  (records || []).forEach((record) => {
    (record.images || []).forEach((src) => {
      if (!src || seen[src]) return;
      seen[src] = true;
      images.push(src);
    });
  });
  return typeof limit === "number" ? images.slice(0, limit) : images;
}

function groupRecordsByPlace(records) {
  const map = {};
  (records || []).forEach((record) => {
    const key = getPlaceKey(record);
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        key,
        records: []
      };
    }
    map[key].records.push(record);
  });
  return Object.keys(map).map((key) => {
    const group = map[key];
    group.record = getRepresentativeRecord(group.records);
    group.images = getMergedImages(group.records);
    group.count = group.records.length;
    return group;
  });
}

module.exports = {
  isReliableAddress,
  getRecordCity,
  getPlaceKey,
  isSamePlace,
  getRecordTimeValue,
  getRepresentativeRecord,
  getMergedImages,
  groupRecordsByPlace
};
