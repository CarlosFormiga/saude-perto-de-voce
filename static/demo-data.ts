export type Item = Record<string, string | number | null>;

const now = new Date();
const iso = (days: number, hour: number, minute = 0) => { const value = new Date(now); value.setDate(value.getDate() + days); value.setHours(hour, minute, 0, 0); return value.toISOString(); };

const products = [
  ["prod-losartana","MED-001","Losartana potássica 50 mg","Losartana potássica","Comprimido","comprimido",216,60,1],
  ["prod-metformina","MED-002","Metformina 850 mg","Cloridrato de metformina","Comprimido","comprimido",18,80,1],
  ["prod-dipirona","MED-003","Dipirona 500 mg","Dipirona sódica","Comprimido","comprimido",0,40,1],
  ["prod-omeprazol","MED-004","Omeprazol 20 mg","Omeprazol","Cápsula","cápsula",96,50,1],
  ["prod-sinvastatina","MED-005","Sinvastatina 20 mg","Sinvastatina","Comprimido","comprimido",14,40,1],
  ["prod-insulina","MED-006","Insulina humana NPH 100 UI/mL","Insulina humana","Frasco 10 mL","frasco",22,12,0],
  ["prod-amlodipino","MED-007","Amlodipino 5 mg","Besilato de anlodipino","Comprimido","comprimido",162,50,1],
  ["prod-captopril","MED-008","Captopril 25 mg","Captopril","Comprimido","comprimido",52,70,1],
  ["prod-hidroclorotiazida","MED-009","Hidroclorotiazida 25 mg","Hidroclorotiazida","Comprimido","comprimido",180,60,1],
  ["prod-atenolol","MED-010","Atenolol 50 mg","Atenolol","Comprimido","comprimido",30,45,1],
  ["prod-aas","MED-011","Ácido acetilsalicílico 100 mg","Ácido acetilsalicílico","Comprimido","comprimido",278,80,1],
  ["prod-paracetamol","MED-012","Paracetamol 500 mg","Paracetamol","Comprimido","comprimido",128,80,1],
  ["prod-ibuprofeno","MED-013","Ibuprofeno 600 mg","Ibuprofeno","Comprimido","comprimido",21,50,1],
  ["prod-amoxicilina","MED-014","Amoxicilina 500 mg","Amoxicilina","Cápsula","cápsula",78,40,1],
  ["prod-azitromicina","MED-015","Azitromicina 500 mg","Azitromicina","Comprimido","comprimido",0,30,1],
  ["prod-cefalexina","MED-016","Cefalexina 500 mg","Cefalexina","Cápsula","cápsula",66,35,1],
  ["prod-salbutamol","MED-017","Salbutamol 100 mcg/dose","Sulfato de salbutamol","Aerossol 200 doses","frasco",16,15,1],
  ["prod-beclometasona","MED-018","Beclometasona 250 mcg/dose","Dipropionato de beclometasona","Aerossol 200 doses","frasco",7,12,1],
  ["prod-levotiroxina","MED-019","Levotiroxina sódica 50 mcg","Levotiroxina sódica","Comprimido","comprimido",118,55,1],
  ["prod-fluoxetina","MED-020","Fluoxetina 20 mg","Cloridrato de fluoxetina","Cápsula","cápsula",46,45,0],
  ["prod-carbamazepina","MED-021","Carbamazepina 200 mg","Carbamazepina","Comprimido","comprimido",17,40,0],
  ["prod-prednisona","MED-022","Prednisona 20 mg","Prednisona","Comprimido","comprimido",40,25,1],
  ["prod-loratadina","MED-023","Loratadina 10 mg","Loratadina","Comprimido","comprimido",107,35,1],
  ["prod-soro","MED-024","Soro fisiológico 0,9%","Cloreto de sódio","Frasco 500 mL","frasco",53,30,1],
].map(([id,code,name,active,presentation,unit,available,minimum,delivery]) => ({id,code,name,active_ingredient:active,presentation,unit,available,minimum_stock:minimum,delivery_allowed:delivery,requires_prescription:Number(String(code).slice(-3))>3?1:0,nearest_expiry:"2027-07-31"})) as Item[];

