import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const KEEP_OPERATOR = {
  matricula: "3675",
  name: "José Edmilton",
  cargo: "Operador",
  setor: "Manutenção",
};

async function resetOperators() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error(
      "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your environment.",
    );
    process.exit(1);
  }

  if (process.env.ALLOW_OPERATOR_RESET !== "1") {
    console.error("Refusing to reset operators without ALLOW_OPERATOR_RESET=1.");
    process.exit(1);
  }

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
