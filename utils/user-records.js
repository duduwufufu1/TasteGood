const { COLLECTION } = require("./constants");
const auth = require("./auth");

const db = wx.cloud.database();
let migratedOpenid = "";

async function getCurrentUser(options) {
  const opts = options || {};
  let user = auth.getCachedUser();
  if (!user || !user.openid) {
    const error = new Error("LOGIN_REQUIRED");
    error.code = "LOGIN_REQUIRED";
    throw error;
  }
  await ensureMigrated(user);
  return user;
}

async function ensureMigrated(user) {
  if (!user || !user.openid || migratedOpenid === user.openid) return;
  try {
    const res = await wx.cloud.callFunction({
      name: "records",
      data: { action: "migrateOwner" }
    });
    if (res.result && res.result.error) {
      throw new Error(res.result.error);
    }
    migratedOpenid = user.openid;
  } catch (error) {
    console.warn("[user-records] migrate owner failed", error);
  }
}

async function collection() {
  const user = await getCurrentUser();
  return {
    user,
    col: db.collection(COLLECTION.RECORDS).where({ userId: user.openid })
  };
}

async function getAll() {
  try {
    const ctx = await collection();
    const pageSize = 20;
    let offset = 0;
    let data = [];
    while (true) {
      const res = await ctx.col
        .orderBy("createdAt", "desc")
        .skip(offset)
        .limit(pageSize)
        .get();
      const page = res.data || [];
      data = data.concat(page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return { data };
  } catch (error) {
    if (error.code === "LOGIN_REQUIRED" || error.message === "LOGIN_REQUIRED") {
      return { data: [] };
    }
    throw error;
  }
}

function withOwner(data, user) {
  return Object.assign({}, data, {
    userId: user.openid,
    openid: user.openid
  });
}

module.exports = {
  getCurrentUser,
  collection,
  getAll,
  withOwner
};
