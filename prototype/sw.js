/* Service worker: รับ push แล้วโชว์แจ้งเตือนของระบบ (ขึ้นบนหน้าจอล็อก / มุมจอคอม) แม้ปิดเว็บอยู่ */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('push',function(e){
  var d={};
  try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Content Calendar',{
    body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',
    tag:d.tag||'cc-reminder',renotify:true,data:{url:d.url||'./'}
  }));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){if(list[i].url.indexOf(self.registration.scope)===0&&'focus' in list[i])return list[i].focus()}
    return self.clients.openWindow(url);
  }));
});
