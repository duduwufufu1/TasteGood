const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function ownerWhere(openid) {
  return { userId: openid };
}

function withOwner(data, openid) {
  return Object.assign({}, data || {}, {
    userId: openid,
    openid
  });
}

exports.main = async (event, context) => {
  const { action, data, id } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  try {
    switch (action) {
      case "create":
        return await db.collection("records").add({ data: withOwner(data, openid) });
      case "migrateOwner":
        return await db.collection("records").where({ _openid: openid }).update({
          data: {
            userId: openid,
            openid
          }
        });
      case "get":
        return await db.collection("records").where(_.and([{ _id: id }, ownerWhere(openid)])).get();
      case "update":
        return await db.collection("records").where(_.and([{ _id: id }, ownerWhere(openid)])).update({ data: withOwner(data, openid) });
      case "delete":
        return await db.collection("records").where(_.and([{ _id: id }, ownerWhere(openid)])).remove();
      case "list": {
        const { city, tag, page, pageSize, sortAsc } = data || {};
        const filters = [ownerWhere(openid)];
        if (city) filters.push({ city });
        if (tag) filters.push({ tags: tag });
        const cond = filters.length > 1 ? _.and(filters) : filters[0];
        const order = sortAsc ? "asc" : "desc";
        return await db.collection("records").where(cond).orderBy("createdAt",order).skip((page||0)*(pageSize||20)).limit(pageSize||20).get();
      }
      case "getCities": {
        const r = await db.collection("records").where(ownerWhere(openid)).field({city:true}).get();
        const map = {}; (r.data||[]).forEach(x => { if (x.city) map[x.city] = (map[x.city]||0)+1; });
        return { cities: Object.entries(map).map(([city,count]) => ({city,count})) };
      }
      default: return { error: "unknown action" };
    }
  } catch(e) { return { error: e.message }; }
};
