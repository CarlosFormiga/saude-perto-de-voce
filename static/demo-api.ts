import { initialState } from "./demo-data";

type DemoState = typeof initialState;
const clone = (): DemoState => JSON.parse(JSON.stringify(initialState)) as DemoState;
let state = clone();
const nativeFetch = window.fetch.bind(window);
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const message = (text: string) => response({ ok: true, message: text });
const timestamp = () => new Date().toISOString();
const activeCitizen = () => state.citizens.find((item) => item.id === "citizen-maria")!;

function citizenPayload() {
  const profile = activeCitizen();
  return {
    ok: true, profile, products: state.products,
    requests: state.requests.filter((item) => item.citizen_id === profile.id),
    needs: state.needs.filter((item) => item.citizen_id === profile.id && item.status === "active"),
    specialties: state.specialties, schedules: state.specialtySchedules.map((item) => ({...item,location_name:item.location})),
    interests: state.interests.filter((item) => item.citizen_id === profile.id),
    notifications: state.notifications.filter((item) => item.citizen_id === profile.id),
    messages: state.messages.filter((item) => item.citizen_id === profile.id), slots: state.slots,
  };
}

function adminPayload() {
  const chats = state.citizens.filter((citizen) => state.messages.some((item) => item.citizen_id === citizen.id)).map((citizen) => {
    const list = state.messages.filter((item) => item.citizen_id === citizen.id);
    return {citizen_id:citizen.id,full_name:citizen.full_name,last_message:list[list.length-1]?.created_at,unread:list.filter((item)=>item.sender==="citizen"&&!item.read_at).length};
  });
  return { ok:true, me:state.adminUsers[0], products:state.products, lots:state.lots, requests:state.requests, slots:state.slots,
    specialties:state.specialties, specialtySchedules:state.specialtySchedules, locations:state.locations, citizens:state.citizens,
    chats, adminMessages:state.messages, auditEvents:[], adminUsers:state.adminUsers,
    kpis:{pending:state.requests.filter((item)=>item.status==="received").length,lowStock:state.products.filter((item)=>Number(item.available)<=Number(item.minimum_stock)).length,todayAppointments:4,citizens:state.citizens.length} };
}

function updateStatus(id: unknown, status: string) {
  const item = state.requests.find((entry) => entry.id === id); if (!item) return;
  item.status = status === "ready" ? (item.method === "delivery" ? "delivery_scheduled" : "ready_for_pickup") : status;
}

