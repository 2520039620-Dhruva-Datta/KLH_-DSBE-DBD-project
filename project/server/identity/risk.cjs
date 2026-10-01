'use strict';
// Signals come only from server history and an explicitly configured provider.
// Client-supplied GPS/IP/VPN claims never determine identity or authorization.
function assess(s={}){let score=0;const reasons=[];const add=(yes,points,reason)=>{if(yes){score+=points;reasons.push(reason);}};
 add(!s.trusted,15,'NEW_DEVICE');add(s.trusted,-15,'TRUSTED_DEVICE');add(s.newRegion,10,'NEW_REGION');add(s.newCountry,20,'NEW_COUNTRY');add(s.impossibleTravel,45,'IMPOSSIBLE_TRAVEL');add(s.vpn,5,'VPN_SIGNAL');add(s.tor,10,'TOR_SIGNAL');add(s.datacenter,5,'DATACENTER_NETWORK');add(s.failedPasswords>=3,20,'FAILED_PASSWORDS');add(s.failedMfa>=3,30,'FAILED_MFA');add(s.failedRecovery>=3,35,'EXCESSIVE_RECOVERY_ATTEMPTS');add(s.failedLiveness>=3,25,'LIVENESS_FAILURES');add(s.strongVerification,-10,'SUCCESSFUL_STRONG_VERIFICATION');
 return {level:score>=75?'CRITICAL':score>=45?'HIGH':score>=25?'MEDIUM':'LOW',reasons,score:Math.max(0,score)};
}
function policy(e){if(e.risk==='CRITICAL')return 'BLOCKED';if(!e.quality||!e.liveness||!e.face)return 'REJECTED';if(e.risk==='HIGH')return 'IN_PERSON_VERIFICATION_REQUIRED';if(e.mfaEnrolled&&!e.mfa)return 'MFA_REQUIRED';if(e.risk==='MEDIUM'||e.age==='UNCERTAIN'||(!e.mfaEnrolled&&!e.trusted&&!e.assisted))return 'ADDITIONAL_VERIFICATION_REQUIRED';return 'VERIFIED';}
module.exports={assess,policy};
