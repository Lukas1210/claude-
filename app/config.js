// Supabase-Zugangsdaten für den Sync (siehe README → „Sync einrichten“).
// Der „anon public“ bzw. „publishable“ Key ist dafür gedacht, öffentlich zu sein –
// eure Daten schützt der Login (E-Mail + Passwort) zusammen mit den Regeln aus supabase/setup.sql.
window.CJ_CONFIG = {
  supabaseUrl: '',      // z. B. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',  // Project Settings → API Keys → „anon public“ oder „publishable“
};
