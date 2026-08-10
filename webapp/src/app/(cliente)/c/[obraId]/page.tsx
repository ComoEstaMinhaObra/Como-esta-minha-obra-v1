export default async function ClienteInicio({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  return (
    <div>
      <h1 className="font-serif text-2xl font-light">Início</h1>
      <p className="mt-2 text-sm text-cinza-2">Obra {obraId} — S3.2</p>
    </div>
  );
}
