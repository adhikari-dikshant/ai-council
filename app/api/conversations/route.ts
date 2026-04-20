import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return Response.json(conversations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { title, prompt, data } = await req.json();
  if (!prompt || !data) return new Response("Missing fields", { status: 400 });

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title: title ?? prompt.slice(0, 60),
      prompt,
      data: JSON.stringify(data),
    },
    select: { id: true, title: true, createdAt: true },
  });

  return Response.json(conversation, { status: 201 });
}
