'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../.test-tools/node_modules/playwright');
const {setup,report}=require('./live-support.cjs');
const suite=require('./browser.test.cjs');
(async()=>{
  const t=await setup();let browser;
  try{
    browser=await chromium.launch({headless:true,...(suite.browserPath?{executablePath:suite.browserPath}:{})});
    const url=name=>t.base+'/'+name;
    await suite.matrix(browser,url,'live');
    await suite.workflow(browser,url,'live');
    // Fresh tabs restore the server session without relying on sessionStorage.
    const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
    page.on('pageerror',error=>suite.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')suite.errors.push(message.text());});
    await suite.login(page,url,'admin');
    const tab=await context.newPage();await tab.goto(url('admin-dashboard.html'));await suite.ready(tab,'admin-dashboard.html');
    assert.equal(await tab.evaluate(()=>Auth.user.role),'admin');
    assert.equal(await tab.evaluate(()=>API.MODE),'live');
    assert.equal(await tab.evaluate(()=>localStorage.getItem('civicdesk.data.v1')),null,'Live mode must not initialize a browser database');
    await tab.waitForFunction(()=>document.querySelectorAll('.chart svg').length>=6);
    assert.ok(await tab.locator('.chart svg').count()>=6);
    await tab.screenshot({path:path.join(__dirname,'../test-results/live-admin-light.png'),fullPage:true});
    await tab.locator('[data-theme-toggle]').click();await tab.waitForFunction(()=>UI.isDark());
    await tab.screenshot({path:path.join(__dirname,'../test-results/live-admin-dark.png'),fullPage:true});
    await tab.goto(url('admin-reports.html'));await suite.ready(tab,'admin-reports.html');
    await tab.pdf({path:path.join(__dirname,'../test-results/live-report.pdf'),format:'A4',printBackground:true});
    assert.ok(fs.statSync(path.join(__dirname,'../test-results/live-report.pdf')).size>5000);
    // MySQL rehydrates a fresh browser session, even after clearing all browser storage.
    const records=await tab.evaluate(()=>API.applications.list({}));assert.ok(records.some(a=>a.reference===suite.results[0].reference));
    await context.close();
    const fresh=await browser.newContext();const freshPage=await fresh.newPage();await suite.login(freshPage,url,'citizen');
    const persisted=await freshPage.evaluate(()=>API.applications.list({}));assert.ok(persisted.some(a=>a.reference===suite.results[0].reference&&a.status==='APPROVED'));await fresh.close();
    assert.equal(suite.errors.length,0,suite.errors.join('\n'));
    report('live-browser.json',{passed:true,pageVisits:suite.visits(),consoleErrors:suite.errors,workflows:suite.results,newTabSession:true,noLocalDatabase:true,csvAndPdf:true,isolatedDatabase:true});
    console.log('PASS live browser: '+suite.visits()+' page visits, all roles/themes/desktop/mobile, full real workflow, new-tab sessions, durable SQL data, CSV/PDF, zero console errors.');
  }finally{if(browser)await browser.close();await t.close();}
})().catch(error=>{report('live-browser.json',{passed:false,pageVisits:suite.visits(),error:error.stack,consoleErrors:suite.errors});console.error(error);process.exitCode=1;});
