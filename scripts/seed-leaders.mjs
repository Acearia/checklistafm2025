#!/usr/bin/env node
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

const LEADERS_TO_SEED = [
  {
    name: "Fernando Dalabona",
    email: "fernando.dalabona@afm.com.br",
    sectors: ["TRATAMENTO TÉRMICO"],
  },
  {
    name: "Renê Simas",
    email: "rene.simas@afm.com.br",
    sectors: ["SOLDA"],
  },
  {
    name: "Lucas Queiroz",
    email: "lucas.queiroz@afm.com.br",
    sectors: [
      "REBOLO PENDULAR",
      "REBARBAÇÃO",
      "MAÇARICO",
      "LIXADEIRA MANUAL",
      "JATEAMENTO",
      "CORTE",
      "ACABAMENTO DE PEÇAS",
    ],
  },
  {
    name: "Vanderson Donato",
    email: "vanderson.donato@afm.com.br",
    sectors: [
      "REBOLO PENDULAR",
      "REBARBAÇÃO",
      "MAÇARICO",
      "LIXADEIRA MANUAL",
      "JATEAMENTO",
      "CORTE",
      "ACABAMENTO DE PEÇAS",
    ],
  },
  {
    name: "Fabrício Dalabona",
    email: "fabricio.dalabona@afm.com.br",
    sectors: [
      "TRATAMENTO TÉRMICO",
      "SOLDA",
      "REBOLO PENDULAR",
      "REBARBAÇÃO",
      "MAÇARICO",
      "LIXADEIRA MANUAL",
      "JATEAMENTO",
      "CORTE",
      "ACABAMENTO DE PEÇAS",
    ],
    supervisor: true,
  },
];

const normalize = (value) => value?.trim().toLowerCase() ?? "";

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha em ${url}: ${res.status} ${res.statusText} - ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function getExistingLeaders() {
  return fetchJson(`${API_BASE}/leaders`, { headers: HEADERS });
}

async function getSectorsMap() {
  const sectors = await fetchJson(`${API_BASE}/sectors`, { headers: HEADERS });
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

async function assignLeaderToSector(sectorName, leaderId, sectorMap) {
  const sector = sectorMap.get(normalize(sectorName));
  if (!sector) {
    console.warn(`Setor não encontrado: ${sectorName}`);
    return;
  }

  if (sector.leader_id && sector.leader_id !== leaderId) {
    console.warn(
      `Setor ${sector.name} já possui líder (${sector.leader_id}). Pular atribuição.`,
    );
    return;
  }

  await fetchJson(`${API_BASE}/sectors?id=eq.${encodeURIComponent(sector.id)}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ leader_id: leaderId }),
  });
  sector.leader_id = leaderId;
}

async function main() {
  const existingLeaders = await getExistingLeaders();
  const sectorsMap = await getSectorsMap();

  for (const leader of LEADERS_TO_SEED) {
    const record = await upsertLeader(leader, existingLeaders);

    if (!leader.sectors || leader.sectors.length === 0) continue;
    if (leader.supervisor) {
      console.log(
        `Líder supervisor ${leader.name} cadastrado. Ajuste manual dos setores se necessário.`,
      );
      continue;
    }

    for (const sectorName of leader.sectors) {
      await assignLeaderToSector(sectorName, record.id, sectorsMap);
    }
  }

  console.log("Líderes sincronizados com sucesso.");
}

main().catch((error) => {
  console.error("Erro ao sincronizar líderes:", error);
  process.exit(1);
});
