function formatDate(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function formatDateTime(d) {
  const dt = new Date(d);
  return formatDate(d) + ' ' + String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
}
function getTagName(key, TAGS) {
  const t = TAGS.find(x => x.key === key);
  return t ? t.name : key;
}
module.exports = { formatDate, formatDateTime, getTagName };