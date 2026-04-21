import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { checklistItems } from "@/lib/data";

const DEFAULT_SUPABASE_URL = "https://rmtwtfgipupaxofmlvrz.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdHd0ZmdpcHVwYXhvZm1sdnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNTQ5MzIsImV4cCI6MjA3MjkzMDkzMn0.D7HCOIUUNinwEFEv4bF-zIbbRzeKUUF9ItIu5lFTODo";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your environment.",
  );
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

async function syncChecklistItems() {
  console.log("Syncing checklist_items table with local question set...");

  const payload = checklistItems.map((item, index) => ({
    question: item.question,
    order_number: index + 1,
    alert_on_yes: Boolean(item.alertOnYes),
    alert_on_no: Boolean(item.alertOnNo),
  }));

  const { error: deleteError } = await client
    .from("checklist_items")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    console.error("Failed to clear checklist_items:", deleteError);
    process.exit(1);
  }

  const { error: insertError } = await client
    .from("checklist_items")
    .insert(payload);

  if (insertError) {
    console.error("Failed to insert checklist items:", insertError);
    process.exit(1);
  }

  console.log(`Synced ${payload.length} checklist items successfully.`);
}

syncChecklistItems();
