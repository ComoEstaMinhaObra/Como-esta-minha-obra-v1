export function SecaoClima({
  endereco,
  dias,
}: {
  endereco: string;
  dias: {
    data: string;
    condicao: "aberto" | "nublado" | "chuvoso";
    prob_chuva: number | null;
  }[];
}) {
  const icone = {
    aberto: "☀",
    nublado: "☁",
    chuvoso: "🌧",
  } as const;

  return (
    <section className="space-y-3">
      <p className="tracking-[0.18em] text-[10px] uppercase text-cinza-2">
        5 · Clima
      </p>
      <div className="rounded-[20px] border border-borda bg-cartao p-4">
        <p className="text-xs text-cinza-3">
          Preenchido automaticamente · {endereco}
        </p>
        {dias.length === 0 ? (
          <p className="mt-3 text-sm text-cinza-2">
            clima indisponível para este endereço
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-4 gap-2 min-[800px]:grid-cols-7">
            {dias.slice(-7).map((d) => {
              const [, m, day] = d.data.split("-");
              return (
                <li
                  key={d.data}
                  className="rounded-[12px] border border-divisor p-2 text-center text-xs"
                >
                  <div className="text-lg" aria-hidden>
                    {icone[d.condicao]}
                  </div>
                  <div>
                    {day}/{m}
                  </div>
                  <div className="text-cinza-2">
                    {d.prob_chuva != null ? `${d.prob_chuva}%` : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
