import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit } from "@/lib/api-utils";
import { getFormAccess, publicationChecklist } from "@/lib/forms-server";
import type { FormFieldDef } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

// POST /api/forms/:id/publish — machine à états (Annexe B.1)
// body: { action: "publish" | "unpublish" | "close" | "reopen" | "archive" | "restore" }
export async function POST(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") {
    return jsonError("FORBIDDEN", "Seul l'initiateur peut changer l'état du formulaire.", 403);
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const action = body.action ?? "publish";
  if (!["publish", "unpublish", "close", "reopen", "archive", "restore"].includes(action)) {
    return jsonError("VALIDATION_FAILED", "Action inconnue.", 422);
  }
  const form = access.form;

  // Récupérer la structure courante pour la checklist
  const full = await db.formVersion.findFirst({
    where: { formId: id },
    orderBy: { versionNumber: "desc" },
    include: { fields: true },
  });
  const fields: FormFieldDef[] = (full?.fields ?? []).map((f) => ({
    key: f.key, label: f.label, type: f.type as FormFieldDef["type"], isRequired: f.isRequired, position: f.position, options: {},
  }));

  switch (action) {
    case "publish": {
      const checklist = publicationChecklist(fields);
      if (!checklist.ok) {
        return jsonError("PUBLICATION_CHECK", checklist.issues.join(" "), 422, { issues: checklist.issues });
      }
      if (form.status !== "draft" && form.status !== "closed") {
        return jsonError("INVALID_TRANSITION", "Transition non permise.", 409);
      }
      // Une seule version publiée à la fois (RM-07) : la version courante devient LA version publique.
      await db.$transaction([
        db.formVersion.updateMany({ where: { formId: id, isPublished: true }, data: { isPublished: false } }),
        ...(full ? [db.formVersion.update({ where: { id: full.id }, data: { isPublished: true } })] : []),
        db.form.update({ where: { id }, data: { status: "published" } }),
      ]);
      break;
    }
    case "unpublish":
      if (form.status !== "published") return jsonError("INVALID_TRANSITION", "Transition non permise.", 409);
      await db.form.update({ where: { id }, data: { status: "draft" } });
      break;
    case "close":
      if (form.status !== "published") return jsonError("INVALID_TRANSITION", "Transition non permise.", 409);
      await db.form.update({ where: { id }, data: { status: "closed" } });
      break;
    case "reopen":
      if (form.status !== "closed") return jsonError("INVALID_TRANSITION", "Transition non permise.", 409);
      await db.form.update({ where: { id }, data: { status: "published" } });
      break;
    case "archive":
      if (form.status === "archived") return jsonError("INVALID_TRANSITION", "Transition non permise.", 409);
      await db.form.update({ where: { id }, data: { status: "archived" } });
      break;
    case "restore":
      if (form.status !== "archived") return jsonError("INVALID_TRANSITION", "Transition non permise.", 409);
      await db.form.update({ where: { id }, data: { status: "closed" } });
      break;
    default:
      return jsonError("VALIDATION_FAILED", "Action inconnue.", 422);
  }

  await audit(r.user.id, `form.${action}`, "form", id);
  return jsonOk({ ok: true, status: action === "publish" ? "published" : action === "unpublish" ? "draft" : action === "close" ? "closed" : action === "reopen" ? "published" : action === "archive" ? "archived" : "closed" });
}
