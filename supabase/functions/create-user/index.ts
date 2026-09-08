// Supabase Edge Function: create-user
// Privileged User Provisioning for Diamond Finance Super Admin
// This function executes server-side only where SUPABASE_SERVICE_ROLE_KEY is securely available.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller authorization token & verify caller is Super Admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await clientSupabase.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized user." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is active super_admin
    const { data: callerProfile } = await clientSupabase
      .from("profiles")
      .select("role, status")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "super_admin" || callerProfile.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Super Admin access required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request payload
    const { email, password, full_name, role = "staff" } = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Full name, email, and password are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Role MUST be staff (cannot create super_admin via API)
    const assignedRole = "staff";

    // 3. Use Admin Auth Client with Service Role Key (Server-side ONLY)
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create auth user in Supabase Auth
    const { data: createdUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
      },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert into profiles table
    const { data: profileRecord, error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: createdUser.user.id,
        email: email.trim().toLowerCase(),
        full_name: full_name.trim(),
        role: assignedRole,
        status: "active",
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation warning:", profileError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: createdUser.user,
        profile: profileRecord,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
