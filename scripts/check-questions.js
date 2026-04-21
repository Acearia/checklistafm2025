import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Supabase variables missing. Define VITE_SUPABASE_URL and API key in env.');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  const { data: groups, error: gError } = await supabase.from('checklist_groups').select('id,name,equipment_type');
  if (gError) { console.error('group select error', gError); process.exit(1); }
  console.log('Groups:');
  groups.forEach(g => console.log(`- ${g.id} ${g.name} (${g.equipment_type})`));

  const targetNames = ['empilhadeira', 'transpaleteira'];
  const targetGroups = groups.filter(g => targetNames.includes((g.name||'').toLowerCase()));

  for (const g of targetGroups) {
    const { data: questions, error: qError } = await supabase.from('group_questions')
      .select('id,question,alert_on_yes,alert_on_no,order_number')
      .eq('group_id', g.id)
      .order('order_number', { ascending: true });
    if (qError) { console.error('question select error', qError); continue; }
    console.log(`\nQuestions for ${g.name} (${g.id}): ${questions.length}`);
    questions.forEach(q => console.log(` ${q.order_number}. ${q.question} [alert_on_no:${q.alert_on_no}]`));
  }
})();