const citizens = [
  ["citizen-maria","Maria Aparecida da Silva","123.***.***-09","Centro","validated",3,1],
  ["citizen-joao","João Batista Pereira","987.***.***-00","Centro","validated",1,0],
  ["citizen-ana","Ana Lúcia Souza","111.***.***-44","Centro","pre_registered",0,0],
  ["citizen-antonio","Antônio Carlos Rodrigues","222.***.***-55","Centro","validated",1,1],
  ["citizen-francisca","Francisca das Chagas Lima","333.***.***-66","Jardim Primavera","pending_documents",0,1],
  ["citizen-jose","José Roberto Alves","444.***.***-77","Centro","validated",1,1],
  ["citizen-marlene","Marlene Aparecida Santos","555.***.***-88","Suinana","validated",1,0],
  ["citizen-sebastiao","Sebastião Gomes Ferreira","666.***.***-99","Suinana","validated",1,1],
  ["citizen-rosangela","Rosângela de Fátima Costa","777.***.***-00","Jardim Primavera","pre_registered",0,0],
  ["citizen-paulo","Paulo Sérgio Martins","888.***.***-11","Centro","validated",1,1],
  ["citizen-neusa","Neusa Maria Oliveira","999.***.***-22","Suinana","validated",1,0],
  ["citizen-luiz","Luiz Fernando Barbosa","101.***.***-44","Centro","validated",0,0],
  ["citizen-elza","Elza Pereira Nascimento","202.***.***-55","Centro","validated",1,1],
  ["citizen-claudia","Cláudia Regina Moraes","303.***.***-66","Jardim Primavera","pre_registered",0,0],
  ["citizen-geraldo","Geraldo José da Silva","404.***.***-77","Zona Rural","validated",1,0],
].map(([id,full_name,cpf_masked,district,validation_status,request_count,document_count]) => ({id,full_name,cpf_masked,district,validation_status,first_pickup_required:validation_status==="validated"?0:1,request_count,document_count,created_at:now.toISOString()})) as Item[];

const locations: Item[] = [
  {id:"location-central",name:"Unidade Central de Saúde",address:"Rua Principal, 100",district:"Centro",reference:"Ao lado da Prefeitura",active:1},
  {id:"location-suinana",name:"Unidade de Saúde de Suinana",address:"Praça do Distrito, 20",district:"Suinana",reference:"Próximo à escola municipal",active:1},
  {id:"location-specialties",name:"Centro Municipal de Especialidades",address:"Avenida da Saúde, 230",district:"Centro",reference:"Próximo ao hospital",active:1},
];
const specialties: Item[] = [
  {id:"esp-cardio",name:"Cardiologia",description:"Cuida do coração e da circulação.",demand:5,next_date:iso(15,14)},
  {id:"esp-orto",name:"Ortopedia",description:"Cuida de ossos, articulações e dores de movimento.",demand:3,next_date:iso(8,8)},
  {id:"esp-oftalmo",name:"Oftalmologia",description:"Cuida da visão e da saúde dos olhos.",demand:4,next_date:iso(29,9)},
  {id:"esp-dermato",name:"Dermatologia",description:"Cuida da pele, cabelos e unhas.",demand:3,next_date:iso(22,13)},
];
const specialtySchedules: Item[] = [
  {id:"schedule-orto",specialty_id:"esp-orto",specialty_name:"Ortopedia",starts_at:iso(8,8),location_id:"location-central",location:"Unidade Central de Saúde",location_address:"Rua Principal, 100",status:"confirmed",capacity:24,citizens_notified:3,citizens_confirmed:3},
  {id:"schedule-cardio",specialty_id:"esp-cardio",specialty_name:"Cardiologia",starts_at:iso(15,14),location_id:"location-suinana",location:"Unidade de Saúde de Suinana",location_address:"Praça do Distrito, 20",status:"planned",capacity:18,citizens_notified:5,citizens_confirmed:1},
  {id:"schedule-dermato",specialty_id:"esp-dermato",specialty_name:"Dermatologia",starts_at:iso(22,13),location_id:"location-specialties",location:"Centro Municipal de Especialidades",location_address:"Avenida da Saúde, 230",status:"planned",capacity:20,citizens_notified:3,citizens_confirmed:0},
  {id:"schedule-oftalmo",specialty_id:"esp-oftalmo",specialty_name:"Oftalmologia",starts_at:iso(29,9),location_id:"location-specialties",location:"Centro Municipal de Especialidades",location_address:"Avenida da Saúde, 230",status:"confirmed",capacity:28,citizens_notified:4,citizens_confirmed:1},
];
const requests: Item[] = [
  ["request-01","SAU-2026-0101","citizen-joao","João Batista Pereira","prod-losartana","Losartana potássica 50 mg",30,"pickup","received",iso(2,9)],
  ["request-02","SAU-2026-0102","citizen-antonio","Antônio Carlos Rodrigues","prod-metformina","Metformina 850 mg",60,"delivery","approved",iso(2,15)],
  ["request-03","SAU-2026-0103","citizen-jose","José Roberto Alves","prod-omeprazol","Omeprazol 20 mg",28,"pickup","ready_for_pickup",iso(1,10,15)],
  ["request-04","SAU-2026-0104","citizen-marlene","Marlene Aparecida Santos","prod-insulina","Insulina humana NPH 100 UI/mL",2,"pickup","received",iso(3,8,30)],
  ["request-05","SAU-2026-0105","citizen-sebastiao","Sebastião Gomes Ferreira","prod-amlodipino","Amlodipino 5 mg",30,"delivery","delivery_scheduled",iso(1,16)],
  ["request-06","SAU-2026-0106","citizen-paulo","Paulo Sérgio Martins","prod-amoxicilina","Amoxicilina 500 mg",21,"pickup","approved",iso(2,14)],
  ["request-07","SAU-2026-0107","citizen-neusa","Neusa Maria Oliveira","prod-levotiroxina","Levotiroxina sódica 50 mcg",30,"delivery","received",iso(3,14)],
  ["request-08","SAU-2026-0108","citizen-elza","Elza Pereira Nascimento","prod-aas","Ácido acetilsalicílico 100 mg",30,"pickup","completed",iso(-1,8)],
  ["request-09","SAU-2026-0109","citizen-geraldo","Geraldo José da Silva","prod-salbutamol","Salbutamol 100 mcg/dose",1,"delivery","received",iso(4,15)],
  ["request-maria","SAU-2026-0110","citizen-maria","Maria Aparecida da Silva","prod-losartana","Losartana potássica 50 mg",30,"pickup","approved",iso(2,10)],
].map(([id,protocol,citizen_id,citizen_name,product_id,product_name,quantity,method,status,starts_at]) => ({id,protocol,citizen_id,citizen_name,product_id,product_name,quantity,method,status,starts_at,ends_at:new Date(new Date(String(starts_at)).getTime()+15*60000).toISOString(),created_at:now.toISOString()})) as Item[];

