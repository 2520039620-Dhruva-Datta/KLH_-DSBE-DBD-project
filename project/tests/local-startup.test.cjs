'use strict';
// Read-only localhost smoke, plus an isolated legacy-to-React MFA journey.
// Authentication creates normal session/audit rows; main business records are untouched.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('../.test-tools/node_modules/playwright');
const {setup,Client,report}=require('./live-support.cjs');
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
// Observe current transitions: Chromium can leave an obsolete transition's
// finished promise unresolved when React restores the theme during hydration.
async function settled(page){await page.waitForFunction(()=>document.fonts.status==='loaded'&&document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).every(a=>a.playState==='finished'||a.playState==='idle'),null,{timeout:10000});}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const deadline=setTimeout(()=>{console.error('Smoke-test deadline reached');browser.close().catch(()=>{});},300000);
 const errors=[];let isolated;
 try{
  for(const base of ['http://127.0.0.1:3000','http://127.0.0.1:5173']){
   const context=await browser.newContext({colorScheme:'dark',viewport:{width:390,height:844}});
   const page=await context.newPage();page.setDefaultTimeout(20000);
   page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('Console error:',m.text());}});
   console.log('Check dark login:',base);await page.goto(base+'/login');await page.getByRole('button',{name:'Switch to light mode'}).waitFor();await settled(page);
   check(await page.evaluate(()=>matchMedia('(prefers-color-scheme: dark)').matches),'system dark preference is respected');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile login fits');
   await page.evaluate(fs.readFileSync(require.resolve('../.test-tools/node_modules/axe-core/axe.min.js'),'utf8'));
   const axe=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
   check(axe.violations.length===0,'dark mobile login accessibility: '+JSON.stringify(axe.violations.map(v=>v.id)));
   if(base.endsWith('3000'))await page.screenshot({path:path.join(__dirname,'../test-results/live-login-dark-mobile.png'),fullPage:true});
   console.log('Check theme persistence:',base);const saved=page.waitForResponse(r=>r.url().endsWith('/preferences/theme')&&r.request().method()==='PUT');
   await page.getByRole('button',{name:'Switch to light mode'}).click();console.log('Theme clicked');await saved;console.log('Theme saved');await page.reload();console.log('Theme page reloaded');await page.getByRole('button',{name:'Switch to dark mode'}).waitFor();console.log('Theme restored');await settled(page);console.log('Theme settled');
   check(await page.evaluate(()=>document.documentElement.dataset.theme)==='light','manual theme restores before drawing');
   await page.setViewportSize({width:1440,height:1000});await settled(page);
   if(base.endsWith('3000'))await page.screenshot({path:path.join(__dirname,'../test-results/live-login-light.png'),fullPage:true});
   for(const [role,route] of [['Citizen','citizen'],['Officer','officer'],['Admin','admin']]){
    console.log('Check sign-in:',base,role);await page.goto(base+'/login');await page.getByText('Development test accounts',{exact:true}).click();await page.getByRole('button',{name:'Fill '+role+' demo'}).click();const signed=page.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'Sign in',exact:true}).click();const login=await signed;const result=await login.json();console.log('Sign-in response:',login.status(),result.user?.role||result.message||result.error||'MFA challenge');await page.waitForURL('**/'+route);
    await page.locator('main h1').waitFor();check(true,role+' live sign-in on '+base);
    await page.getByRole('button',{name:'Account menu'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login*');
   }
   await context.close();
  }
  isolated=await setup();const MFA=require('../server/identity/mfa.cjs'),client=new Client(isolated.base);
  await client.request('GET','/api/portal/auth/me');
  assert.equal((await client.request('POST','/api/portal/auth/login',{email:'citizen@demo.gov',password:'citizen123',role:'CITIZEN'})).status,200);
  const enrollment=await client.request('POST','/api/portal/security/mfa/enroll',{});assert.equal(enrollment.status,200);
  const activated=await client.request('POST','/api/portal/security/mfa/activate',{code:MFA.totp(enrollment.body.secret)});assert.equal(activated.status,200);
  const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(isolated.base+'/login.html');await page.getByRole('button',{name:'Use citizen',exact:true}).click();await page.getByRole('button',{name:'Sign in to your workspace'}).click();await page.waitForURL('**/login?role=CITIZEN');check(true,'legacy MFA login redirects into secure React sign-in');
  check(await page.evaluate(()=>sessionStorage.getItem('civicdesk.session.v1'))===null,'legacy challenge is not saved as a signed-in user');
  await page.getByText('Development test accounts',{exact:true}).click();await page.getByRole('button',{name:'Fill Citizen demo'}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Authenticator or recovery code').fill(activated.body.recovery_codes[0]);await page.getByRole('button',{name:'Verify and sign in'}).click();await page.waitForURL('**/citizen');check(true,'redirected user can finish genuine MFA');
  await context.close();assert.deepEqual(errors,[]);
  report('local-startup.json',{passed:true,checks,errors,origins:['http://127.0.0.1:3000','http://127.0.0.1:5173'],legacyMfaRedirect:true});
  console.log('PASS localhost startup and legacy MFA:',checks,'checks');
 }finally{clearTimeout(deadline);await browser.close();if(isolated)await isolated.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
