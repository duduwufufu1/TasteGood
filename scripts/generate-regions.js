const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GEO_ROOT = path.join(ROOT, "scripts", "map-assets", "geojson");
const OUTPUT = path.join(ROOT, "utils", "regions.js");

const MUNICIPALITIES = {
  110000: "北京",
  120000: "天津",
  310000: "上海",
  500000: "重庆",
  710000: "台湾",
  810000: "香港",
  820000: "澳门"
};

function stripProvinceName(name) {
  return String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/壮族自治区$/, "")
    .replace(/回族自治区$/, "")
    .replace(/维吾尔自治区$/, "")
    .replace(/自治区$/, "")
    .replace(/省$/, "")
    .replace(/市$/, "");
}

function stripCityName(name) {
  return String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/市$/, "")
    .replace(/地区$/, "")
    .replace(/盟$/, "")
    .replace(/(藏族羌族|土家族苗族|哈尼族彝族|傣族景颇族|傈僳族|蒙古族藏族|苗族侗族|布依族苗族|柯尔克孜|朝鲜族|蒙古|回族|藏族|哈萨克|白族|彝族|傣族|苗族).*自治州$/, "")
    .replace(/自治州$/, "");
}

function centerToObject(center) {
  const lng = Number(center && center[0]);
  const lat = Number(center && center[1]);
  return {
    lat: Math.round(lat * 1000000) / 1000000,
    lng: Math.round(lng * 1000000) / 1000000
  };
}

function cityFromFeature(feature) {
  const props = feature.properties || {};
  const fullName = props.name || "";
  const name = stripCityName(fullName);
  const city = {
    name,
    center: centerToObject(props.center)
  };
  if (fullName && fullName !== name && fullName !== name + "市") {
    city.fullName = fullName;
  }
  return city;
}

function main() {
  const chinaPath = path.join(GEO_ROOT, "100000_full.json");
  if (!fs.existsSync(chinaPath)) {
    throw new Error("Missing " + chinaPath + ". Run npm run maps:generate first.");
  }
  const china = JSON.parse(fs.readFileSync(chinaPath, "utf8"));
  const provinceFeatures = (china.features || []).filter((feature) => {
    const props = feature.properties || {};
    return props.name && /^\d{6}$/.test(String(props.adcode || ""));
  });

  const provinces = provinceFeatures.map((feature) => {
    const props = feature.properties || {};
    const adcode = Number(props.adcode);
    const provinceName = stripProvinceName(props.name);
    const province = {
      name: provinceName,
      center: centerToObject(props.center),
      cities: []
    };

    if (MUNICIPALITIES[adcode]) {
      province.cities = [{
        name: MUNICIPALITIES[adcode],
        center: centerToObject(props.center),
        fullName: props.name
      }];
      return province;
    }

    const childPath = path.join(GEO_ROOT, String(adcode) + "_full.json");
    if (!fs.existsSync(childPath)) {
      province.cities = [{
        name: provinceName,
        center: centerToObject(props.center),
        fullName: props.name
      }];
      return province;
    }
    const child = JSON.parse(fs.readFileSync(childPath, "utf8"));
    province.cities = (child.features || [])
      .filter((cityFeature) => cityFeature.properties && cityFeature.properties.name && cityFeature.properties.center)
      .map(cityFromFeature);
    return province;
  });

  const output = [
    "const REGIONS = " + JSON.stringify({ provinces }, null, 2) + ";",
    "module.exports = REGIONS;",
    ""
  ].join("\n");
  fs.writeFileSync(OUTPUT, output);
  const cityCount = provinces.reduce((total, province) => total + province.cities.length, 0);
  console.log("generated regions:", provinces.length, "provinces,", cityCount, "cities");
}

main();
