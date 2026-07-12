import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div className="text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="mt-2 text-xl font-bold">Junior Soccer Lineup Manager</h1>
        <p className="mt-1 text-sm text-slate-600">
          スタッフ用の合言葉を入力してください
        </p>
      </div>
      <LoginForm nextPath={next ?? "/"} />
    </div>
  );
}
