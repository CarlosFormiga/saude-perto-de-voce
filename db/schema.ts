import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const citizens = sqliteTable("citizens", {
  id: text("id").primaryKey(),
  cpfHash: text("cpf_hash").notNull().unique(),
  cpfMasked: text("cpf_masked").notNull(),
  fullName: text("full_name").notNull(),
  birthDate: text("birth_date").notNull(),
  validationStatus: text("validation_status").notNull(),
  firstPickupRequired: integer("first_pickup_required", { mode: "boolean" }).notNull(),
  address: text("address"),
  district: text("district"),
  ...timestamps,
});

export const credentials = sqliteTable("credentials", {
  citizenId: text("citizen_id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  activatedAt: text("activated_at").notNull(),
});

export const citizenDocuments = sqliteTable("citizen_documents", {
  id: text("id").primaryKey(), citizenId: text("citizen_id").notNull(), fileName: text("file_name").notNull(),
  storageKey: text("storage_key").notNull(), contentType: text("content_type").notNull(), status: text("status").notNull(), createdAt: text("created_at").notNull(),
});

export const activationCodes = sqliteTable("activation_codes", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  codeHash: text("code_hash").notNull(),
  status: text("status").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  principalId: text("principal_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  ...timestamps,
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  activeIngredient: text("active_ingredient").notNull(),
  presentation: text("presentation").notNull(),
  unit: text("unit").notNull(),
  minimumStock: real("minimum_stock").notNull(),
  requiresPrescription: integer("requires_prescription", { mode: "boolean" }).notNull(),
  deliveryAllowed: integer("delivery_allowed", { mode: "boolean" }).notNull(),
  publicVisible: integer("public_visible", { mode: "boolean" }).notNull(),
  ...timestamps,
});

export const lots = sqliteTable("lots", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  lotNumber: text("lot_number").notNull(),
  expiresOn: text("expires_on").notNull(),
  balance: real("balance").notNull(),
  reserved: real("reserved").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  protocol: text("protocol").notNull().unique(),
  citizenId: text("citizen_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: real("quantity").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull(),
  slotId: text("slot_id"),
  prescriptionName: text("prescription_name"),
  prescriptionStorageKey: text("prescription_storage_key"),
  reservedLotId: text("reserved_lot_id"),
  decisionReason: text("decision_reason"),
  ...timestamps,
});

export const privacyRequests = sqliteTable("privacy_requests", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  requestType: text("request_type").notNull(),
  details: text("details"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scheduleSlots = sqliteTable("schedule_slots", {
  id: text("id").primaryKey(),
  method: text("method").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  capacity: integer("capacity").notNull(),
  reservedCount: integer("reserved_count").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
});

export const stockNeeds = sqliteTable("stock_needs", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  productId: text("product_id").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const specialties = sqliteTable("specialties", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
});

export const specialtySchedules = sqliteTable("specialty_schedules", {
  id: text("id").primaryKey(),
  specialtyId: text("specialty_id").notNull(),
  location: text("location").notNull(),
  startsAt: text("starts_at").notNull(),
  status: text("status").notNull(),
  capacity: integer("capacity").notNull(),
  locationId: text("location_id"),
});

export const healthLocations = sqliteTable("health_locations", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(), address: text("address").notNull(), district: text("district").notNull(),
  reference: text("reference"), active: integer("active", { mode: "boolean" }).notNull(), ...timestamps,
});

export const specialtyInterests = sqliteTable("specialty_interests", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  specialtyId: text("specialty_id").notNull(),
  preferredLocation: text("preferred_location").notNull(),
  preferredPeriod: text("preferred_period").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  scheduleId: text("schedule_id"),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  active: integer("active", { mode: "boolean" }).notNull(),
  failureCount: integer("failure_count").notNull(),
  lastSuccessAt: text("last_success_at"),
  ...timestamps,
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  citizenId: text("citizen_id").notNull(),
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});
