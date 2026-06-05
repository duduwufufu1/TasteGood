const REGIONS = require("./regions");

const UNKNOWN_PROVINCE = "未知省份";
const UNKNOWN_CITY = "未知城市";
const DEFAULT_CENTER = { lat: 35.86, lng: 104.19 };

const CITY_SUFFIXES = ["市", "地区", "盟", "自治州", "特别行政区"];
const PROVINCE_SUFFIXES = ["省", "市", "自治区", "特别行政区"];

const CITY_ENTRIES = [];
REGIONS.provinces.forEach((province) => {
  province.cities.forEach((city) => {
    CITY_ENTRIES.push({
      province: province.name,
      city: city.name,
      center: city.center,
      aliases: [city.name, city.name + "市", city.fullName].filter(Boolean)
    });
  });
});

const PROVINCE_ALIAS_MAP = {
  "广西": ["广西壮族自治区"],
  "内蒙古": ["内蒙古自治区"],
  "宁夏": ["宁夏回族自治区"],
  "新疆": ["新疆维吾尔自治区"],
  "西藏": ["西藏自治区"],
  "香港": ["香港特别行政区"],
  "澳门": ["澳门特别行政区"]
};

function stripSuffix(value, suffixes) {
  let name = String(value || "").trim();
  suffixes.forEach((suffix) => {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
    }
  });
  return name;
}

function normalizeProvinceName(value) {
  if (!value) return "";
  const text = String(value).trim();
  const found = REGIONS.provinces.find((province) => {
    return text === province.name ||
      text.indexOf(province.name) !== -1 ||
      text.indexOf(province.name + "省") !== -1 ||
      text.indexOf(province.name + "市") !== -1;
  });
  return found ? found.name : stripSuffix(text, PROVINCE_SUFFIXES);
}

function normalizeCityName(value) {
  if (!value) return "";
  const text = String(value).trim();
  const found = CITY_ENTRIES.find((entry) => {
    return entry.aliases.some((alias) => alias && text.indexOf(alias) !== -1);
  });
  return found ? found.city : stripSuffix(text, CITY_SUFFIXES);
}

function provinceAliases(province) {
  const base = province.name;
  return [base, base + "省", base + "市", base + "自治区", base + "特别行政区"]
    .concat(PROVINCE_ALIAS_MAP[base] || []);
}

function getAddressProvinceMatch(value) {
  if (!value) return "";
  const text = String(value).trim().replace(/^中国/, "");
  let result = null;
  REGIONS.provinces.forEach((province) => {
    provinceAliases(province).sort((a, b) => b.length - a.length).forEach((alias) => {
      if (!alias || text.indexOf(alias) !== 0 || result) return;
      if (alias === province.name) {
        const rest = text.slice(alias.length);
        const scopedCities = CITY_ENTRIES.filter((entry) => entry.province === province.name);
        const hasCityPrefix = scopedCities.some((entry) => {
          return entry.aliases.filter(Boolean).some((cityAlias) => rest.indexOf(cityAlias) === 0);
        });
        if (!hasCityPrefix) return;
      }
      result = { province, alias };
    });
  });
  return result;
}

function normalizeProvinceNameFromAddressStart(value) {
  const match = getAddressProvinceMatch(value);
  return match ? match.province.name : "";
}

function stripAddressProvincePrefix(value) {
  let text = String(value || "").trim().replace(/^中国/, "");
  const match = getAddressProvinceMatch(text);
  if (match) text = text.slice(match.alias.length);
  return text;
}

function normalizeCityNameFromAddressStart(value, provinceName) {
  if (!value) return "";
  const text = stripAddressProvincePrefix(value);
  const province = normalizeProvinceName(provinceName);
  const entries = province ? CITY_ENTRIES.filter((entry) => entry.province === province) : CITY_ENTRIES;
  const addressProvince = normalizeProvinceNameFromAddressStart(value);
  if (province && addressProvince === province && entries.length === 1) {
    return entries[0].city;
  }
  const found = entries.find((entry) => {
    return entry.aliases
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .some((alias) => text.indexOf(alias) === 0);
  });
  return found ? found.city : "";
}

function getRecordLocation(record) {
  if (!record || !record.location) return null;
  const lat = Number(record.location.lat || record.location.latitude);
  const lng = Number(record.location.lng || record.location.longitude);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

function getCityEntry(cityName) {
  const city = normalizeCityName(cityName);
  return CITY_ENTRIES.find((entry) => entry.city === city) || null;
}

function getProvinceEntry(provinceName) {
  const province = normalizeProvinceName(provinceName);
  return REGIONS.provinces.find((entry) => entry.name === province) || null;
}

function nearestRegion(lat, lng, preferredProvince) {
  const provinceName = normalizeProvinceName(preferredProvince);
  let entries = CITY_ENTRIES;
  if (provinceName) {
    const scoped = CITY_ENTRIES.filter((entry) => entry.province === provinceName);
    if (scoped.length) entries = scoped;
  }

  let nearest = null;
  let min = Infinity;
  entries.forEach((entry) => {
    const d = Math.pow(lat - entry.center.lat, 2) + Math.pow(lng - entry.center.lng, 2);
    if (d < min) {
      min = d;
      nearest = entry;
    }
  });
  return nearest;
}

function inferRecordRegion(record) {
  const location = getRecordLocation(record);
  const address = record && record.address ? String(record.address) : "";
  const storedProvince = normalizeProvinceName(record && record.province);
  const storedCity = normalizeCityName(record && record.city);
  const addressProvince = address ? normalizeProvinceNameFromAddressStart(address) : "";
  const addressCity = address ? normalizeCityNameFromAddressStart(address, addressProvince || storedProvince) : "";
  let province = addressProvince || "";
  let city = addressCity || "";

  if (!province) province = storedProvince;
  if (!city) city = storedCity;

  const cityEntry = getCityEntry(city);
  if (!province && cityEntry) province = cityEntry.province;

  if ((!province || !city) && location) {
    const nearest = nearestRegion(location.lat, location.lng, province);
    if (nearest) {
      if (!province) province = nearest.province;
      if (!city) city = nearest.city;
    }
  }

  const normalizedCityEntry = getCityEntry(city);
  const provinceEntry = getProvinceEntry(province);
  const center = location || (normalizedCityEntry && normalizedCityEntry.center) ||
    (provinceEntry && provinceEntry.center) || DEFAULT_CENTER;

  return {
    province: province || UNKNOWN_PROVINCE,
    city: city || UNKNOWN_CITY,
    location,
    center
  };
}

module.exports = {
  UNKNOWN_PROVINCE,
  UNKNOWN_CITY,
  DEFAULT_CENTER,
  normalizeProvinceName,
  normalizeCityName,
  normalizeProvinceNameFromAddressStart,
  normalizeCityNameFromAddressStart,
  getRecordLocation,
  getCityEntry,
  getProvinceEntry,
  nearestRegion,
  inferRecordRegion
};