const slots: Item[] = Array.from({length: 30}, (_, index) => { const minute=(index%4)*15; const hour=8+(Math.floor(index/4)%6); return {id:`pickup-${index}`,method:"pickup",starts_at:iso(1+Math.floor(index/20),hour,minute),ends_at:iso(1+Math.floor(index/20),hour,minute+15),capacity:3,reserved_count:index%5===0?2:index%3===0?1:0,active:1}; }).concat(Array.from({length:9},(_,index)=>({id:`delivery-${index}`,method:"delivery",starts_at:iso(1+Math.floor(index/3),14+(index%3)),ends_at:iso(1+Math.floor(index/3),15+(index%3)),capacity:8,reserved_count:index===1?6:index%2,active:1}))) as Item[];
const lots = products.map((product,index)=>({id:`lot-${product.id}`,product_id:product.id,product_name:product.name,code:product.code,lot_number:`LT26${String(index+1).padStart(4,"0")}`,expires_on:index%6===0?"2026-10-20":"2027-07-31",balance:Number(product.available)+(index%4)*6,reserved:(index%4)*6,status:"released"})) as Item[];

export const initialState = {
  session: null as null | "citizen" | "admin",
  products, citizens, locations, specialties, specialtySchedules, requests, slots, lots,
  interests: [
    {id:"interest-maria-oftalmo",citizen_id:"citizen-maria",specialty_id:"esp-oftalmo",specialty_name:"Oftalmologia",status:"confirmed",schedule_id:"schedule-oftalmo",starts_at:specialtySchedules[3].starts_at,location_name:"Centro Municipal de Especialidades",location_address:"Avenida da Saúde, 230",location_reference:"Próximo ao hospital"},
    {id:"interest-maria-cardio",citizen_id:"citizen-maria",specialty_id:"esp-cardio",specialty_name:"Cardiologia",status:"notified",schedule_id:"schedule-cardio",starts_at:specialtySchedules[1].starts_at,location_name:"Unidade de Saúde de Suinana",location_address:"Praça do Distrito, 20",location_reference:"Próximo à escola municipal"},
  ] as Item[],
  needs: [{id:"need-01",citizen_id:"citizen-maria",product_id:"prod-dipirona",product_name:"Dipirona 500 mg",status:"active"}] as Item[],
  notifications: [{id:"notification-01",citizen_id:"citizen-maria",title:"Consulta disponível para confirmação",message:"Cardiologia em Suinana. Abra o portal para confirmar sua presença.",read_at:null,created_at:now.toISOString()},{id:"notification-02",citizen_id:"citizen-maria",title:"Bem-vinda ao Saúde Perto de Você",message:"Seu cadastro está validado.",read_at:null,created_at:iso(-1,9)}] as Item[],
  messages: [{id:"message-01",citizen_id:"citizen-maria",sender:"pharmacy",body:"Bom dia, Maria! Sua consulta está confirmada. Leve documento com foto e cartão SUS.",read_at:null,created_at:now.toISOString()},{id:"message-02",citizen_id:"citizen-joao",sender:"citizen",body:"Preciso confirmar se posso retirar o medicamento amanhã.",read_at:null,created_at:now.toISOString()}] as Item[],
  adminUsers: [{id:"admin-gabriela",name:"Gabriela Cruz",login:"admin@altair.sp.gov.br",role:"superadmin",active:1,created_at:now.toISOString()}] as Item[],
};
