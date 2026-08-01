import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if(!supabaseUrl || !supabaseAnonKey) {
  console.log("No Supabase vars found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching personnel...");
  const { data: results, error: searchError } = await supabase
    .from('personnel')
    .select('*');
    
  if (searchError) {
    console.error(searchError);
    return;
  }
  console.log("Found personnel:");
  results.forEach(r => console.log(r.id, r.first_name, r.last_name));
  
  const { error: updateError } = await supabase
    .from('personnel')
    .update({ first_name: 'Juan Jose' })
    .eq('id', 'P1778772217822');
  console.log("Restored Juan Jose");
}
run();
