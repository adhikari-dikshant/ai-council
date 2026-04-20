import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!conversation) return new Response("Not found", { status: 404 });

  return Response.json({
    ...conversation,
    data: JSON.parse(conversation.data),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  await prisma.conversation.deleteMany({
    where: { id: params.id, userId: session.user.id },
  });

  return new Response(null, { status: 204 });
}
