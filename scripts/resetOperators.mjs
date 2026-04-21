import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rmtwtfgipupaxofmlvrz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdHd0ZmdpcHVwYXhvZm1sdnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNTQ5MzIsImV4cCI6MjA3MjkzMDkzMn0.D7HCOIUUNinwEFEv4bF-zIbbRzeKUUF9ItIu5lFTODo";

const KEEP_OPERATOR = {
  matricula: "3675",
  name: "José Edmilton",
  cargo: "Operador",
  setor: "Manutenção",
};

async function resetOperators() {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  console.log("Removing all operators except matricula", KEEP_OPERATOR.matricula);
  const { error: deleteError } = await client
    .from("operators")
    .delete()
    .neq("matricula", KEEP_OPERATOR.matricula);

  if (deleteError) {
    console.error("Failed to delete operators:", deleteError);
    process.exit(1);
  }

  console.log("Ensuring operator", KEEP_OPERATOR.matricula, "exists");
  const { error: upsertError } = await client
    .from("operators")
    .upsert(
      {
        ...KEEP_OPERATOR,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "matricula" },
    );

  if (upsertError) {
    console.error("Failed to upsert operator:", upsertError);
    process.exit(1);
  }

  console.log("Operators table reset successfully.");
}

resetOperators();
