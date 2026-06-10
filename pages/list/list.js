const recordPlace = require("../../utils/record-place");
const recordRegion = require("../../utils/record-region");
const auth = require("../../utils/auth");
const userRecords = require("../../utils/user-records");
const TAG_NAME_MAP = {
  breakfast:"早餐", lunch:"午餐", dinner:"晚餐", dessert:"甜品", drink:"饮品",
  snack:"小吃", hotpot:"火锅", bbq:"烧烤", musttry:"必吃", avoid:"踩雷"
};

function normalizeText(value) {
  return String(value || "").trim();
}

function formatPrice(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (/^[¥￥$]/.test(text) || /^人均/.test(text) || /^约/.test(text)) return text;
  if (/^\d+(\.\d+)?$/.test(text)) return "¥" + text;
  return text;
}

function enrichRecordRegion(record) {
  const info = recordRegion.inferRecordRegion(record);
  return Object.assign({}, record, { province: info.province, city: info.city });
}

function matchesFilter(record, city, tag, rating) {
  if (city && record.city !== city) return false;
  if (tag && !(record.tags || []).includes(tag)) return false;
  if (rating && (!record.rating || record.rating < rating)) return false;
  return true;
}

function sortByRecordTime(records, sortAsc) {
  return records.slice().sort((a, b) => {
    const diff = recordPlace.getRecordTimeValue(a) - recordPlace.getRecordTimeValue(b);
    return sortAsc ? diff : -diff;
  });
}

function buildPlaceGroups(records) {
  const placeRecords = records.filter(item => recordPlace.getPlaceKey(item));
  const orphanGroups = records
    .filter(item => !recordPlace.getPlaceKey(item))
    .map(record => ({
      record,
      records: [record],
      images: record.images || [],
      count: 1
    }));
  return recordPlace.groupRecordsByPlace(placeRecords).concat(orphanGroups);
}

function buildCardRecord(group) {
  const record = group.record || {};
  const images = record.images && record.images.length ? record.images : (group.images || []);
  const visitCount = group.count || (group.records ? group.records.length : 1);
  return {
    _id: record._id,
    name: record.name || "",
    rating: record.rating || 0,
    city: record.city || "",
    address: record.address || "",
    images,
    dishName: normalizeText(record.dishName),
    price: formatPrice(record.price),
    reviewTitle: normalizeText(record.reviewTitle),
    visitCount,
    visitText: visitCount > 1 ? "已回访 " + visitCount + " 次" : "首次记录"
  };
}

Page({
  data: {
    records: [], currentCity: "", currentTag: "", currentTagName: "", currentRating: 0,
    cityList: ["全部城市"], tagList: ["全部标签","早餐","午餐","晚餐","甜品","饮品","小吃","火锅","烧烤","必吃","踩雷"],
    tagKeyList: [""], ratingList: ["全部星级","1星","2星","3星","4星","5星"],
    sortAsc: false, loading: false, pageSize: 20, loadedAll: false, querySkip: 0,
    isLoggedIn: false
  },
  onShow() {
    const cachedUser = auth.getCachedUser();
    this.setData({ isLoggedIn: !!(cachedUser && cachedUser.openid) });
    this.loadCities();
    this.setData({ records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  async loadCities() {
    try {
      const res = await userRecords.getAll();
      const rows = res.data || [];
      const cities = [...new Set(rows.map(r => recordRegion.inferRecordRegion(r).city).filter(Boolean))];
      const customTags = [];
      rows.forEach(r => (r.tags || []).forEach(tag => {
        if (!TAG_NAME_MAP[tag] && !customTags.includes(tag)) customTags.push(tag);
      }));
      const presetKeys = ["breakfast","lunch","dinner","dessert","drink","snack","hotpot","bbq","musttry","avoid"];
      this.setData({
        cityList: ["全部城市", ...cities],
        tagList: ["全部标签", ...presetKeys.map(k => TAG_NAME_MAP[k]), ...customTags],
        tagKeyList: ["", ...presetKeys, ...customTags]
      });
    } catch(e) {}
  },
  async loadRecords() {
    if (this.data.loadedAll || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const { currentCity: c, currentTag: t, currentRating: r, sortAsc: s, records, pageSize: p } = this.data;
      const user = await userRecords.getCurrentUser().catch(error => {
        if (error.code === "LOGIN_REQUIRED" || error.message === "LOGIN_REQUIRED") return null;
        throw error;
      });
      if (!user) {
        this.setData({ records: [], loadedAll: true, querySkip: 0, isLoggedIn: false });
        return;
      }
      this.setData({ isLoggedIn: true });

      const res = await userRecords.getAll();
      const filtered = sortByRecordTime(
        (res.data || []).map(enrichRecordRegion).filter(item => matchesFilter(item, c, t, r)),
        s
      );
      const groupedRecords = buildPlaceGroups(filtered)
        .sort((a, b) => {
          const diff = recordPlace.getRecordTimeValue(a.record) - recordPlace.getRecordTimeValue(b.record);
          return s ? diff : -diff;
        })
        .map(buildCardRecord);
      const nextRecords = groupedRecords.slice(records.length, records.length + p);
      const displayedCount = records.length + nextRecords.length;
      this.setData({
        records: records.concat(nextRecords),
        loadedAll: displayedCount >= groupedRecords.length,
        querySkip: displayedCount
      });
    } catch(e) { console.error(e); }
    finally { this.setData({ loading: false }); }
  },
  handleLoadMore() { this.loadRecords(); },
  onCityChange(e) {
    const c = this.data.cityList[e.detail.value];
    this.setData({ currentCity: c === "全部城市" ? "" : c, records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  onTagChange(e) {
    const index = Number(e.detail.value);
    const t = this.data.tagKeyList[index] || "";
    const name = t ? this.data.tagList[index] : "";
    this.setData({ currentTag: t, currentTagName: name, records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  onRatingChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ currentRating: idx, records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  handleToggleSort() {
    this.setData({ sortAsc: !this.data.sortAsc, records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  handleGoDetail(e) {
    if (this._navigating) return;
    this._navigating = true;
    wx.navigateTo({ url: "/pages/detail/detail?id=" + e.detail.id });
    setTimeout(() => { this._navigating = false; }, 500);
  },
  handleGoAddRecord() {
    wx.navigateTo({ url: "/pages/add-record/add-record" });
  },
  handleGoProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  }
});
