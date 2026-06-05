const { COLLECTION } = require("../../utils/constants");
const recordRegion = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");
const db = wx.cloud.database();
const TAG_NAME_MAP = {
  breakfast:"鏃╅", lunch:"鍗堥", dinner:"鏅氶", dessert:"鐢滃搧", drink:"楗搧",
  snack:"灏忓悆", hotpot:"鐏攨", bbq:"鐑х儰", musttry:"蹇呭悆", avoid:"韪╅浄"
};
Page({
  data: { records: [], currentCity: "", currentTag: "", currentTagName: "", cityList: ["鍏ㄩ儴鍩庡競"],
    tagList: ["鍏ㄩ儴鏍囩","鏃╅","鍗堥","鏅氶","鐢滃搧","楗搧","灏忓悆","鐏攨","鐑х儰","蹇呭悆","韪╅浄"],
    tagKeyList: [""],
    sortAsc: false, loading: false, pageSize: 20, loadedAll: false, querySkip: 0
  },
  onShow() { this.loadCities(); this.setData({ records: [], loadedAll: false, querySkip: 0 }); this.loadRecords(); },
  async loadCities() {
    try { const res = await userRecords.getAll();
      const rows = res.data || [];
      const cities = [...new Set(rows.map(r=>recordRegion.inferRecordRegion(r).city).filter(Boolean))];
      const customTags = [];
      rows.forEach(r => (r.tags || []).forEach(tag => {
        if (!TAG_NAME_MAP[tag] && !customTags.includes(tag)) customTags.push(tag);
      }));
      const presetKeys = ["breakfast","lunch","dinner","dessert","drink","snack","hotpot","bbq","musttry","avoid"];
      this.setData({
        cityList: ["鍏ㄩ儴鍩庡競", ...cities],
        tagList: ["鍏ㄩ儴鏍囩", ...presetKeys.map(k=>TAG_NAME_MAP[k]), ...customTags],
        tagKeyList: ["", ...presetKeys, ...customTags]
      });
    } catch(e) {}
  },
  async loadRecords() {
    if (this.data.loadedAll || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const { currentCity:c, currentTag:t, sortAsc:s, records:r, pageSize:p, querySkip:q } = this.data;
      const user = await userRecords.getCurrentUser().catch(error => {
        if (error.code === "LOGIN_REQUIRED" || error.message === "LOGIN_REQUIRED") return null;
        throw error;
      });
      if (!user) {
        this.setData({ records: [], loadedAll: true, querySkip: 0 });
        return;
      }
      const cond = { userId: user.openid };
      if (t) cond.tags = t;
      const order = s ? "asc" : "desc";
      let fetched = 0;
      let added = [];
      let loadedAll = false;
      while (added.length < p && !loadedAll) {
        const res = await db.collection(COLLECTION.RECORDS).where(cond).orderBy("createdAt",order).skip(q + fetched).limit(p).get();
        const raw = res.data || [];
        fetched += raw.length;
        loadedAll = raw.length < p;
        const pageRecords = raw.map(item => {
          const info = recordRegion.inferRecordRegion(item);
          return Object.assign({}, item, { province: info.province, city: info.city });
        }).filter(item => !c || item.city === c);
        added = added.concat(pageRecords);
      }
      const nr = r.concat(added.slice(0, p));
      this.setData({ records: nr, loadedAll, querySkip: q + fetched });
    } catch(e) { console.error(e); }
    finally { this.setData({ loading: false }); }
  },
  loadMore() { this.loadRecords(); },
  onCityChange(e) {
    const c = this.data.cityList[e.detail.value];
    this.setData({ currentCity: c==="鍏ㄩ儴鍩庡競"?"":c, records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  onTagChange(e) {
    const index = Number(e.detail.value);
    const t = this.data.tagKeyList[index] || "";
    const name = t ? this.data.tagList[index] : "";
    this.setData({ currentTag: t, currentTagName: name, records: [], loadedAll: false, querySkip: 0 });
    this.loadRecords();
  },
  toggleSort() { this.setData({ sortAsc: !this.data.sortAsc, records: [], loadedAll: false, querySkip: 0 }); this.loadRecords(); },
  goDetail(e) { wx.navigateTo({ url: "/pages/detail/detail?id=" + e.detail.id }); }
});
