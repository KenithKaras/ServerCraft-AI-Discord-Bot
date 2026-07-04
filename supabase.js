const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.warn('⚠️ WARNING: Supabase credentials are missing from .env. Backup/Restore commands will fail until they are added.');
}

// Supabase client requires a valid URL format, so we provide a placeholder if it's missing to prevent startup crash
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder_key';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
