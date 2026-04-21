#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY no .env para executar o seeding.",
  );
  process.exit(1);
}

const API_BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const DEFAULT_PASSWORD = "1234";
const DEFAULT_HASH = Buffer.from(DEFAULT_PASSWORD).toString("base64");

const leadersFile = path.resolve(process.cwd(), "leaders.json");

if (!fs.existsSync(leadersFile)) {
  console.error(`Arquivo leaders.json não encontrado em ${leadersFile}`);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(leadersFile, "utf-8"));

if (!Array.isArray(rawData)) {
  console.error("leaders.json precisa conter um array de líderes");
  process.exit(1);
}

const normalize = (value) => value?.trim().toLowerCase() ?? "";

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha em ${url}: ${res.status} ${res.statusText} - ${body}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn(`Resposta inesperada de ${url}:`, text);
    return null;
  }
}

async function getExistingLeaders() {
  return (await fetchJson(`${API_BASE}/leaders`, { headers: HEADERS })) ?? [];
}

async function getExistingAssignments() {
  return (await fetchJson(`${API_BASE}/sector_leader_assignments`, { headers: HEADERS })) ?? [];
}

async function getSectorsMap() {
  const sectors = (await fetchJson(`${API_BASE}/sectors`, { headers: HEADERS })) ?? [];
  const map = new Map();
  for (const sector of sectors) {
    map.set(normalize(sector.name), sector);
  }
  return map;
}

async function upsertLeader(leader, existingLeaders) {
  const existing = existingLeaders.find(
    (item) => normalize(item.email) === normalize(leader.email),
  );
  const payload = {
    name: leader.name,
    email: leader.email,
    sector: leader.sectors.join(", "),
    password_hash: DEFAULT_HASH,
  };

  if (existing) {
    await fetchJson(`${API_BASE}/leaders?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
    return { id: existing.id, ...payload };
  }

  const created = await fetchJson(`${API_BASE}/leaders`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  const record = Array.isArray(created) ? created[0] : created;
  if (!record?.id) {
    throw new Error(`Não foi possível criar o líder ${leader.name}`);
  }
  existingLeaders.push(record);
  return record;
}

async function assignLeaderToSector(sectorName, leaderId, shift, sectorMap, assignmentKeys) {
  const sector = sectorMap.get(normalize(sectorName));
  if (!sector) {
    console.warn(`Setor não encontrado: ${sectorName}`);
    return;
  }

  const normalizedShift = (shift ?? "default").trim();
  const key = `${sector.id}:${leaderId}:${normalizedShift.toLowerCase()}`;
  if (assignmentKeys.has(key)) {
    return;
  }

  await fetchJson(`${API_BASE}/sector_leader_assignments`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      sector_id: sector.id,
      leader_id: leaderId,
      shift: normalizedShift,
    }),
  });
  assignmentKeys.add(key);
}

async function main() {
  const existingLeaders = await getExistingLeaders();
  const existingAssignments = await getExistingAssignments();
  const sectorsMap = await getSectorsMap();
  const assignmentKeys = new Set(
    existingAssignments.map((assignment) =>
      `${assignment.sector_id}:${assignment.leader_id}:${(assignment.shift ?? "default").toLowerCase()}`,
    ),
  );

  for (const leader of rawData) {
    const sectors = Array.isArray(leader.sectors)
      ? leader.sectors
      : typeof leader.sector === "string"
        ? leader.sector.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    if (sectors.length === 0) {
      console.warn(`Nenhum setor informado para o líder ${leader.name}. Pulando.`);
      continue;
    }

    const shift = leader.shift ?? (leader.supervisor ? "Supervisor" : "default");

    const record = await upsertLeader({
      name: leader.name,
      email: leader.email,
      sectors,
    }, existingLeaders);

    for (const sectorName of sectors) {
      await assignLeaderToSector(sectorName, record.id, shift, sectorsMap, assignmentKeys);
    }
  }

  console.log("Líderes sincronizados com sucesso.");
}

main().catch((error) => {
  console.error("Erro ao sincronizar líderes:", error);
  process.exit(1);
});
