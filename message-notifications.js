'use strict';
// A cursor feed independent of read receipts, so active conversations also notify.
async function messageNotifications(db,userId,schoolId,channels,after){
 const keys=channels.map(c=>c.key);
 const where=`m.school_id=? AND m.user_id!=? AND (
 (m.channel IN (${keys.map(()=>'?').join(',')||'NULL'})) OR
 (m.channel=? AND EXISTS(SELECT 1 FROM memberships mb WHERE mb.user_id=m.user_id AND mb.school_id=?)) OR
 (m.channel LIKE 'channel:personal:%' AND EXISTS(SELECT 1 FROM personal_groups pg JOIN personal_group_members pm ON pm.group_id=pg.id WHERE 'channel:personal:'||pg.id=m.channel AND pm.user_id=?)))`;
 const args=[schoolId,userId,...keys,'dm:'+userId,schoolId,userId];
 if(after===undefined){const row=await db.get(`SELECT COALESCE(MAX(m.id),0) AS cursor FROM messages m WHERE ${where}`,...args);return {cursor:Number(row.cursor),messages:[]};}
 if(!/^\d+$/.test(String(after))||!Number.isSafeInteger(Number(after)))throw Object.assign(Error('Invalid notification cursor.'),{status:400});
 const rows=await db.all(`SELECT m.id,m.channel,m.user_id,m.text,COALESCE(d.name,u.name) AS author,pg.name AS group_name FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN user_display_names d ON d.user_id=u.id LEFT JOIN personal_groups pg ON m.channel='channel:personal:'||pg.id WHERE ${where} AND m.id>? ORDER BY m.id LIMIT 100`,...args,Number(after));
 return {cursor:rows.length?Number(rows.at(-1).id):Number(after),messages:rows.map(m=>({id:Number(m.id),channel:m.channel.startsWith('dm:')?'dm:'+m.user_id:m.channel,title:m.channel.startsWith('dm:')?m.author:channels.find(c=>c.key===m.channel)?.title||m.group_name||'Group',author:m.author,text:m.text.replace(/\[matcha-gift:[0-9a-f-]{36}\]/g,'').slice(0,180)}))};
}
module.exports={messageNotifications};
