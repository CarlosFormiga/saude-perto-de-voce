const CACHE="saude-municipal-v2";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",(event)=>{if(event.request.method!=="GET"||new URL(event.request.url).pathname.startsWith("/api/"))return;event.respondWith(fetch(event.request).then((response)=>{const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request)));});
self.addEventListener("push",(event)=>{
  let data={title:"Saúde Perto de Você",body:"Você recebeu um novo aviso.",url:"/cidadao",tag:"saude-municipal"};
  try{if(event.data)data={...data,...JSON.parse(event.data.text())};}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"/favicon.svg",badge:"/favicon.svg",tag:data.tag,data:{url:data.url},renotify:false}));
});
self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"/cidadao",self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then((clients)=>{
    const existing=clients.find((client)=>new URL(client.url).origin===self.location.origin);
    if(existing){if("navigate" in existing)existing.navigate(target);return existing.focus();}
    return self.clients.openWindow(target);
  }));
});
