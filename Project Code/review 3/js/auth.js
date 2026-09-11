(function(){
  'use strict';
  const KEY='civicdesk.session.v1';let memory=null;
  function read(){try{return JSON.parse(sessionStorage.getItem(KEY))||memory;}catch{return memory;}}
  function write(user){memory=user;try{if(user)sessionStorage.setItem(KEY,JSON.stringify(user));else sessionStorage.removeItem(KEY);}catch{/* Session stays available in this document. */}}
  const Auth={
    get user(){return read();},
    async login(email,password,role){const user=await API.auth.login({email,password,role});write(user);return user;},
    async register(data){const user=await API.auth.register(data);write(user);return user;},
    async logout(){await API.auth.logout();write(null);location.href='login.html';},
    async refresh(){if(API.MODE==='demo'&&!read())return null;try{const user=await API.auth.me();write(user);return user;}catch(err){if(API.MODE==='live'&&err.status!==401)throw err;write(null);return null;}},
    async guard(roles){if(!roles.length){if(API.MODE==='live')await Auth.refresh();return true;}const user=await Auth.refresh();if(!user){location.replace('login.html');return null;}if(!roles.includes(user.role)){location.replace(Auth.homeFor(user.role));return null;}return user;},
    redirectIfSignedIn(){const user=read();if(user){location.replace(Auth.homeFor(user.role));return true;}return false;},
    is(role){return read()?.role===role;},isAdmin(){return Auth.is('admin');},isOfficer(){return Auth.is('officer');},isCitizen(){return Auth.is('citizen');},
    department(){return read()?.department_id||null;},
    homeFor(role){return ({citizen:'citizen-dashboard.html',officer:'officer-dashboard.html',admin:'admin-dashboard.html'})[role]||'login.html';},
    clear(){write(null);}
  };window.Auth=Auth;
})();
