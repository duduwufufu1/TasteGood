const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_ROOT = path.join(ROOT, "scripts", "map-assets");
const GEO_ROOT = path.join(OUTPUT_ROOT, "geojson");
const SVG_ROOT = path.join(OUTPUT_ROOT, "svg");
const PROVINCE_SVG_ROOT = path.join(SVG_ROOT, "provinces");
const DATA_OUTPUT = path.join(ROOT, "utils", "china-map-data.js");
const DATAV_BASE = "https://geo.datav.aliyun.com/areas_v3/bound";

const MUNICIPALITIES = {
  110000: "北京",
  120000: "天津",
  310000: "上海",
  500000: "重庆",
  810000: "香港",
  820000: "澳门"
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((name) => {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      cleanDir(file);
      fs.rmdirSync(file);
    } else {
      fs.unlinkSync(file);
    }
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        requestJson(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error("Download failed " + response.statusCode + " " + url));
        response.resume();
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

async function downloadGeoJson(adcode, full) {
  const suffix = full ? "_full" : "";
  const file = path.join(GEO_ROOT, adcode + suffix + ".json");
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  const json = await requestJson(DATAV_BASE + "/" + adcode + suffix + ".json");
  fs.writeFileSync(file, JSON.stringify(json));
  return json;
}

function isFiniteCoord(point) {
  return Array.isArray(point) && isFinite(Number(point[0])) && isFinite(Number(point[1]));
}

function collectPointsFromGeometry(geometry, points) {
  if (!geometry || !geometry.coordinates) return;
  const coords = geometry.coordinates;
  if (geometry.type === "Polygon") {
    coords.forEach((ring) => {
      ring.forEach((point) => {
        if (isFiniteCoord(point)) points.push(point);
      });
    });
  } else if (geometry.type === "MultiPolygon") {
    coords.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((point) => {
          if (isFiniteCoord(point)) points.push(point);
        });
      });
    });
  }
}

function mercatorY(lat) {
  const clamped = Math.max(Math.min(Number(lat), 85), -85);
  const rad = clamped * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180 / Math.PI;
}

function buildProjection(features, width, height, padding) {
  const points = [];
  features.forEach((feature) => collectPointsFromGeometry(feature.geometry, points));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    const x = Number(point[0]);
    const y = mercatorY(point[1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  return function project(point) {
    const x = offsetX + (Number(point[0]) - minX) * scale;
    const y = height - offsetY - (mercatorY(point[1]) - minY) * scale;
    return [round(x), round(y)];
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function distanceToSegment(point, start, end) {
  const x = point[0];
  const y = point[1];
  const x1 = start[0];
  const y1 = start[1];
  const x2 = end[0];
  const y2 = end[1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
  }
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 3) return points;
  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const distance = distanceToSegment(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [points[0], points[end]];
}

function simplifyRing(points, tolerance) {
  const filtered = [];
  const minGap = Math.max(0.02, Math.min(0.12, tolerance / 5));
  points.forEach((point) => {
    const prev = filtered[filtered.length - 1];
    if (!prev || Math.abs(prev[0] - point[0]) > minGap || Math.abs(prev[1] - point[1]) > minGap) {
      filtered.push(point);
    }
  });
  if (filtered.length < 4) return [];
  const closed = filtered[0][0] === filtered[filtered.length - 1][0] && filtered[0][1] === filtered[filtered.length - 1][1];
  const body = closed ? filtered.slice(0, filtered.length - 1) : filtered;
  const simplified = douglasPeucker(body.concat([body[0]]), tolerance);
  const result = simplified.slice(0, simplified.length - 1);
  return result.length >= 3 ? result : [];
}

function geometryToRings(geometry, project, tolerance) {
  const rings = [];
  if (!geometry || !geometry.coordinates) return rings;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      const projectedRing = ring.filter(isFiniteCoord).map(project);
      const simplified = simplifyRing(projectedRing, tolerance);
      if (simplified.length) rings.push(simplified);
    });
  });
  return rings;
}

function ringToPath(ring) {
  return "M" + ring.map((point) => point[0] + " " + point[1]).join("L") + "Z";
}

function featureToPath(feature, project, tolerance) {
  return geometryToRings(feature.geometry, project, tolerance).map(ringToPath).join("");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeCityName(name) {
  return String(name || "")
    .replace(/(市|地区|盟|自治州|特别行政区)$/g, "")
    .replace(/^(.*?)(藏族|回族|蒙古族|维吾尔族|哈萨克族|柯尔克孜族|彝族|苗族|侗族|傣族|白族|壮族|布依族|朝鲜族|土家族|哈尼族|傈僳族|羌族|黎族|佤族|畲族|景颇族|拉祜族|水族|东乡族|纳西族|土族|达斡尔族|仫佬族|撒拉族|毛南族|仡佬族|锡伯族|阿昌族|普米族|塔吉克族|怒族|乌孜别克族|俄罗斯族|鄂温克族|德昂族|保安族|裕固族|京族|塔塔尔族|独龙族|鄂伦春族|赫哲族|门巴族|珞巴族|基诺族).*$/g, "$1")
    .replace(/自治县$/g, "");
}

function featureName(feature) {
  return feature && feature.properties ? feature.properties.name : "";
}

function featureAdcode(feature) {
  return feature && feature.properties ? feature.properties.adcode : "";
}

function writeSvg(file, features, options) {
  const width = options.width || 900;
  const height = options.height || 780;
  const project = buildProjection(features, width, height, options.padding || 16);
  const paths = features.map((feature, index) => {
    const name = featureName(feature);
    const d = featureToPath(feature, project, options.tolerance || 0.65);
    if (!d) return "";
    const cls = options.className || "region";
    return [
      '<path class="' + cls + '"',
      'id="adcode-' + escapeXml(featureAdcode(feature)) + '"',
      'data-name="' + escapeXml(name) + '"',
      'd="' + d + '"/>'
    ].join(" ");
  }).filter(Boolean).join("\n  ");
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + " " + height + '" role="img">',
    '  <title>' + escapeXml(options.title) + "</title>",
    "  <style>",
    "    .region{fill:#edf2e3;stroke:#16342f;stroke-width:0.7;stroke-linejoin:round;vector-effect:non-scaling-stroke}",
    "    .region:hover{fill:#c84632}",
    "  </style>",
    "  <rect width=\"100%\" height=\"100%\" fill=\"#fdf7e7\"/>",
    "  " + paths,
    "</svg>"
  ].join("\n");
  fs.writeFileSync(file, svg);
}