async function post(body: Record<string, unknown>) {
  const action = String(body.action ?? "");
  if (action === "login") {
    if (body.mode === "admin" && body.login === "admin@altair.sp.gov.br" && body.password === "Admin@2026") { state.session="admin"; return response({ok:true,role:"admin"}); }
    if (body.mode === "citizen" && String(body.cpf).replace(/\D/g,"") === "12345678909" && body.password === "Cidadao@2026") { state.session="citizen"; return response({ok:true,role:"citizen"}); }
    return response({ok:false,message:"Acesso não encontrado. Confira os dados da demonstração."},401);
  }
  if (action === "activate") {
    if (String(body.cpf).replace(/\D/g,"") === "11122233344" && body.birthDate === "1972-06-18" && String(body.code).toUpperCase() === "SAUDE-2026") { state.session="citizen"; return response({ok:true,role:"citizen",message:"Acesso ativado com sucesso."}); }
    return response({ok:false,message:"Código inválido ou vencido."},400);
  }
  if (action === "logout") { state.session=null; return message("Você saiu com segurança."); }
  if (action === "requestStatus") { updateStatus(body.requestId,String(body.status)); return message("Situação da solicitação atualizada."); }
  if (action === "updateSlot") { const item=state.slots.find((entry)=>entry.id===body.slotId); if(item)item.capacity=Number(body.capacity); return message("Capacidade atualizada."); }
  if (action === "updateScheduleStatus") { const item=state.specialtySchedules.find((entry)=>entry.id===body.scheduleId); if(item)item.status=String(body.status); return message("Situação da consulta atualizada e cidadãos avisados."); }
  if (action === "toggleLocation") { const item=state.locations.find((entry)=>entry.id===body.locationId); if(item)item.active=body.active?1:0; return message("Local atualizado."); }
  if (action === "addLocation") { state.locations.push({id:`location-${Date.now()}`,name:String(body.name),address:String(body.address),district:String(body.district),reference:String(body.reference??""),active:1}); return message("Local cadastrado."); }
  if (action === "addSchedule") { const spec=state.specialties.find((item)=>item.id===body.specialtyId)!; const loc=state.locations.find((item)=>item.id===body.locationId)!; const item={id:`schedule-${Date.now()}`,specialty_id:spec.id,specialty_name:spec.name,starts_at:new Date(String(body.startsAt)).toISOString(),location_id:loc.id,location:loc.name,location_address:loc.address,status:"planned",capacity:Number(body.capacity),citizens_notified:Number(spec.demand),citizens_confirmed:0}; state.specialtySchedules.push(item); return message("Agenda publicada e interessados avisados."); }
  if (action === "addProduct") { state.products.push({id:`prod-${Date.now()}`,code:String(body.code),name:String(body.name),active_ingredient:String(body.name),presentation:String(body.presentation??"Unidade"),unit:"unidade",available:0,minimum_stock:Number(body.minimumStock??0),delivery_allowed:1,requires_prescription:0}); return message("Produto cadastrado."); }
  if (["importXml","importInventory","importCitizens"].includes(action)) return message("Arquivo processado. A carga demonstrativa foi atualizada.");
  if (action === "validateCitizen") { const item=state.citizens.find((entry)=>entry.id===body.citizenId); if(item){item.validation_status="validated";item.first_pickup_required=0;} return message("Documentos validados."); }
  if (action === "createAdmin") { state.adminUsers.push({id:`admin-${Date.now()}`,name:String(body.name),login:String(body.login),role:String(body.role),active:1,created_at:timestamp()}); return message("Usuário administrativo criado."); }
  if (action === "replyMessage") { state.messages.push({id:`message-${Date.now()}`,citizen_id:String(body.citizenId),sender:"pharmacy",body:String(body.message),read_at:null,created_at:timestamp()}); return message("Resposta enviada."); }
  if (action === "sendMessage") { state.messages.push({id:`message-${Date.now()}`,citizen_id:"citizen-maria",sender:"citizen",body:String(body.message),read_at:null,created_at:timestamp()}); return message("Mensagem enviada."); }
  if (action === "readNotifications") { state.notifications.forEach((item)=>item.read_at=timestamp()); return message("Avisos marcados como lidos."); }
  if (action === "needStock") { const product=state.products.find((item)=>item.id===body.productId)!; state.needs.push({id:`need-${Date.now()}`,citizen_id:"citizen-maria",product_id:product.id,product_name:product.name,status:"active"}); return message("Avisaremos quando o medicamento chegar."); }
  if (action === "requestMedication") { const product=state.products.find((item)=>item.id===body.productId)!; const slot=state.slots.find((item)=>item.id===body.slotId)!; state.requests.unshift({id:`request-${Date.now()}`,protocol:`SAU-2026-${Math.floor(1000+Math.random()*9000)}`,citizen_id:"citizen-maria",citizen_name:"Maria Aparecida da Silva",product_id:product.id,product_name:product.name,quantity:Number(body.quantity),method:String(body.method),status:"received",starts_at:slot.starts_at,ends_at:slot.ends_at,created_at:timestamp()}); slot.reserved_count=Number(slot.reserved_count)+1; return message("Solicitação recebida. A farmácia vai analisar seu pedido."); }
  if (action === "specialtyInterest") { const spec=state.specialties.find((item)=>item.id===body.specialtyId)!; state.interests.push({id:`interest-${Date.now()}`,citizen_id:"citizen-maria",specialty_id:spec.id,specialty_name:spec.name,status:"active",schedule_id:null,created_at:timestamp()}); spec.demand=Number(spec.demand)+1; return message("Necessidade registrada para o planejamento municipal."); }
  if (action === "confirmConsultation") { const item=state.interests.find((entry)=>entry.id===body.interestId); if(item)item.status="confirmed"; return message("Presença confirmada."); }
  if (action === "uploadDocument") return message("Documento enviado para validação.");
  return message("Atualização demonstrativa concluída.");
}

export function installDemoApi() {
  state = clone();
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes("/api/portal")) return nativeFetch(input, init);
    if ((init?.method ?? "GET").toUpperCase() === "POST") return post(JSON.parse(String(init?.body ?? "{}")) as Record<string,unknown>);
    const action = new URL(url,location.origin).searchParams.get("action") ?? "public";
    if (action === "public") return response({ok:true,products:state.products,updatedAt:timestamp()});
    if (action === "session") return response({ok:true,role:state.session});
    if (action === "citizen") return state.session === "citizen" ? response(citizenPayload()) : response({ok:false},401);
    if (action === "admin") return state.session === "admin" ? response(adminPayload()) : response({ok:false},401);
    return response({ok:false},404);
  };
}
