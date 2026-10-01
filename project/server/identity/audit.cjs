'use strict';
const {pool}=require('../db.cjs');
async function event(req,event,outcome='INFO',metadata={},c=pool,userId=req.user?.id){
 // Call sites supply bounded classifications, never credentials or biometric data.
 await c.execute('INSERT INTO security_events(user_id,actor_id,event,outcome,risk_level,device_id,session_id,metadata,region,country) VALUES(?,?,?,?,?,?,?,?,?,?)',[userId||null,req.user?.id||null,event,outcome,req.risk?.level||'LOW',req.device?.id||null,req.sessionRow?.id||null,JSON.stringify({...metadata,...(req.network?.available?{network:{latitude:req.network.latitude,longitude:req.network.longitude}}:{})}),req.network?.region||null,req.network?.country||null]);
}
module.exports={event};