function cityFeatureFromProvince(feature) {
  const adcode = featureAdcode(feature);
  const name = MUNICIPALITIES[adcode] || normalizeCityName(featureName(feature));
  return {
    type: "Feature",
    properties: Object.assign({}, feature.properties, {
      name,
      city: name,
      province: featureName(feature),
      adcode
    }),
    geometry: feature.geometry
  };
}

function childCityFeatures(provinceFeature, provinceJson) {
  const provinceName = featureName(provinceFeature);
  const adcode = featureAdcode(provinceFeature);
  if (MUNICIPALITIES[adcode] || !provinceJson || !provinceJson.features || !provinceJson.features.length) {
    return [cityFeatureFromProvince(provinceFeature)];
  }
  return provinceJson.features.map((feature) => {
    const name = normalizeCityName(featureName(feature));
    return {
      type: "Feature",
      properties: Object.assign({}, feature.properties, {
        name,
        city: name,
        province: provinceName,
        adcode: featureAdcode(feature)
      }),
      geometry: feature.geometry
    };
  });
}

function buildCanvasData(features) {
  const width = 1000;
  const height = 780;
  const project = buildProjection(features, width, height, 18);
  return {
    width,
    height,
    cities: features.map((feature) => {
      const rings = geometryToRings(feature.geometry, project, 0.45);
      return {
        name: feature.properties.city || featureName(feature),
        province: feature.properties.province || "",
        adcode: featureAdcode(feature),
        rings
      };
    }).filter((item) => item.rings.length)
  };
}

async function main() {
  ensureDir(GEO_ROOT);
  ensureDir(SVG_ROOT);
  ensureDir(PROVINCE_SVG_ROOT);
  cleanDir(SVG_ROOT);
  ensureDir(PROVINCE_SVG_ROOT);

  const china = await downloadGeoJson("100000", true);
  const provinceFeatures = (china.features || []).filter((feature) => {
    const adcode = String(featureAdcode(feature) || "");
    return feature.geometry && featureName(feature) && /^\d{6}$/.test(adcode);
  });
  const provinceJsonMap = {};
  const allCityFeatures = [];

  for (const provinceFeature of provinceFeatures) {
    const adcode = featureAdcode(provinceFeature);
    let provinceJson = null;
    try {
      provinceJson = await downloadGeoJson(adcode, true);
      provinceJsonMap[adcode] = provinceJson;
    } catch (error) {
      console.warn("[map] skip province detail", adcode, featureName(provinceFeature), error.message);
    }
    const cityFeatures = childCityFeatures(provinceFeature, provinceJson);
    allCityFeatures.push.apply(allCityFeatures, cityFeatures);
    const provinceSvgFile = path.join(PROVINCE_SVG_ROOT, adcode + "-" + featureName(provinceFeature) + ".svg");
    writeSvg(provinceSvgFile, cityFeatures, {
      title: featureName(provinceFeature) + "市级地图",
      className: "region",
      width: 900,
      height: 780,
      tolerance: 0.18
    });
  }

  writeSvg(path.join(SVG_ROOT, "china-provinces.svg"), provinceFeatures, {
    title: "中国省级地图",
    className: "region",
    width: 900,
    height: 780,
    tolerance: 0.12
  });
  writeSvg(path.join(SVG_ROOT, "china-cities.svg"), allCityFeatures, {
    title: "中国市级拼接地图",
    className: "region",
    width: 900,
    height: 780,
    tolerance: 0.2
  });

  const canvasData = buildCanvasData(allCityFeatures);
  fs.writeFileSync(DATA_OUTPUT, "module.exports=" + JSON.stringify(canvasData) + ";\n");

  const index = {
    source: DATAV_BASE,
    generatedAt: new Date().toISOString(),
    provinceCount: provinceFeatures.length,
    sourceCityFeatureCount: allCityFeatures.length,
    canvasCityCount: canvasData.cities.length,
    files: {
      chinaProvincesSvg: "svg/china-provinces.svg",
      chinaCitiesSvg: "svg/china-cities.svg",
      provinceSvgDir: "svg/provinces",
      miniProgramData: path.relative(OUTPUT_ROOT, DATA_OUTPUT).replace(/\\/g, "/")
    }
  };
  fs.writeFileSync(path.join(OUTPUT_ROOT, "index.json"), JSON.stringify(index, null, 2));
  console.log("[map] generated", index);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
