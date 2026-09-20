// CSV import: upload to Supabase Storage, then preview/parse/commit via importCsv.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { invokeFunction } from "@/adapters/base44/functions";

export const IMPORTS_BUCKET = "imports";

export async function uploadCsv(file) {
  const { data: sessionData } = await supabase.auth.getUser();
  const uid = sessionData?.user?.id || "anon";
  const safeName = String(file.name || "import.csv").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${uid}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(IMPORTS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "text/csv",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(IMPORTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: ({ fileUrl }) => invokeFunction("importCsv", { mode: "preview", file_url: fileUrl })
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileUrl, fileName, mapping, defaultDirection, accountId }) =>
      invokeFunction("importCsv", {
        mode: "commit",
        file_url: fileUrl,
        file_name: fileName,
        mapping,
        default_direction: defaultDirection,
        account_id: accountId
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["nudges"] });
    }
  });
}
