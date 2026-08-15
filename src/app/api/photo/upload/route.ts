import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/household-context";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const household = await requireHousehold(); // throws if unauthenticated / no household
        const { itemId } = JSON.parse(clientPayload ?? "{}") as { itemId?: string };
        if (!itemId) throw new Error("Missing itemId");
        const item = await prisma.item.findFirst({
          where: { id: itemId, householdId: household.id },
          select: { id: true },
        });
        if (!item) throw new Error("Item not found");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          maximumSizeInBytes: 5_000_000,
        };
      },
      onUploadCompleted: async () => {
        // Persistence happens via the setItemPhoto action after the client upload resolves
        // (reliable in local dev, where Blob can't call back to localhost).
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
