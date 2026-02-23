import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChecklistAnswer = {
  answer?: string | null;
  alertOnYes?: boolean | null;
  alertOnNo?: boolean | null;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const parseRecipients = (value: string | null | undefined) =>
  (value || "")
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => Boolean(item));

const uniqueEmails = (emails: string[]) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Array.from(new Set(emails.map((item) => item.trim().toLowerCase()))).filter((item) =>
    emailRegex.test(item),
  );
};

const countProblems = (answers: ChecklistAnswer[] | null | undefined) => {
  if (!Array.isArray(answers) || answers.length === 0) return 0;

  return answers.reduce((total, item) => {
    const normalizedAnswer = normalize(String(item.answer || ""));
    const isYes = normalizedAnswer === "sim";
    const isNo = normalizedAnswer === "nao" || normalizedAnswer === "não";
    const triggered = (isYes && Boolean(item.alertOnYes)) || (isNo && Boolean(item.alertOnNo));
    return triggered ? total + 1 : total;
  }, 0);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!resendApiKey || !resendFrom) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY ou RESEND_FROM nao configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { inspectionId } = await req.json();
    if (!inspectionId) {
      return new Response(JSON.stringify({ error: "inspectionId e obrigatorio." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: inspection, error: inspectionError } = await supabase
      .from("inspections")
      .select(
        `
          id,
          inspection_date,
          submission_date,
          comments,
          checklist_answers,
          operator:operators!inspections_operator_matricula_fkey(name,matricula,setor),
          equipment:equipment(name,kp,sector)
        `,
      )
      .eq("id", inspectionId)
      .maybeSingle();

    if (inspectionError || !inspection) {
      return new Response(
        JSON.stringify({ error: inspectionError?.message || "Inspecao nao encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const equipment = inspection.equipment as { name?: string; kp?: string; sector?: string } | null;
    const operator = inspection.operator as { name?: string; matricula?: string; setor?: string } | null;
    const sectorName = String(equipment?.sector || operator?.setor || "").trim();
    const normalizedSectorName = normalize(sectorName);

    let recipientEmails: string[] = [];

    const { data: leaders } = await supabase.from("leaders").select("email,sector");
    if (Array.isArray(leaders) && normalizedSectorName) {
      const bySector = leaders
        .filter((leader) => {
          const sectors = String(leader.sector || "")
            .split(/[,;/]/)
            .map((item) => normalize(item))
            .filter((item) => Boolean(item));
          return sectors.includes(normalizedSectorName);
        })
        .map((leader) => String(leader.email || ""));
      recipientEmails.push(...bySector);
    }

    if (sectorName) {
      const { data: sectors } = await supabase.from("sectors").select("id,name");
      const matchedSector = (sectors || []).find(
        (sector) => normalize(String(sector.name || "")) === normalizedSectorName,
      );

      if (matchedSector?.id) {
        const { data: assignments } = await supabase
          .from("sector_leader_assignments")
          .select("leader_id")
          .eq("sector_id", matchedSector.id);

        const leaderIds = (assignments || [])
          .map((item) => item.leader_id)
          .filter((id): id is string => Boolean(id));

        if (leaderIds.length > 0) {
          const { data: assignedLeaders } = await supabase
            .from("leaders")
            .select("email")
            .in("id", leaderIds);
          recipientEmails.push(...(assignedLeaders || []).map((item) => String(item.email || "")));
        }
      }
    }

    const staticRecipients = parseRecipients(Deno.env.get("INSPECTION_NOTIFY_EMAILS"));
    recipientEmails.push(...staticRecipients);
    recipientEmails = uniqueEmails(recipientEmails);

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: false,
          reason: "Nenhum destinatario encontrado para a inspecao.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const problemCount = countProblems((inspection.checklist_answers as ChecklistAnswer[]) || []);
    const submissionDate = String(inspection.submission_date || inspection.inspection_date || "");
    const dateLabel = submissionDate ? new Date(submissionDate).toLocaleString("pt-BR") : "sem data";
    const equipmentName = String(equipment?.name || "Equipamento");
    const equipmentKp = String(equipment?.kp || "-");
    const operatorName = String(operator?.name || "Nao informado");
    const operatorMatricula = String(operator?.matricula || "-");
    const comments = String(inspection.comments || "").trim();

    const subject = `[Checklist AFM] Nova inspecao - ${equipmentName} (${sectorName || "setor nao informado"})`;
    const text = [
      "Nova inspecao registrada.",
      `Inspecao ID: ${inspection.id}`,
      `Data/Hora: ${dateLabel}`,
      `Setor: ${sectorName || "-"}`,
      `Equipamento: ${equipmentName}`,
      `KP: ${equipmentKp}`,
      `Operador: ${operatorName}`,
      `Matricula: ${operatorMatricula}`,
      `Nao conformidades detectadas: ${problemCount}`,
      `Comentarios: ${comments || "-"}`,
    ].join("\n");

    const html = `
      <h2>Nova inspecao registrada</h2>
      <p><strong>Inspecao ID:</strong> ${inspection.id}</p>
      <p><strong>Data/Hora:</strong> ${dateLabel}</p>
      <p><strong>Setor:</strong> ${sectorName || "-"}</p>
      <p><strong>Equipamento:</strong> ${equipmentName}</p>
      <p><strong>KP:</strong> ${equipmentKp}</p>
      <p><strong>Operador:</strong> ${operatorName}</p>
      <p><strong>Matricula:</strong> ${operatorMatricula}</p>
      <p><strong>Nao conformidades detectadas:</strong> ${problemCount}</p>
      <p><strong>Comentarios:</strong> ${comments || "-"}</p>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: recipientEmails,
        subject,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      return new Response(
        JSON.stringify({ error: "Falha ao enviar e-mail.", details: errorBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendResponse.json();
    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        recipients: recipientEmails,
        provider: resendData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro inesperado ao processar notificacao de e-mail.",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
