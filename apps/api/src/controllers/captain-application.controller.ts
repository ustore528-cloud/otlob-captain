import type { Request, Response } from "express";
import { CaptainApplicationStatus } from "@prisma/client";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import {
  createCaptainApplication,
  listCaptainApplicationsForSuperAdmin,
  patchCaptainApplicationStatus,
} from "../services/captain-application.service.js";
import type { PublicCaptainApplicationCreateBody } from "../validators/captain-application.schemas.js";
import type { ListCaptainApplicationsQuery } from "../services/captain-application.service.js";

export const captainApplicationController = {
  createPublic: async (req: Request, res: Response) => {
    const body = req.body as PublicCaptainApplicationCreateBody;
    const row = await createCaptainApplication(body);
    return res.status(201).json(ok(row));
  },

  listSuperAdmin: async (req: Request, res: Response) => {
    const q = req.query as unknown as ListCaptainApplicationsQuery;
    const data = await listCaptainApplicationsForSuperAdmin({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 40,
      status: q.status as ListCaptainApplicationsQuery["status"],
      q: typeof q.q === "string" ? q.q : undefined,
    });
    return res.json(ok(data));
  },

  patchStatusSuperAdmin: async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const id = pathParam(req, "id");
    const { status, internalNotes } = req.body as {
      status: CaptainApplicationStatus;
      internalNotes?: string | null | "" | undefined;
    };
    const row = await patchCaptainApplicationStatus({
      id,
      status,
      internalNotes:
        typeof internalNotes === "string" ? internalNotes : internalNotes === null ? "" : undefined,
      actorUserId: userId,
    });
    return res.json(ok(row));
  },
};
